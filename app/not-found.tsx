"use client";

import { useRouter } from "next/navigation";
import { Button, Card, CardContent } from "@heroui/react";

export default function NotFound() {
  const router = useRouter();

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)] px-4">
      <Card className="w-full max-w-lg border-none shadow-xl">
        <CardContent className="text-center py-16 space-y-6">
          <div className="text-8xl font-black bg-gradient-to-r from-purple-600 to-pink-500 bg-clip-text text-transparent">
            404
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Page Not Found</h1>
            <p className="text-default-500">
              The page you&apos;re looking for doesn&apos;t exist or has been moved.
            </p>
          </div>
          <div className="flex gap-3 justify-center">
            <Button variant="primary"
              onPress={() => router.push("/")}
            >
              Go Home
            </Button>
            <Button
              variant="primary"
              onPress={() => router.back()}
            >
              Go Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
