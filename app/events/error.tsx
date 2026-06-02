"use client";

import { useEffect } from "react";
import { Button } from "@heroui/button";
import { Card, CardBody } from "@heroui/card";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Events page error:", error);
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
            <h1 className="text-2xl font-bold">Events Unavailable</h1>
            <p className="text-default-500 max-w-sm mx-auto">
              We couldn&apos;t load the events. Please try again.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button color="primary" variant="solid" onPress={() => reset()}>
              Try Again
            </Button>
            <Button variant="flat" onPress={() => window.location.href = "/"}>
              Go Home
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
