// app/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import NextLink from "next/link";

import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardContent, CardFooter, CardHeader, Input, Link } from "@heroui/react";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { register, loginWithGoogle } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      await register(email, password, name);
      router.push("/");
    } catch (err: any) {
      setError(err.message || "Failed to create account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignup = () => {
    try {
      loginWithGoogle();
    } catch (err: any) {
      setError(err.message || "Failed to sign up with Google");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <Card.Header className="flex flex-col gap-1 items-start">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-small text-default-500">Sign up for Mind Mesh</p>
        </Card.Header>
        <Card.Content>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              placeholder="Enter your name"
              type="text"
              value={name}
              onChange={(e: any) => setName(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e: any) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              placeholder="Create a password (min 8 characters)"
              type="password"
              value={password}
              onChange={(e: any) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
            <Input
              placeholder="Confirm your password"
              type="password"
              value={confirmPassword}
              onChange={(e: any) => setConfirmPassword(e.target.value)}
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
              Create Account
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
        </Card.Content>
        <Card.Footer className="flex flex-col gap-2">
          <div className="text-small text-center">
            Already have an account?{" "}
            <Link href="/login">
              Login
            </Link>
          </div>
        </Card.Footer>
      </Card>
    </div>
  );
}