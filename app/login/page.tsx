// app/login/page.tsx
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
import { logError } from "@/lib/logger";

function getSafeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";

  return next;
}

function mapLoginError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : "";

  // Already user-facing (thrown by AuthContext after a verified session
  // could not be read back): show verbatim instead of generic-mapping it.
  if (
    message.includes("could not be verified") ||
    message.includes("try logging in")
  ) {
    return err instanceof Error ? err.message : "Please try again.";
  }
  if (
    message.includes("blocked") ||
    message.includes("suspended") ||
    message.includes("deactivated")
  ) {
    return "This account has been blocked. Contact the club if you think this is a mistake.";
  }
  if (
    message.includes("rate limit") ||
    message.includes("ratelimited") ||
    message.includes("too many")
  ) {
    return "Too many attempts. Wait a minute and try again.";
  }
  if (message.includes("not verified") || message.includes("verify")) {
    return "Verify your email first — check your inbox for the link, then log in.";
  }
  if (
    message.includes("invalid credential") ||
    message.includes("invalid email") ||
    message.includes("incorrect") ||
    message.includes("unauthorized") ||
    message.includes("user not found") ||
    message.includes("no account")
  ) {
    return "Incorrect email or password.";
  }
  if (
    message.includes("network") ||
    message.includes("failed to fetch") ||
    message.includes("fetch failed") ||
    message.includes("load failed")
  ) {
    return "Network error. Check your connection and retry.";
  }

  return "Something went wrong. Please try again.";
}

const EMAIL_PATTERN = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [githubLoading, setGithubLoading] = useState(false);
  const { login, loginWithGithub, loginWithGoogle, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));
  // Derived once at mount: the params are stable for this page instance, and
  // reading them here avoids a setState-in-effect cascade on load.
  const [error, setError] = useState(
    searchParams.get("error") === "oauth_failed"
      ? "Sign-in didn't complete. Please try again."
      : "",
  );
  const busy = loading || googleLoading || githubLoading;

  // Already authenticated (verified context state, not a cookie that may be
  // forged): leave the auth page.
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

    // A trailing space from autocomplete is the classic "correct password,
    // rejected anyway" report — trim the identifier, never the secret.
    const cleanEmail = email.trim();

    setLoading(true);

    try {
      await login(cleanEmail, password);
      router.push(next);
    } catch (err: unknown) {
      // Log the mapped message, never the raw error: auth errors can carry
      // the attempted identifier into console/log tooling.
      const mapped = mapLoginError(err);

      logError("Login failed:", mapped);
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
        const mapped = mapLoginError(err);

        logError(
          provider === "google"
            ? "Google login failed:"
            : "GitHub login failed:",
          mapped,
        );
        setError(mapped);
        if (provider === "google") setGoogleLoading(false);
        else setGithubLoading(false);
      }
    };

  const handleGoogleLogin = startProvider("google", loginWithGoogle);
  const handleGithubLogin = startProvider("github", loginWithGithub);

  return (
    <AuthShell
      artAlt="A hand-drawn member puzzling over a Greymens login screen that reads trust but verify"
      artSrc="/Assets/Objects/login.png"
      caption="Trust but verify — including your own password."
      description="Continue with Google or GitHub — or use your club email."
      title="Welcome back"
    >
      <Form validationBehavior="aria" onSubmit={handleSubmit}>
        <Card.Content className="space-y-4">
          {error && (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Couldn&apos;t log you in</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
          <ProviderButtons
            disabled={busy}
            githubPending={githubLoading}
            googlePending={googleLoading}
            mode="login"
            onGitHub={handleGithubLogin}
            onGoogle={handleGoogleLogin}
          />
          <div aria-hidden="true" className="flex items-center gap-3">
            <span className="h-px flex-1 bg-default-200" />
            <span className="text-xs text-muted">or with email</span>
            <span className="h-px flex-1 bg-default-200" />
          </div>
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
          <PasswordField
            autoComplete="current-password"
            disabled={busy}
            label="Password"
            name="password"
            placeholder="Your password"
            value={password}
            onChange={setPassword}
          />
          <div className="text-right">
            <Link
              className="text-sm font-medium text-foreground underline underline-offset-4"
              href="/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
        </Card.Content>
        <Card.Footer className="flex-col gap-3">
          <Button
            fullWidth
            className="rounded-full"
            isDisabled={busy}
            isPending={loading}
            type="submit"
          >
            {({ isPending }) => (
              <>
                {isPending ? <Spinner color="current" size="sm" /> : null}
                {isPending ? "Logging in…" : "Log in"}
              </>
            )}
          </Button>

          <p className="text-center text-sm text-muted">
            New here?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href={
                next !== "/"
                  ? `/register?next=${encodeURIComponent(next)}`
                  : "/register"
              }
            >
              Create an account
            </Link>
          </p>
        </Card.Footer>
      </Form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
