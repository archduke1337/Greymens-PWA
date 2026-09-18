// app/register/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import GitHubIcon from "@/components/auth/GitHubIcon";
import {
  Alert,
  Button,
  Card,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  Link,
  Spinner,
  TextField,
} from "@heroui/react";

function getSafeNext(next: string | null): string {
  if (!next) return "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

function mapRegisterError(err: unknown): string {
  const message = err instanceof Error ? err.message.toLowerCase() : "";
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
  const [githubLoading, setGithubLoading] = useState(false);
  const { register, loginWithGithub, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

  // Already authenticated: leave (see login page — proxy no longer bounces).
  useEffect(() => {
    if (user) router.push(next);
  }, [user, router, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

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
      await register(email, password, name);
      router.push(next);
    } catch (err: unknown) {
      const mapped = mapRegisterError(err);
      console.error("Registration failed:", mapped);
      setError(mapped);
    } finally {
      setLoading(false);
    }
  };

  const handleGithubSignup = async () => {
    setError("");
    setGithubLoading(true);
    try {
      try {
        sessionStorage.setItem("post_auth_next", next);
      } catch {
        // Storage unavailable: callback falls back to "/dashboard".
      }
      // Token flow: navigates to GitHub; /auth/success creates the session.
      await loginWithGithub();
    } catch (err: unknown) {
      try {
        sessionStorage.removeItem("post_auth_next");
      } catch {
        // Ignore storage errors on the failure path too.
      }
      const mapped = mapRegisterError(err);
      console.error("GitHub signup failed:", mapped);
      setError(mapped);
      setGithubLoading(false);
    }
  };

  return (
    <div className="mx-auto grid w-full max-w-5xl items-center gap-6 px-4 py-10 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:py-14">
      {/* Compact art strip on small screens */}
      <figure className="overflow-hidden rounded-3xl border border-default-200/70 lg:hidden">
        <img
          src="/Assets/Objects/register.png"
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
            src="/Assets/Objects/register.png"
            alt="A hand-drawn newcomer filling in the Greymens register: curious, willing to learn, not here just for a certificate"
            className="w-full object-cover"
          />
        </div>
        <figcaption className="text-center text-sm text-muted">
          One more hacker in the making? Could be you.
        </figcaption>
      </figure>

      {/* Form */}
      <Card className="w-full">
        <Card.Header>
          <Card.Title>Create your account</Card.Title>
          <Card.Description>
            Takes a minute. A human reads every application after.
          </Card.Description>
        </Card.Header>
        <Form onSubmit={handleSubmit} validationBehavior="aria">
          <Card.Content className="space-y-4">
            <TextField
              isRequired
              isDisabled={loading || githubLoading}
              name="name"
              validate={(value) =>
                value.trim().length >= 2 ? null : "Enter your full name"
              }
              value={name}
              onChange={setName}
            >
              <Label>Full name</Label>
              <Input autoComplete="name" placeholder="Your name" />
              <FieldError />
            </TextField>
            <TextField
              isRequired
              isDisabled={loading || githubLoading}
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
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                isRequired
                isDisabled={loading || githubLoading}
                name="password"
                type="password"
                validate={(value) =>
                  value.length >= 8 ? null : "Password must be at least 8 characters."
                }
                value={password}
                onChange={setPassword}
              >
                <Label>Password</Label>
                <Input
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                />
                <Description>At least 8 characters.</Description>
                <FieldError />
              </TextField>
              <TextField
                isRequired
                isDisabled={loading || githubLoading}
                name="confirmPassword"
                type="password"
                validate={(value) =>
                  value === password ? null : "Passwords do not match"
                }
                value={confirmPassword}
                onChange={setConfirmPassword}
              >
                <Label>Confirm password</Label>
                <Input autoComplete="new-password" placeholder="Repeat it" />
                <FieldError />
              </TextField>
            </div>
            {error && (
              <Alert role="alert" status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn&apos;t create your account</Alert.Title>
                  <Alert.Description>{error}</Alert.Description>
                </Alert.Content>
              </Alert>
            )}
          </Card.Content>
          <Card.Footer className="flex-col gap-3">
            <Button
              fullWidth
              className="rounded-full"
              isDisabled={loading || githubLoading}
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

            <div className="flex items-center gap-3" aria-hidden="true">
              <span className="h-px flex-1 bg-default-200" />
              <span className="text-xs text-muted">OR</span>
              <span className="h-px flex-1 bg-default-200" />
            </div>
            <Button
              fullWidth
              className="rounded-full"
              variant="secondary"
              onPress={handleGithubSignup}
              isPending={githubLoading}
              isDisabled={loading || githubLoading}
            >
              {({ isPending }) => (
                <>
                  {isPending ? (
                    <Spinner color="current" size="sm" />
                  ) : (
                    <GitHubIcon />
                  )}
                  {isPending ? "Connecting to GitHub…" : "Continue with GitHub"}
                </>
              )}
            </Button>

            <p className="text-center text-sm text-muted">
              Already have an account?{" "}
              <Link
                href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
                className="font-medium text-foreground underline underline-offset-4"
              >
                Log in
              </Link>
            </p>
          </Card.Footer>
        </Form>
      </Card>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
