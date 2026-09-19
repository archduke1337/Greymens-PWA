// app/auth/failure/page.tsx
// OAuth failure callback: show an error with a way back to /auth.
"use client";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Alert, Button, Card } from "@heroui/react";

function FailureContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const detail = searchParams.get("error");

  return (
    <div className="mx-auto w-full max-w-md px-4 py-14 sm:px-6">
      <Card className="w-full">
        <Card.Header>
          <Card.Title>Sign-in failed</Card.Title>
          <Card.Description>
            The provider didn&apos;t complete sign-in. Nothing was changed.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <Alert role="alert" status="danger">
            <Alert.Indicator />
            <Alert.Content>
              <Alert.Title>Couldn&apos;t sign you in</Alert.Title>
              <Alert.Description>
                {detail
                  ? `Provider said: ${detail}`
                  : "Please try again, or use your email and password instead."}
              </Alert.Description>
            </Alert.Content>
          </Alert>
        </Card.Content>
        <Card.Footer className="flex-col gap-3">
          <Button
            fullWidth
            className="rounded-full"
            onPress={() => router.push("/auth")}
          >
            Back to sign in
          </Button>
          <Button
            fullWidth
            className="rounded-full"
            variant="secondary"
            onPress={() => router.push("/login")}
          >
            Use email instead
          </Button>
        </Card.Footer>
      </Card>
    </div>
  );
}

export default function AuthFailurePage() {
  return (
    <Suspense>
      <FailureContent />
    </Suspense>
  );
}
