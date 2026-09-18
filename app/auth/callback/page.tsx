// app/auth/callback/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

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
          // Password logins carry ?next=; OAuth left the site, so the login
          // page stashed the destination beforehand. Same-origin only.
          let next = "/";

          try {
            const stored = sessionStorage.getItem("post_auth_next");

            sessionStorage.removeItem("post_auth_next");
            if (stored && stored.startsWith("/") && !stored.startsWith("//"))
              next = stored;
          } catch {
            // Storage unavailable: fall back to "/".
          }
          router.push(next);

          return;
        }
        if (attempt < 2) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
        }
      }
      if (!cancelled) {
        router.push("/login?error=oauth_failed");
      }
    };

    void resolveSession();

    return () => {
      cancelled = true;
    };
  }, [refreshUser, router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div
        aria-label="Completing sign in"
        className="text-center space-y-4"
        role="status"
      >
        <Image
          alt=""
          aria-hidden="true"
          className="mx-auto h-24 w-24 rounded-3xl border border-default-200/70 object-cover"
          height={1280}
          src="/Assets/Media/yo-yo-globe.webp"
          width={1280}
        />
        <p className="text-default-500">
          Completing sign in — spinning the globe…
        </p>
      </div>
    </div>
  );
}
