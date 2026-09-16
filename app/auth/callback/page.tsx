// app/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function AuthCallbackPage() {
  const router = useRouter();
  const { refreshUser } = useAuth();

  useEffect(() => {
    let cancelled = false;

    const resolveSession = async () => {
      // OAuth session cookies may not be readable on the very first check,
      // so retry refreshUser() a few times before treating a null user as a
      // real failure.
      for (let attempt = 0; attempt < 3; attempt++) {
        const currentUser = await refreshUser().catch(() => null);
        if (cancelled) return;
        if (currentUser) {
          router.push("/");
          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (!cancelled) {
        router.push("/login");
      }
    };

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
        <p className="mt-4 text-default-500">Completing sign in...</p>
      </div>
    </div>
  );
}
