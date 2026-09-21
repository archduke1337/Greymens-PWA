// app/register/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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

import { useAuth } from "@/context/AuthContext";
import ProviderButtons from "@/components/auth/ProviderButtons";
import AuthShell from "@/components/auth/AuthShell";
import PasswordField from "@/components/auth/PasswordField";
import PasswordStrength from "@/components/auth/PasswordStrength";
import { logError } from "@/lib/logger";

function getSafeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";

  return next;
}

function mapRegisterError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
  const raw = err instanceof Error ? err.message : "";

  // Already user-facing (thrown by AuthContext): show verbatim.
  if (
    message.includes("could not be verified") ||
    message.includes("try logging in")
  ) {
    return raw || "Please try again.";
  }
  if (
    message.includes("already exists") ||
    message.includes("already in use") ||
    message.includes("conflict") ||
    message.includes("user with the same email")
  ) {
    return "An account with this email already exists. Try logging in.";
  }
  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("load failed")
  ) {
    return "Network error. Check your connection and retry.";
  }
  if (
    message.includes("rate limit") ||
    message.includes("ratelimited") ||
    message.includes("too many")
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  // Password-policy rejections from the server ("Password must not be
  // longer than…", "Password should not contain…") are already actionable
  // instructions — pass them through instead of generic-mapping them.
  if (message.includes("password")) {
    return raw || "That password doesn't meet the requirements.";
  }

  return "Something went wrong. Please try again.";
}

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { register, loginWithGithub, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));
  const busy = loading || googleLoading || githubLoading;

  // Already authenticated: leave (see login page — proxy no longer bounces).
  useEffect(() => {
    if (user) router.push(next);
  }, [user, router, next]);

  const stashNext = () => {
    try {
      sessionStorage.setItem("post_auth_next", next);
    } catch {
      // Storage unavailable: callback falls back to "/dashboard".
    }
  };

  const clearNext = () => {
    try {
      sessionStorage.removeItem("post_auth_next");
    } catch {
      // Ignore storage errors on the failure path too.
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate the values actually sent: field-level `validate` only runs
    // on interaction, so a straight submit must re-check everything —
    // including the trimmed identifier (autocomplete trailing space).
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (cleanName.length < 2) {
      setError("Enter your full name.");

      return;
    }
    if (!EMAIL_PATTERN.test(cleanEmail)) {
      setError("Enter a valid email address.");

      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");

      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");

      return;
    }

    setLoading(true);

    try {
      await register(cleanEmail, password, cleanName);
      router.push(next);
    } catch (err: unknown) {
      const mapped = mapRegisterError(err);

      logError("Registration failed:", mapped);
      setError(mapped);
    } finally {
      setLoading(false);
    }
  };

  const startProvider =
    (provider: "google" | "github", run: () => Promise<unknown>) =>
    async () => {
      setError("");
      if (provider === "google") setGoogleLoading(true);
      else setGithubLoading(true);
      try {
        stashNext();
        // Token flow: navigates to the provider; /auth/success creates the
        // session. Do not redirect manually.
        await run();
      } catch (err: unknown) {
        clearNext();
        const mapped = mapRegisterError(err);

        logError(
          provider === "google"
            ? "Google signup failed:"
            : "GitHub signup failed:",
          mapped,
        );
        setError(mapped);
        if (provider === "google") setGoogleLoading(false);
        else setGithubLoading(false);
      }
    };

  const handleGoogleSignup = startProvider("google", loginWithGoogle);
  const handleGithubSignup = startProvider("github", loginWithGithub);

  return (
    <AuthShell
      artAlt="A hand-drawn newcomer filling in the Greymens register: curious, willing to learn, not here just for a certificate"
      artSrc="/Assets/Objects/register.png"
      caption="One more hacker in the making? Could be you."
      description="Continue with Google or GitHub — or register with email."
      title="Create your account"
    >
      <Form validationBehavior="aria" onSubmit={handleSubmit}>
        <Card.Content className="space-y-4">
          {error && (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Couldn&apos;t create your account</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <ProviderButtons
            disabled={busy}
            githubPending={githubLoading}
            googlePending={googleLoading}
            mode="signup"
            onGitHub={handleGithubSignup}
            onGoogle={handleGoogleSignup}
          />
          <div aria-hidden="true" className="flex items-center gap-3">
            <span className="h-px flex-1 bg-default-200" />
            <span className="text-xs text-muted">or with email</span>
            <span className="h-px flex-1 bg-default-200" />
          </div>
          <TextField
            isRequired
            isDisabled={busy}
            name="name"
            validate={(value) =>
              value.trim().length >= 2 ? null : "Enter your full name"
            }
            value={name}
            onChange={setName}
          >
            <Label>Full name</Label>
            <Input autoComplete="name" autoFocus placeholder="Your name" />
            <FieldError />
          </TextField>
          <TextField
            isRequired
            isDisabled={busy}
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
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <PasswordField
                autoComplete="new-password"
                disabled={busy}
                label="Password"
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
              disabled={busy}
              label="Confirm password"
              name="confirmPassword"
              placeholder="Repeat it"
              validate={(value) =>
                value === password ? null : "Passwords do not match"
              }
              value={confirmPassword}
              onChange={setConfirmPassword}
            />
          </div>
        </Card.Content>
        <Card.Footer className="flex-col gap-3">
          <Button
            fullWidth
            className="h-12 rounded-full text-[15px]"
            isDisabled={busy}
            isPending={loading}
            type="submit"
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : null}
                {isPending ? "Creating account…" : "Create account"}
              </>
            )}
          </Button>
          <p className="text-center text-xs text-muted">
            By continuing you agree to the{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/terms"
            >
              Terms
            </Link>{" "}
            and{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/privacy"
            >
              Privacy Policy
            </Link>
            .
          </p>

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href={
                next !== "/"
                  ? `/login?next=${encodeURIComponent(next)}`
                  : "/login"
              }
            >
              Log in
            </Link>
          </p>
        </Card.Footer>
      </Form>
    </AuthShell>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
