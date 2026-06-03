// app/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardContent, CardFooter, CardHeader, Input, Link } from "@heroui/react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await login(email, password);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to login. Please check your credentials.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    try {
      loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to login with Google");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 items-start">
          <h1 className="text-2xl font-bold">Welcome Back</h1>
          <p className="text-small text-default-500">Login to your Mind Mesh account</p>
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
            variant="secondary"
            className="w-full"
          >
            Continue with Google
          </Button>
        </CardContent>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-small text-center">
            Don't have an account?{" "}
            <Link href="/register">
              Sign up
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}