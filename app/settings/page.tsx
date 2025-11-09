// app/settings/page.tsx
"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Switch } from "@heroui/switch";
import { Divider } from "@heroui/divider";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { account, authService } from "@/lib/appwrite";

export default function SettingsPage() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const { isOpen: isPhoneModalOpen, onOpen: onPhoneModalOpen, onClose: onPhoneModalClose } = useDisclosure();
  const { isOpen: isVerifyModalOpen, onOpen: onVerifyModalOpen, onClose: onVerifyModalClose } = useDisclosure();
  
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
  const [phoneVerifyError, setPhoneVerifyError] = useState("");
  const [phoneVerifySuccess, setPhoneVerifySuccess] = useState(false);

  // Preferences state
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login");
    }
  }, [user, loading, router]);

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess(false);

    if (newPassword !== confirmNewPassword) {
      setPasswordError("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      setPasswordError("Password must be at least 8 characters long");
      return;
    }

    setPasswordLoading(true);

    try {
      await account.updatePassword(newPassword, oldPassword);
      setPasswordSuccess(true);
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      
      setTimeout(() => {
        setPasswordSuccess(false);
      }, 3000);
    } catch (err: any) {
      setPasswordError(err.message || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleSendVerification = async () => {
    setVerificationError("");
    setVerificationSuccess(false);
    setVerificationLoading(true);

    try {
      await account.createVerification(`${window.location.origin}/verify-email`);
      setVerificationSuccess(true);
      
      setTimeout(() => {
        setVerificationSuccess(false);
      }, 5000);
    } catch (err: any) {
      setVerificationError(err.message || "Failed to send verification email");
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
      // Phone number must be in E.164 format: +[country code][number]
      // Example: +911234567890 for India
      if (!phoneNumber.startsWith("+")) {
        setPhoneError("Phone number must start with + and country code (e.g., +911234567890)");
        setPhoneLoading(false);
        return;
      }

      await authService.updatePhone(phoneNumber, phonePassword);
      setPhoneSuccess(true);
      onPhoneModalClose();
      
      // Open verification modal
      onVerifyModalOpen();
      
      setTimeout(() => {
        setPhoneSuccess(false);
      }, 3000);
    } catch (err: any) {
      setPhoneError(err.message || "Failed to add phone number");
    } finally {
      setPhoneLoading(false);
    }
  };

  const handleSendPhoneVerification = async () => {
    setPhoneVerifyError("");
    setPhoneVerifyLoading(true);

    try {
      await authService.createPhoneVerification();
      alert("Verification code sent to your phone!");
    } catch (err: any) {
      setPhoneVerifyError(err.message || "Failed to send verification code");
    } finally {
      setPhoneVerifyLoading(false);
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
      
      setTimeout(() => {
        onVerifyModalClose();
        window.location.reload();
      }, 2000);
    } catch (err: any) {
      setPhoneVerifyError(err.message || "Invalid verification code");
    } finally {
      setPhoneVerifyLoading(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to delete your account? This action cannot be undone.")) {
      try {
        alert("Account deletion requires backend implementation. Please contact support.");
      } catch (err: any) {
        alert("Failed to delete account");
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading settings...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">Settings</h1>

      {/* Security Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Security</h2>
        </CardHeader>
        <CardBody className="gap-6">
          {/* Change Password */}
          <div>
            <h3 className="text-lg font-medium mb-4">Change Password</h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <Input
                label="Current Password"
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="Enter current password"
                required
                isDisabled={passwordLoading}
              />
              <Input
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 8 characters)"
                required
                isDisabled={passwordLoading}
              />
              <Input
                label="Confirm New Password"
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="Confirm new password"
                required
                isDisabled={passwordLoading}
              />

              {passwordError && (
                <div className="text-danger text-sm">{passwordError}</div>
              )}

              {passwordSuccess && (
                <div className="text-success text-sm">
                  Password changed successfully!
                </div>
              )}

              <Button
                type="submit"
                color="primary"
                isLoading={passwordLoading}
              >
                Update Password
              </Button>
            </form>
          </div>

          <Divider />

          {/* Email Verification */}
          <div>
            <h3 className="text-lg font-medium mb-4">Email Verification</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">
                  Status: {user.emailVerification ? (
                    <span className="text-success">Verified ✓</span>
                  ) : (
                    <span className="text-warning">Not Verified</span>
                  )}
                </p>
                <p className="text-sm text-default-500 mt-1">
                  {user.email}
                </p>
              </div>
              {!user.emailVerification && (
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  onPress={handleSendVerification}
                  isLoading={verificationLoading}
                >
                  Send Verification Email
                </Button>
              )}
            </div>

            {verificationError && (
              <div className="text-danger text-sm mt-2">{verificationError}</div>
            )}

            {verificationSuccess && (
              <div className="text-success text-sm mt-2">
                Verification email sent! Check your inbox.
              </div>
            )}
          </div>

          <Divider />

          {/* Phone Number */}
          <div>
            <h3 className="text-lg font-medium mb-4">Phone Number</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">
                  Status: {user.phoneVerification ? (
                    <span className="text-success">Verified ✓</span>
                  ) : user.phone ? (
                    <span className="text-warning">Not Verified</span>
                  ) : (
                    <span className="text-default-400">Not Added</span>
                  )}
                </p>
                <p className="text-sm text-default-500 mt-1">
                  {user.phone || "No phone number added"}
                </p>
              </div>
              <div className="flex gap-2">
                {user.phone && !user.phoneVerification && (
                  <Button
                    color="primary"
                    variant="flat"
                    size="sm"
                    onPress={onVerifyModalOpen}
                  >
                    Verify Phone
                  </Button>
                )}
                <Button
                  color="primary"
                  variant="flat"
                  size="sm"
                  onPress={onPhoneModalOpen}
                >
                  {user.phone ? "Update" : "Add"} Phone
                </Button>
              </div>
            </div>

            {phoneSuccess && (
              <div className="text-success text-sm mt-2">
                Phone number updated successfully!
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-6">
        <CardHeader>
          <h2 className="text-xl font-semibold">Notifications</h2>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Email Notifications</p>
              <p className="text-sm text-default-500">
                Receive email updates about your account
              </p>
            </div>
            <Switch
              isSelected={emailNotifications}
              onValueChange={setEmailNotifications}
            />
          </div>

          <Divider />

          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Push Notifications</p>
              <p className="text-sm text-default-500">
                Receive push notifications in your browser
              </p>
            </div>
            <Switch
              isSelected={pushNotifications}
              onValueChange={setPushNotifications}
            />
          </div>
        </CardBody>
      </Card>

      {/* Danger Zone */}
      <Card className="border-danger">
        <CardHeader>
          <h2 className="text-xl font-semibold text-danger">Danger Zone</h2>
        </CardHeader>
        <CardBody className="gap-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Delete Account</p>
              <p className="text-sm text-default-500">
                Permanently delete your account and all data
              </p>
            </div>
            <Button
              color="danger"
              variant="flat"
              onPress={handleDeleteAccount}
            >
              Delete Account
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Add/Update Phone Modal */}
      <Modal isOpen={isPhoneModalOpen} onClose={onPhoneModalClose}>
        <ModalContent>
          <form onSubmit={handleAddPhone}>
            <ModalHeader>
              {user.phone ? "Update" : "Add"} Phone Number
            </ModalHeader>
            <ModalBody>
              <Input
                label="Phone Number"
                placeholder="+911234567890"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                description="Include country code (e.g., +91 for India)"
                required
                isDisabled={phoneLoading}
              />
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={phonePassword}
                onChange={(e) => setPhonePassword(e.target.value)}
                description="Confirm with your account password"
                required
                isDisabled={phoneLoading}
              />
              {phoneError && (
                <div className="text-danger text-sm">{phoneError}</div>
              )}
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onPhoneModalClose}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={phoneLoading}>
                {user.phone ? "Update" : "Add"} Phone
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>

      {/* Verify Phone Modal */}
      <Modal isOpen={isVerifyModalOpen} onClose={onVerifyModalClose}>
        <ModalContent>
          <form onSubmit={handleVerifyPhone}>
            <ModalHeader>
              Verify Phone Number
            </ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500 mb-4">
                Enter the verification code sent to your phone number
              </p>
              <Input
                label="Verification Code"
                placeholder="Enter 6-digit code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                required
                maxLength={6}
                isDisabled={phoneVerifyLoading}
              />
              {phoneVerifyError && (
                <div className="text-danger text-sm">{phoneVerifyError}</div>
              )}
              {phoneVerifySuccess && (
                <div className="text-success text-sm">
                  Phone verified successfully!
                </div>
              )}
              <Button
                variant="flat"
                size="sm"
                onPress={handleSendPhoneVerification}
                isLoading={phoneVerifyLoading}
                className="mt-2"
              >
                Resend Code
              </Button>
            </ModalBody>
            <ModalFooter>
              <Button variant="flat" onPress={onVerifyModalClose}>
                Cancel
              </Button>
              <Button color="primary" type="submit" isLoading={phoneVerifyLoading}>
                Verify Phone
              </Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </div>
  );
}