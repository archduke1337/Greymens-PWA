// app/settings/page.tsx
"use client";
import type { ExtendedUser } from "@/lib/types";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Separator,
  Switch,
  TextField,
  useOverlayState,
} from "@heroui/react";

import { account, authService } from "@/lib/appwrite";
import { useAuth } from "@/context/AuthContext";

// Notification preference keys stored on the authenticated account.
const EMAIL_NOTIFICATIONS_PREF = "emailNotifications";
const PUSH_NOTIFICATIONS_PREF = "pushNotifications";

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function SettingsPage() {
  const { user: authUser, loading, refreshUser } = useAuth();
  const user = authUser as unknown as ExtendedUser | null;
  const router = useRouter();
  const timersRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  // Success toasts auto-dismiss; every timer is tracked so unmounting the
  // page never fires setState on a dead component.
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  useEffect(
    () => () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
    },
    [],
  );
  const {
    isOpen: isPhoneModalOpen,
    open: onPhoneModalOpen,
    close: onPhoneModalClose,
  } = useOverlayState();
  const {
    isOpen: isVerifyModalOpen,
    open: onVerifyModalOpen,
    close: onVerifyModalClose,
  } = useOverlayState();

  // Password change state
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Email verification state
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationSuccess, setVerificationSuccess] = useState(false);

  // Phone number state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [phonePassword, setPhonePassword] = useState("");
  const [phoneLoading, setPhoneLoading] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [phoneSuccess, setPhoneSuccess] = useState(false);

  // Phone verification state
  const [verificationCode, setVerificationCode] = useState("");
  const [phoneVerifyLoading, setPhoneVerifyLoading] = useState(false);
  const [phoneResending, setPhoneResending] = useState(false);
  const [phoneVerifyError, setPhoneVerifyError] = useState("");
  const [phoneVerifySuccess, setPhoneVerifySuccess] = useState(false);
  // Resend cooldowns: verification emails/SMS spend quota on every tap.
  const [emailCooldown, setEmailCooldown] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(false);

  // Preferences state. Seeded from the account preferences once the session is
  // known, so the switches reflect what is actually stored.
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [savingPreference, setSavingPreference] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    const prefs = (user.prefs ?? {}) as Record<string, unknown>;

    setEmailNotifications(prefs[EMAIL_NOTIFICATIONS_PREF] !== false);
    setPushNotifications(prefs[PUSH_NOTIFICATIONS_PREF] !== false);
  }, [user]);

  const updateNotificationPreference = async (key: string, value: boolean) => {
    if (!user) return;
    const previous = value === false;

    setSavingPreference(key);
    if (key === EMAIL_NOTIFICATIONS_PREF) setEmailNotifications(value);
    else setPushNotifications(value);

    try {
      // Appwrite replaces preferences wholesale, so existing prefs must be kept.
      await account.updatePrefs({ ...(user.prefs ?? {}), [key]: value });
      await refreshUser();
      toast.success("Notification preference saved");
    } catch (err) {
      if (key === EMAIL_NOTIFICATIONS_PREF) setEmailNotifications(previous);
      else setPushNotifications(previous);
      toast.error(errorMessage(err, "Failed to save notification preference"));
    } finally {
      setSavingPreference(null);
    }
  };

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");

      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters");

      return;
    }

    setPasswordLoading(true);

    try {
      await account.updatePassword({ password: newPassword, oldPassword });
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");

      later(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (err) {
      setPasswordError(errorMessage(err, "Failed to change password"));
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setVerificationError("");
    setVerificationSuccess(false);
    setVerificationLoading(true);

    try {
      await account.createEmailVerification({
        url: `${window.location.origin}/verify-email`,
      });
      setVerificationSuccess(true);
      // One email per tap is quota: brief cooldown before another may send.
      setEmailCooldown(true);
      later(() => setEmailCooldown(false), 60000);

      later(() => {
        setVerificationSuccess(false);
      }, 5000);
    } catch (err) {
      setVerificationError(
        errorMessage(err, "Failed to send verification email"),
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneError("");
    setPhoneSuccess(false);
    setPhoneLoading(true);

    try {
      // E.164: + followed by 7–15 digits. The server re-validates; this
      // catches typos before a round trip.
      const digits = phoneNumber.replace(/[\s()-]/g, "");

      if (!/^\+\d{7,15}$/.test(digits)) {
        setPhoneError(
          "Enter a valid phone number with country code (e.g., +911234567890)",
        );
        setPhoneLoading(false);

        return;
      }

      await authService.updatePhone(digits, phonePassword);
      setPhoneSuccess(true);
      setPhoneNumber("");
      setPhonePassword("");
      onPhoneModalClose();

      // The session snapshot still carries the old phone: refresh so the
      // status row below reflects reality without a reload.
      try {
        await refreshUser();
      } catch {
        // Non-blocking: the next login picks it up regardless.
      }

      // Open verification modal
      openVerifyModal();

      later(() => {
        setPhoneSuccess(false);
      }, 3000);
    } catch (err) {
      setPhoneError(errorMessage(err, "Failed to add phone number"));
    } finally {
      setPhoneLoading(false);
    }
  };

  // Opening a modal always starts from a clean form: stale values and errors
  // from a previous open must not leak into the next one.
  const openPhoneModal = () => {
    setPhoneNumber("");
    setPhonePassword("");
    setPhoneError("");
    onPhoneModalOpen();
  };

  const openVerifyModal = () => {
    setVerificationCode("");
    setPhoneVerifyError("");
    setPhoneVerifySuccess(false);
    onVerifyModalOpen();
  };

  const handleSendPhoneVerification = async () => {
    setPhoneVerifyError("");
    setPhoneResending(true);

    try {
      await authService.createPhoneVerification();
      toast.success("Verification code sent to your phone!");
      setSmsCooldown(true);
      later(() => setSmsCooldown(false), 60000);
    } catch (err) {
      setPhoneVerifyError(
        errorMessage(err, "Failed to send verification code"),
      );
    } finally {
      setPhoneResending(false);
    }
  };

  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setPhoneVerifyError("");
    setPhoneVerifySuccess(false);
    setPhoneVerifyLoading(true);

    try {
      if (!user) return;
      await authService.updatePhoneVerification(user.$id, verificationCode);
      setPhoneVerifySuccess(true);
      setVerificationCode("");
      try {
        await refreshUser();
      } catch {
        // Non-blocking: verified state appears on next login regardless.
      }

      later(() => {
        onVerifyModalClose();
        setPhoneVerifySuccess(false);
        // Phone will be shown as verified on next login
      }, 2000);
    } catch (err) {
      setPhoneVerifyError(errorMessage(err, "Invalid verification code"));
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className="flex items-center justify-center min-h-[calc(100vh-200px)]"
        role="status"
      >
        <div className="text-center">
          <div
            aria-hidden="true"
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
          />
          <p className="mt-4 text-default-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div
          aria-label="Redirecting to login"
          className="text-center"
          role="status"
        >
          <div
            aria-hidden="true"
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
          />
          <p className="mt-4 text-default-500">
            Sign in required — taking you to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Security Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Security</h2>
        </CardHeader>
        <CardContent className="gap-6">
          {/* Change Password */}
          <div>
            <h3 className="text-lg font-medium mb-4">Change Password</h3>
            <Form
              className="space-y-4"
              validationBehavior="aria"
              onSubmit={handlePasswordChange}
            >
              <TextField
                isRequired
                isDisabled={passwordLoading}
                name="currentPassword"
                type="password"
                value={oldPassword}
                onChange={setOldPassword}
              >
                <Label>Current password</Label>
                <Input
                  autoComplete="current-password"
                  placeholder="Enter current password"
                />
                <FieldError />
              </TextField>
              <TextField
                isRequired
                isDisabled={passwordLoading}
                name="newPassword"
                type="password"
                validate={(value) =>
                  value.length >= 8
                    ? null
                    : "New password must be at least 8 characters"
                }
                value={newPassword}
                onChange={setNewPassword}
              >
                <Label>New password</Label>
                <Input
                  autoComplete="new-password"
                  placeholder="Enter new password (min 8 characters)"
                />
                <Description>At least 8 characters.</Description>
                <FieldError />
              </TextField>
              <TextField
                isRequired
                isDisabled={passwordLoading}
                name="confirmNewPassword"
                type="password"
                validate={(value) =>
                  value === newPassword ? null : "New passwords do not match"
                }
                value={confirmNewPassword}
                onChange={setConfirmNewPassword}
              >
                <Label>Confirm new password</Label>
                <Input
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                />
                <FieldError />
              </TextField>

              {passwordError && (
                <Alert role="alert" status="danger">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>
                      Couldn&apos;t change your password
                    </Alert.Title>
                    <Alert.Description>{passwordError}</Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              {passwordSuccess && (
                <Alert role="status" status="success">
                  <Alert.Indicator />
                  <Alert.Content>
                    <Alert.Title>Password changed</Alert.Title>
                    <Alert.Description>
                      Use the new password next time you log in.
                    </Alert.Description>
                  </Alert.Content>
                </Alert>
              )}

              <Button
                className="w-full sm:w-auto"
                isDisabled={passwordLoading}
                isPending={passwordLoading}
                type="submit"
              >
                Update Password
              </Button>
            </Form>
          </div>

          <Separator />

          {/* Email Verification */}
          <div>
            <h3 className="text-lg font-medium mb-4">Email Verification</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-default-500">
                  Status:{" "}
                  {user.emailVerification ? (
                    <span className="text-success">Verified</span>
                  ) : (
                    <span className="text-warning">Not verified</span>
                  )}
                </p>
                <p className="text-sm text-default-500 mt-1">{user.email}</p>
              </div>
              {!user.emailVerification && (
                <Button
                  isDisabled={emailCooldown}
                  isPending={verificationLoading}
                  size="sm"
                  variant="primary"
                  onPress={handleSendVerification}
                >
                  {emailCooldown
                    ? "Email sent — wait to resend"
                    : "Send Verification Email"}
                </Button>
              )}
            </div>

            {verificationError && (
              <Alert className="mt-2" role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t send the email</Alert.Title>
                  <Alert.Description>{verificationError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {verificationSuccess && (
              <Alert className="mt-2" role="status" status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Verification email sent</Alert.Title>
                  <Alert.Description>Check your inbox.</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </div>

          <Separator />

          {/* Phone Number */}
          <div>
            <h3 className="text-lg font-medium mb-4">Phone Number</h3>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm text-default-500">
                  Status:{" "}
                  {user.phoneVerification ? (
                    <span className="text-success">Verified</span>
                  ) : user.phone ? (
                    <span className="text-warning">Not verified</span>
                  ) : (
                    <span className="text-default-400">Not added</span>
                  )}
                </p>
                <p className="text-sm text-default-500 mt-1">
                  {user.phone || "No phone number added"}
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {user.phone && !user.phoneVerification && (
                  <Button size="sm" variant="primary" onPress={openVerifyModal}>
                    Verify Phone
                  </Button>
                )}
                <Button size="sm" variant="primary" onPress={openPhoneModal}>
                  {user.phone ? "Update" : "Add"} Phone
                </Button>
              </div>
            </div>

            {phoneError && (
              <Alert className="mt-2" role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t save the phone number</Alert.Title>
                  <Alert.Description>{phoneError}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}

            {phoneSuccess && (
              <Alert className="mt-2" role="status" status="success">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Phone number saved</Alert.Title>
                  <Alert.Description>Verify it to finish.</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Notifications</h2>
        </CardHeader>
        <CardContent className="gap-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-default-500">
                Receive email updates about your account
              </p>
            </div>
            <Switch
              aria-label="Email notifications"
              isDisabled={savingPreference !== null}
              isSelected={emailNotifications}
              onChange={(value: boolean) =>
                updateNotificationPreference(EMAIL_NOTIFICATIONS_PREF, value)
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>

          <Separator />

          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-default-500">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              aria-label="Push notifications"
              isDisabled={savingPreference !== null}
              isSelected={pushNotifications}
              onChange={(value: boolean) =>
                updateNotificationPreference(PUSH_NOTIFICATIONS_PREF, value)
              }
            >
              <Switch.Content>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Content>
            </Switch>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-danger">
        <CardHeader>
          <h2 className="text-xl font-semibold text-danger">Danger Zone</h2>
        </CardHeader>
        <CardContent className="gap-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="font-medium">Request account deletion</p>
              <p className="text-sm text-default-500">
                Membership and governance records are retained under the club
                charter, so deletion is completed by an administrator.
                Requesting deletion starts that process and does not remove
                anything immediately.
              </p>
            </div>
            <Link
              className="inline-flex items-center rounded-lg border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger-50 transition-colors"
              href="/contact"
            >
              Request deletion
            </Link>
          </div>
          <div className="flex flex-wrap justify-between items-center gap-3">
            <div>
              <p className="font-medium">Connection diagnostics</p>
              <p className="text-sm text-default-500">
                Check backend reachability and configuration when something is
                not loading.
              </p>
            </div>
            <Link
              className="inline-flex items-center rounded-lg border border-default-300 px-4 py-2 text-sm font-medium hover:bg-default-100 transition-colors"
              href="/diagnostics"
            >
              Open diagnostics
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Add/Update Phone Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isPhoneModalOpen}
          onOpenChange={(open: boolean) => {
            if (!open) onPhoneModalClose();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <Form validationBehavior="aria" onSubmit={handleAddPhone}>
                <ModalHeader>
                  {user.phone ? "Update" : "Add"} Phone Number
                </ModalHeader>
                <ModalBody>
                  <TextField
                    isRequired
                    isDisabled={phoneLoading}
                    name="phoneNumber"
                    type="tel"
                    validate={(value) =>
                      /^\+\d{7,15}$/.test(value.replace(/[\s()-]/g, ""))
                        ? null
                        : "Enter a valid phone number with country code (e.g., +911234567890)"
                    }
                    value={phoneNumber}
                    onChange={setPhoneNumber}
                  >
                    <Label>Phone number</Label>
                    <Input
                      autoComplete="tel"
                      inputMode="tel"
                      placeholder="+911234567890"
                    />
                    <Description>Country code first, e.g. +91…</Description>
                    <FieldError />
                  </TextField>
                  <TextField
                    isRequired
                    isDisabled={phoneLoading}
                    name="phonePassword"
                    type="password"
                    value={phonePassword}
                    onChange={setPhonePassword}
                  >
                    <Label>Password</Label>
                    <Input
                      autoComplete="current-password"
                      placeholder="Enter your password"
                    />
                    <FieldError />
                  </TextField>
                  {phoneError && (
                    <Alert role="alert" status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>
                          Couldn&apos;t save the phone number
                        </Alert.Title>
                        <Alert.Description>{phoneError}</Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}
                </ModalBody>
                <ModalFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={onPhoneModalClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    isDisabled={phoneLoading}
                    isPending={phoneLoading}
                    type="submit"
                  >
                    {user.phone ? "Update" : "Add"} Phone
                  </Button>
                </ModalFooter>
              </Form>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Verify Phone Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isVerifyModalOpen}
          onOpenChange={(open: boolean) => {
            if (!open) onVerifyModalClose();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <Form validationBehavior="aria" onSubmit={handleVerifyPhone}>
                <ModalHeader>Verify Phone Number</ModalHeader>
                <ModalBody>
                  <p className="text-sm text-default-500 mb-4">
                    Enter the verification code sent to your phone number
                  </p>
                  <TextField
                    isRequired
                    isDisabled={phoneVerifyLoading}
                    name="verificationCode"
                    validate={(value) =>
                      value.trim() ? null : "Enter the verification code"
                    }
                    value={verificationCode}
                    onChange={setVerificationCode}
                  >
                    <Label>Verification code</Label>
                    <Input
                      autoComplete="one-time-code"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Enter 6-digit code"
                    />
                    <FieldError />
                  </TextField>
                  {phoneVerifyError && (
                    <Alert role="alert" status="danger">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Couldn&apos;t verify the code</Alert.Title>
                        <Alert.Description>
                          {phoneVerifyError}
                        </Alert.Description>
                      </Alert.Content>
                    </Alert>
                  )}
                  {phoneVerifySuccess && (
                    <Alert role="status" status="success">
                      <Alert.Indicator />
                      <Alert.Content>
                        <Alert.Title>Phone verified</Alert.Title>
                      </Alert.Content>
                    </Alert>
                  )}
                  <Button
                    className="mt-2"
                    isDisabled={phoneVerifyLoading || smsCooldown}
                    isPending={phoneResending}
                    size="sm"
                    type="button"
                    variant="primary"
                    onPress={handleSendPhoneVerification}
                  >
                    {smsCooldown ? "Code sent — wait to resend" : "Resend Code"}
                  </Button>
                </ModalBody>
                <ModalFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onPress={onVerifyModalClose}
                  >
                    Cancel
                  </Button>
                  <Button
                    isDisabled={phoneVerifyLoading}
                    isPending={phoneVerifyLoading}
                    type="submit"
                  >
                    Verify Phone
                  </Button>
                </ModalFooter>
              </Form>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
