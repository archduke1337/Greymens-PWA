// app/forgot-password/page.tsx
// Starts Appwrite's email recovery flow: one email field, one button, and a
// success message that never reveals whether the address has an account.
"use client";

import { Suspense, useState } from "react";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Spinner,
  TextField,
} from "@heroui/react";

import AuthShell from "@/components/auth/AuthShell";
import { account } from "@/lib/appwrite";
import { logError } from "@/lib/logger";

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const cleanEmail = email.trim();

    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError("Enter a valid email address.");

      return;
    }

    setLoading(true);

    try {
      // No enumeration: the success screen shows whether or not the
      // address exists — Appwrite only sends when it does.
      await account.createRecovery({
        email: cleanEmail,
        url: `${window.location.origin}/reset-password`,
      });
      setSent(true);
    } catch (err: unknown) {
      logError(
        "Password recovery failed:",
        err instanceof Error ? err.message : "unknown error",
      );
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      artAlt="A hand-drawn member puzzling over a Greymens login screen that reads trust but verify"
      artSrc="/Assets/Objects/login.png"
      caption="Trust but verify — including your own password."
      description="We will email you a link to set a new password."
      title="Reset your password"
    >
      {sent ? (
        <Card.Content className="space-y-4">
          <Alert status="success">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Check your inbox</Alert.Title>
              <Alert.Description>
                If an account uses that address, a reset link is on its way.
                It expires in one hour.
              </Alert.Description>
            </Alert.Content>
          </Alert>
          <p className="text-center text-sm text-muted">
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/login"
            >
              Back to log in
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
                  <Alert.Title>Couldn&apos;t send the link</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
            <TextField
              isRequired
              isDisabled={loading}
              name="email"
              type="email"
              validate={(value) =>
                EMAIL_PATTERN.test(value.trim())
                  ? null
                  : "Enter a valid email address"
              }
              value={email}
              onChange={setEmail}
            >
              <Label>Email</Label>
              <Input autoComplete="email" placeholder="you@example.com" />
              <FieldError />
            </TextField>
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
                  {isPending ? "Sending link…" : "Send reset link"}
                </>
              )}
            </Button>
            <p className="text-center text-sm text-muted">
              Remembered it?{" "}
              <Link
                className="font-medium text-foreground underline underline-offset-4"
                href="/login"
              >
                Log in
              </Link>
            </p>
          </Card.Footer>
        </Form>
      )}
    </AuthShell>
  );
}

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordForm />
    </Suspense>
  );
}
