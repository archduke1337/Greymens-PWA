// app/verify-email/page.tsx
"use client";

import { Suspense } from "react";
import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { account } from "@/lib/appwrite";
import { useAuth } from "@/context/AuthContext";
import { Button, Card, CardContent, CardHeader } from "@heroui/react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const [resendError, setResendError] = useState("");

  const handleResend = async () => {
    setResendLoading(true);
    setResendError("");
    setResendSent(false);
    try {
      await account.createEmailVerification({ url: `${window.location.origin}/verify-email` });
      setResendSent(true);
    } catch (error) {
      console.error("Resend verification error:", error);
      setResendError(
        error instanceof Error && error.message
          ? error.message
          : "Failed to resend verification email. Please try again.",
      );
    } finally {
      setResendLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    let redirectTimer: ReturnType<typeof setTimeout> | null = null;
    const verifyEmail = async () => {
      try {
        const userId = searchParams.get("userId");
        const secret = searchParams.get("secret");

        if (!userId || !secret) {
          if (!cancelled) {
            setStatus("error");
            setErrorMessage("Missing verification parameters");
          }
          return;
        }

        // Call Appwrite verification
        await account.updateEmailVerification({ userId, secret });

        if (cancelled) return;
        setStatus("success");

        try {
          await refreshUser();
        } catch {
          // Non-blocking: profile redirect still applies.
        }

        // Redirect to profile after 3 seconds
        redirectTimer = setTimeout(() => {
          if (!cancelled) router.push("/profile");
        }, 3000);

      } catch (error) {
        if (cancelled) return;
        console.error("Verification error:", error);
        setStatus("error");
        const errorMessage = error instanceof Error
          ? error.message
          : "Verification failed. The link may have expired.";
        setErrorMessage(errorMessage);
      }
    };

    verifyEmail();
    return () => {
      cancelled = true;
      if (redirectTimer) clearTimeout(redirectTimer);
    };
  }, [searchParams, router, refreshUser]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 items-center">
          {status === "loading" && (
            <div role="status" aria-label="Verifying your email" className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" aria-hidden="true" />
              <h2 className="text-xl font-bold mt-4">Verifying Your Email</h2>
            </div>
          )}
          {status === "success" && (
            <>
              <div className="text-success text-6xl" aria-hidden="true">✓</div>
              <h2 className="text-xl font-bold mt-4 text-success">Email Verified!</h2>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-danger text-6xl" aria-hidden="true">✗</div>
              <h2 className="text-xl font-bold mt-4 text-danger">Verification Failed</h2>
            </>
          )}
        </CardHeader>
        
        <CardContent className="text-center gap-4">
          {status === "loading" && (
            <p className="text-default-500">
              Please wait while we verify your email address...
            </p>
          )}
          
          {status === "success" && (
            <>
              <p className="text-default-500">
                Your email has been successfully verified! You will be redirected to your profile shortly.
              </p>
              <Button
                className="mt-4"
                onPress={() => router.push("/profile")}
              >
                Go to Profile
              </Button>
            </>
          )}
          
          {status === "error" && (
            <>
              <p className="text-danger text-sm">
                {errorMessage}
              </p>
              <p className="text-default-500 text-sm mt-2">
                Please try requesting a new verification email from your settings page.
              </p>
              {resendSent && (
                <p className="text-success text-sm mt-2">
                  Verification email resent! Check your inbox.
                </p>
              )}
              {resendError && (
                <p className="text-danger text-sm mt-2">{resendError}</p>
              )}
              <div className="flex gap-2 justify-center mt-4 flex-wrap">
                <Button
                  variant="primary"
                  isPending={resendLoading}
                  onPress={handleResend}
                >
                  Resend verification email
                </Button>
                <Button
                  variant="primary"
                  onPress={() => router.push("/settings")}
                >
                  Go to Settings
                </Button>
                <Button
                  variant="ghost"
                  onPress={() => router.push("/")}
                >
                  Go Home
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Verifying your email...</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <VerifyEmailContent />
    </Suspense>
  );
}