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
      error={error}
      reset={reset}
      title="Projects Unavailable"
      description="We couldn't load the projects. Please try again."
    />
  );
}
