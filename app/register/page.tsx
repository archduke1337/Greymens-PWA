// app/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardHeader, CardBody, CardFooter } from "@heroui/card";
import { Input } from "@heroui/input";
import { Button } from "@heroui/button";
import { Link } from "@heroui/link";
import NextLink from "next/link";

import { useAuth } from "@/context/AuthContext";

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
        <CardHeader className="flex flex-col gap-1 items-start">
          <h1 className="text-2xl font-bold">Create Account</h1>
          <p className="text-small text-default-500">Sign up for Mind Mesh</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Name"
              placeholder="Enter your name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              isDisabled={loading}
            />
            <Input
              label="Email"
              placeholder="Enter your email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              isDisabled={loading}
            />
            <Input
              label="Password"
              placeholder="Create a password (min 8 characters)"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              isDisabled={loading}
            />
            <Input
              label="Confirm Password"
              placeholder="Confirm your password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              isDisabled={loading}
            />
            {error && (
              <div className="text-danger text-small">{error}</div>
            )}
            <Button
              type="submit"
              color="primary"
              isLoading={loading}
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
            variant="bordered"
            className="w-full"
            startContent={
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            }
            onPress={handleGoogleSignup}
          >
            Continue with Google
          </Button>
        </CardBody>
        <CardFooter className="flex flex-col gap-2">
          <div className="text-small text-center">
            Already have an account?{" "}
            <Link as={NextLink} href="/login" size="sm">
              Login
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}