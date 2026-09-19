// app/auth/page.tsx
// Signed-out auth screen: the first-party entry point for OAuth.
// Guard: verified session state redirects to /dashboard before rendering UI.
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Alert, Button, Card, Link, Spinner } from "@heroui/react";

import { useAuth } from "@/context/AuthContext";
import GitHubIcon from "@/components/auth/GitHubIcon";
import GoogleIcon from "@/components/auth/GoogleIcon";
import { logError } from "@/lib/logger";

function AuthScreen() {
  const { user, loading, loginWithGithub, loginWithGoogle } = useAuth();
  const router = useRouter();
  const [githubLoading, setGithubLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState("");

  // Guard: already signed in → dashboard. Runs on verified context state
  // (account.get()), never on a forgeable cookie.
  useEffect(() => {
    if (!loading && user) router.push("/dashboard");
  }, [user, loading, router]);

  const stashNext = () => {
    try {
      sessionStorage.setItem("post_auth_next", "/dashboard");
    } catch {
      // Storage unavailable: success callback falls back to "/dashboard".
    }
  };

  const clearNext = () => {
    try {
      sessionStorage.removeItem("post_auth_next");
    } catch {
      // Ignore storage errors on the failure path too.
    }
  };

  const handleGoogleSignIn = async () => {
    setError("");
    setGoogleLoading(true);
    try {
      stashNext();
      // Token flow: navigates to Google; do not redirect manually.
      await loginWithGoogle();
    } catch (err: unknown) {
      clearNext();
      logError("Google sign-in failed:", err);
      setError("Google sign-in didn't start. Please try again.");
      setGoogleLoading(false);
    }
  };

  const handleGithubSignIn = async () => {
    setError("");
    setGithubLoading(true);
    try {
      stashNext();
      // Token flow: navigates to GitHub; do not redirect manually.
      await loginWithGithub();
    } catch (err: unknown) {
      clearNext();
      logError("GitHub sign-in failed:", err);
      setError("GitHub sign-in didn't start. Please try again.");
      setGithubLoading(false);
    }
  };

  const busy = githubLoading || googleLoading;

  if (loading || user) {
    return (
      <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
        <div
          aria-label="Checking session"
          className="space-y-4 text-center"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-muted">Checking your session…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <Card className="w-full">
        <Card.Header>
          <Card.Title>Sign in to Greymens</Card.Title>
          <Card.Description>
            Use your Google or GitHub account — or continue with email instead.
          </Card.Description>
        </Card.Header>
        <Card.Content className="space-y-4">
          {error && (
            <Alert role="alert" status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Couldn&apos;t start sign-in</Alert.Title>
                <Alert.Description>{error}</Alert.Description>
              </Alert.Content>
            </Alert>
          )}
        </Card.Content>
        <Card.Footer className="flex-col gap-3">
          <Button
            fullWidth
            className="rounded-full"
            isDisabled={busy}
            isPending={googleLoading}
            variant="tertiary"
            onPress={handleGoogleSignIn}
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <GoogleIcon />
                )}
                {isPending ? "Connecting to Google…" : "Sign in with Google"}
              </>
            )}
          </Button>
          <Button
            fullWidth
            className="rounded-full"
            isDisabled={busy}
            isPending={githubLoading}
            variant="tertiary"
            onPress={handleGithubSignIn}
          >
            {({ isPending }) => (
              <>
                {isPending ? (
                  <Spinner color="current" size="sm" />
                ) : (
                  <GitHubIcon />
                )}
                {isPending ? "Connecting to GitHub…" : "Sign in with GitHub"}
              </>
            )}
          </Button>
          <div aria-hidden="true" className="flex items-center gap-3">
            <span className="h-px flex-1 bg-default-200" />
            <span className="text-xs text-muted">or</span>
            <span className="h-px flex-1 bg-default-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Button
              fullWidth
              className="rounded-full"
              variant="secondary"
              onPress={() => router.push("/login?next=/dashboard")}
            >
              Email login
            </Button>
            <Button
              fullWidth
              className="rounded-full"
              variant="secondary"
              onPress={() => router.push("/register?next=/dashboard")}
            >
              Register
            </Button>
          </div>
          <p className="text-center text-sm text-muted">
            Stuck?{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/login"
            >
              Back to login
            </Link>
          </p>
        </Card.Footer>
      </Card>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense>
      <AuthScreen />
    </Suspense>
  );
}
