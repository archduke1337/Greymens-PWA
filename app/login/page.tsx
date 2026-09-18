// app/login/page.tsx
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
    <div className="mx-auto grid w-full max-w-5xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-2">
      {/* Art panel */}
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
        <CardContent className="space-y-5 p-6 sm:p-8">
          <div className="space-y-1.5">
            <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted">
              Log in with your club email and password.
            </p>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="login-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="login-password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                placeholder="Your password"
                value={password}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            {error && (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            )}
            <Button type="submit" isPending={loading} className="w-full rounded-full">
              Log in
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
        </CardContent>
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
