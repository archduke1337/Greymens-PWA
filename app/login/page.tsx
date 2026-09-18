// app/login/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import {
  Alert,
  Button,
  Card,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  TextField,
} from "@heroui/react";

function getSafeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function mapLoginError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
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
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // OAuth is not configured yet — Google sign-in stays disabled until the
  // provider is set up. See the commented block below.
  // const [googleLoading, setGoogleLoading] = useState(false);
  const { login, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

  // Already authenticated (verified context state, not a cookie that may be
  // forged): leave the auth page.
  useEffect(() => {
    if (user) router.push(next);
  }, [user, router, next]);

  useEffect(() => {
    if (searchParams.get("error") === "oauth_failed") {
      setError("Google sign-in didn't complete. Please try again.");
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push(next);
    } catch (err: unknown) {
      // Log the mapped message, never the raw error: auth errors can carry
      // the attempted identifier into console/log tooling.
      const mapped = mapLoginError(err);
      console.error("Login failed:", mapped);
      setError(mapped);
    } finally {
      setLoading(false);
    }
  };

  /*
  // TEMPORARILY DISABLED — enable once Google OAuth is configured.
  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      try {
        sessionStorage.setItem("post_auth_next", next);
      } catch {
        // Storage unavailable: callback falls back to "/".
      }
      await loginWithGoogle();
    } catch (err: unknown) {
      try {
        sessionStorage.removeItem("post_auth_next");
      } catch {
        // Ignore storage errors on the failure path too.
      }
      const mapped = mapLoginError(err);
      console.error("Google login failed:", mapped);
      setError(mapped);
      setGoogleLoading(false);
    }
  };
  */

  return (
    <div className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-14">
      {/* Compact art strip on small screens */}
      <figure className="overflow-hidden rounded-3xl border border-default-200/70 lg:hidden">
        <img
          src="/Assets/Objects/login.png"
          alt=""
          aria-hidden="true"
          loading="lazy"
          className="h-36 w-full object-cover object-top sm:h-44"
        />
      </figure>

      {/* Art panel on large screens */}
      <figure className="hidden space-y-3 lg:block">
        <div className="overflow-hidden rounded-3xl border border-default-200/70">
          <img
            src="/Assets/Objects/login.png"
            alt="A hand-drawn member puzzling over a Greymens login screen that reads trust but verify"
            className="w-full object-cover"
          />
        </div>
        <figcaption className="text-center text-sm text-muted">
          Trust but verify — including your own password.
        </figcaption>
      </figure>

      {/* Form */}
      <Card className="w-full">
        <Card.Header>
          <Card.Title>Welcome back</Card.Title>
          <Card.Description>Log in with your club email and password.</Card.Description>
        </Card.Header>
        <Form onSubmit={handleSubmit} validationBehavior="aria">
          <Card.Content className="space-y-4">
            <TextField
              isRequired
              isDisabled={loading}
              name="email"
              type="email"
              validate={(value) =>
                EMAIL_PATTERN.test(value) ? null : "Enter a valid email address"
              }
              value={email}
              onChange={setEmail}
            >
              <Label>Email</Label>
              <Input autoComplete="email" placeholder="you@example.com" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={loading}
              name="password"
              type="password"
              value={password}
              onChange={setPassword}
            >
              <Label>Password</Label>
              <Input
                autoComplete="current-password"
                placeholder="Your password"
              />
              <FieldError />
            </TextField>
            {error && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t log you in</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Card.Content>
          <Card.Footer className="flex-col gap-3">
            <Button
              className="w-full rounded-full"
              isDisabled={loading}
              isPending={loading}
              type="submit"
            >
              Log in
            </Button>

            {/*
            TEMPORARILY DISABLED — Google OAuth is not configured yet.
            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-default-200" />
              <span className="text-xs text-muted">OR</span>
              <span className="h-px flex-1 bg-default-200" />
            </div>
            <Button
              className="w-full rounded-full"
              variant="secondary"
              onPress={handleGoogleLogin}
              isPending={googleLoading}
              isDisabled={loading || googleLoading}
            >
              Continue with Google
            </Button>
            */}

            <p className="text-center text-sm text-muted">
              New here?{" "}
              <Link
                href={next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
          </Card.Footer>
        </Form>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
