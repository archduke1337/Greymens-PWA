// app/register/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardContent, Input, Link } from "@heroui/react";

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

function RegisterForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // OAuth is not configured yet — Google sign-up stays disabled until the
  // provider is set up. See the commented block below.
  // const [googleLoading, setGoogleLoading] = useState(false);
  const { register, user } = useAuth();
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
      setError("Password must be at least 8 characters long.");
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

  /*
  // TEMPORARILY DISABLED — enable once Google OAuth is configured.
  const handleGoogleSignup = async () => {
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
      const mapped = mapRegisterError(err);
      console.error("Google signup failed:", mapped);
      setError(mapped);
      setGoogleLoading(false);
    }
  };
  */

  return (
    <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      {/* Art panel */}
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
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
            <p className="text-sm text-muted">
              Takes a minute. A human reads every application after.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="register-name" className="text-sm font-medium">
                Full name
              </label>
              <Input
                id="register-name"
                type="text"
                autoComplete="name"
                placeholder="Your name"
                value={name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setName(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="register-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="register-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label htmlFor="register-password" className="text-sm font-medium">
                  Password
                </label>
                <Input
                  id="register-password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="register-confirm" className="text-sm font-medium">
                  Confirm password
                </label>
                <Input
                  id="register-confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Repeat it"
                  value={confirmPassword}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" isPending={loading} className="w-full rounded-full">
              Create account
            </Button>
          </form>

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
            onPress={handleGoogleSignup}
            isPending={googleLoading}
            isDisabled={loading || googleLoading}
          >
            Continue with Google
          </Button>
          */}

          <p className="text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href={next !== "/" ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="font-medium text-foreground underline underline-offset-4"
            >
              Log in
            </Link>
          </p>
        </CardContent>
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
