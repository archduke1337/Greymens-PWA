// app/login/page.tsx
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardContent, CardFooter, CardHeader, Input, Link } from "@heroui/react";

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
    return "Incorrect email or password";
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
  const [googleLoading, setGoogleLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = getSafeNext(searchParams.get("next"));

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
    } catch (err: any) {
      console.error(err);
      setError(mapLoginError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      console.error(err);
      setError(mapLoginError(err));
      setGoogleLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 items-start">
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-small text-default-500">Login to your Greymens account</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              placeholder="Enter your password"
              type="password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            {error && (
              <div className="text-danger text-small">{error}</div>
            )}
            <Button
              type="submit"
              isPending={loading}
              className="w-full"
            >
              Login
            </Button>
          </form>

          <div className="relative flex py-5 items-center">
            <div className="flex-grow border-t border-divider"></div>
            <span className="flex-shrink mx-4 text-default-400 text-small">OR</span>
            <div className="flex-grow border-t border-divider"></div>
          </div>

          <Button
            className="w-full"
            variant="outline"
            onPress={handleGoogleLogin}
            isPending={googleLoading}
            isDisabled={loading || googleLoading}
          >
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-small text-center">
            Don&apos;t have an account?{" "}
            <Link href={next !== "/" ? `/register?next=${encodeURIComponent(next)}` : "/register"}>
              Sign up
            </Link>
          </div>
        </CardFooter>
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