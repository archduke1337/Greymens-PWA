"use client";

import RouteError from "@/components/RouteError";

export default function ProjectsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <RouteError
      description="We couldn't load projects right now. Please try again."
      error={error}
      reset={reset}
      title="Projects Unavailable"
    />
  );
}
