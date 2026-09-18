// app/auth/success/page.tsx
// OAuth success callback (GitHub token flow).
// Reads `userId` + `secret` from the query string, awaits
// account.createSession(...), then redirects to the stored destination.
"use client";
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Spinner } from "@heroui/react";

import { account } from "@/lib/appwrite";
import { useAuth } from "@/context/AuthContext";
import { logError } from "@/lib/logger";

function getSafeNext(next: string | null): string {
  if (!next) return "/dashboard";
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";

  return next;
}

function SuccessHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    const handleOAuthSuccess = async () => {
      const url = new URL(window.location.href);
      // Appwrite appends these on the success redirect; useSearchParams
      // keeps this App Router-safe under Suspense.
      const secret =
        url.searchParams.get("secret") ?? searchParams.get("secret");
      const userId =
        url.searchParams.get("userId") ?? searchParams.get("userId");

      if (!secret || !userId) {
        if (!cancelled)
          setError("Missing OAuth credentials. Please try again.");

        return;
      }
      try {
        // Await the session before navigating or rendering dependent UI.
        await account.createSession({ userId, secret });
        await refreshUser().catch(() => null);
        if (cancelled) return;
        let next = "/dashboard";

        try {
          const stored = sessionStorage.getItem("post_auth_next");

          sessionStorage.removeItem("post_auth_next");
          next = getSafeNext(stored);
        } catch {
          // Storage unavailable: fall back to "/dashboard".
        }
        router.push(next);
      } catch (err) {
        logError("OAuth session creation failed:", err);
        if (!cancelled)
          setError("Could not complete sign-in. Please try again.");
      }
    };

    void handleOAuthSuccess();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router, searchParams]);

  if (error) {
    return (
      <div className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
        <Alert role="alert" status="danger">
          <Alert.Indicator />
          <Alert.Content>
            <Alert.Title>Sign-in didn&apos;t complete</Alert.Title>
            <Alert.Description>{error}</Alert.Description>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onPress={() => router.push("/auth")}>
                Back to sign in
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onPress={() => router.push("/login")}
              >
                Email login
              </Button>
            </div>
          </Alert.Content>
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-200px)] items-center justify-center">
      <div
        aria-label="Completing sign in"
        className="space-y-4 text-center"
        role="status"
      >
        <Spinner size="lg" />
        <p className="text-muted">Completing GitHub sign-in…</p>
      </div>
    </div>
  );
}

export default function AuthSuccessPage() {
  return (
    <Suspense>
      <SuccessHandler />
    </Suspense>
  );
}
