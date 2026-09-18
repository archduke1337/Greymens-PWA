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
      description="We couldn't load this page. Please try again."
      error={error}
      reset={reset}
      title="Something went wrong"
    />
  );
}
