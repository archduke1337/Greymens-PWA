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
      error={error}
      reset={reset}
      title="Events Unavailable"
      description="We couldn't load the events. Please try again."
    />
  );
}
