"use client";

import RouteError from "@/components/RouteError";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      error={error}
      reset={reset}
      title="Something went wrong"
      description="An unexpected error occurred. Our team has been notified and we're working on it."
    />
  );
}
