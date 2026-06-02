"use client";

import RouteError from "@/components/RouteError";

export default function BlogError({
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
      title="Blog Unavailable"
      description="We couldn't load the blog posts. Please try again."
    />
  );
}
