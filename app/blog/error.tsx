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
      description="We couldn't load the blog right now. Your drafts are safe — please try again."
      error={error}
      reset={reset}
      title="Blog Unavailable"
    />
  );
}
