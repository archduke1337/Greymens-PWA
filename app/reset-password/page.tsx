// app/reset-password/page.tsx
// Completes Appwrite's email recovery flow: the emailed link lands here with
// `userId` + `secret`, and this page sets the new password.
"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Alert,
  Button,
  Card,
  Form,
  Link,
  Spinner,
} from "@heroui/react";

import AuthShell from "@/components/auth/AuthShell";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { account } from "@/lib/appwrite";
import { logError } from "@/lib/logger";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const userId = searchParams.get("userId") ?? "";
  const secret = searchParams.get("secret") ?? "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const linkValid = userId.length > 0 && secret.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");

      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    setLoading(true);

    try {
      await account.updateRecovery({
        userId,
        secret,
        password,
      });
      setDone(true);
    } catch (err: unknown) {
      logError(
        "Password reset failed:",
        err instanceof Error ? err.message : "unknown error",
      );
      setError(
        "This link is invalid or has expired. Request a new one and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      artAlt="A hand-drawn member puzzling over a Greymens login screen that reads trust but verify"
      artSrc="/Assets/Objects/login.png"
      caption="Trust but verify — including your own password."
      description="Choose a new password for your account."
      title="Set a new password"
    >
      {!linkValid ? (
        <Card.Content className="space-y-4">
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>This link isn&apos;t valid</Alert.Title>
              <Alert.Description>
                Open the reset link from your email again, or request a new
                one.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <p className="text-center text-sm text-muted">
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/forgot-password"
            >
              Request a new link
            </Link>
          </p>
        </Card.Content>
      ) : done ? (
        <Card.Content className="space-y-4">
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Password updated</Alert.Title>
              <Alert.Description>
                Log in with your new password to continue.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <p className="text-center text-sm text-muted">
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/login"
            >
              Log in
            </Link>
          </p>
        </Card.Content>
      ) : (
        <Form validationBehavior="aria" onSubmit={handleSubmit}>
          <Card.Content className="space-y-4">
            {error && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t update your password</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <div className="space-y-2">
              <PasswordField
                autoComplete="new-password"
                disabled={loading}
                label="New password"
                name="password"
                placeholder="Min. 8 characters"
                validate={(value) =>
                  value.length >= 8
                    ? null
                    : "Password must be at least 8 characters."
                }
                value={password}
                onChange={setPassword}
              />
              <PasswordStrength password={password} />
            </div>
            <PasswordField
              autoComplete="new-password"
              disabled={loading}
              label="Confirm new password"
              name="confirmPassword"
              placeholder="Repeat it"
              validate={(value) =>
                value === password ? null : "Passwords do not match"
              }
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </Card.Content>
          <Card.Footer className="flex-col gap-3">
            <Button
              fullWidth
              className="rounded-full"
              isDisabled={loading}
              isPending={loading}
              type="submit"
            >
              {({ isPending }) => (
                <>
                  {isPending ? <Spinner color="current" size="sm" /> : null}
                  {isPending ? "Updating…" : "Update password"}
                </>
              )}
            </Button>
          </Card.Footer>
        </Form>
      )}
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
