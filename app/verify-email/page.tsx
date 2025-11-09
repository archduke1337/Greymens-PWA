// app/verify-email/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { account } from "@/lib/appwrite";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import NextLink from "next/link";

export const dynamic = "force-dynamic";

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const verifyEmail = async () => {
      try {
        const userId = searchParams.get("userId");
        const secret = searchParams.get("secret");

        console.log("Verification params:", { userId, secret: secret?.substring(0, 20) + "..." });

        if (!userId || !secret) {
          setStatus("error");
          setErrorMessage("Missing verification parameters");
          return;
        }

        // Call Appwrite verification
        await account.updateVerification(userId, secret);
        
        console.log("Verification successful!");
        setStatus("success");

        // Redirect to profile after 3 seconds
        setTimeout(() => {
          router.push("/profile");
        }, 3000);

      } catch (error) {
        console.error("Verification error:", error);
        setStatus("error");
        const errorMessage = error instanceof Error 
          ? error.message 
          : "Verification failed. The link may have expired.";
        setErrorMessage(errorMessage);
      }
    };

    verifyEmail();
  }, [searchParams, router]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col gap-1 items-center">
          {status === "loading" && (
            <>
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
              <h2 className="text-xl font-bold mt-4">Verifying Your Email</h2>
            </>
          )}
          {status === "success" && (
            <>
              <div className="text-success text-6xl">✓</div>
              <h2 className="text-xl font-bold mt-4 text-success">Email Verified!</h2>
            </>
          )}
          {status === "error" && (
            <>
              <div className="text-danger text-6xl">✗</div>
              <h2 className="text-xl font-bold mt-4 text-danger">Verification Failed</h2>
            </>
          )}
        </CardHeader>
        
        <CardBody className="text-center gap-4">
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
                as={NextLink}
                href="/profile"
                color="primary"
                className="mt-4"
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
              <div className="flex gap-2 justify-center mt-4">
                <Button
                  as={NextLink}
                  href="/settings"
                  color="primary"
                  variant="flat"
                >
                  Go to Settings
                </Button>
                <Button
                  as={NextLink}
                  href="/"
                  variant="light"
                >
                  Go Home
                </Button>
              </div>
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}