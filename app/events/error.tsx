"use client";

import RouteError from "@/components/RouteError";

export default function EventsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="We couldn't load events right now. Please try again."
      error={error}
      reset={reset}
      title="Events Unavailable"
    />
  );
}
