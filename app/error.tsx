"use client";

import { useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
      <Card className="w-full max-w-lg border-none shadow-xl" shadow="lg">
        <CardBody className="text-center py-16 space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-danger-100 dark:bg-danger-900/30 flex items-center justify-center">
            <svg className="w-8 h-8 text-danger" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 17.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Something went wrong!</h1>
            <p className="text-default-500 max-w-sm mx-auto">
              An unexpected error occurred. Our team has been notified and we&apos;re working on it.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button
              color="primary"
              variant="solid"
              onPress={() => reset()}
            >
              Try Again
            </Button>
            <Button
              variant="flat"
              onPress={() => window.location.href = "/"}
            >
              Go Home
            </Button>
          </div>
          {process.env.NODE_ENV === "development" && error.digest && (
            <p className="text-xs text-default-400">
              Error digest: {error.digest}
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
