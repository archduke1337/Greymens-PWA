"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@heroui/react";

import { useAuth } from "@/context/AuthContext";
import { logError } from "@/lib/logger";

/**
 * Sign-out confirmation.
 *
 * Logging out deletes the server session, so it must never happen as a side
 * effect of merely visiting a URL: a prefetched or forged navigation to
 * /logout would otherwise sign the visitor out without consent. The session
 * is deleted only after an explicit confirmation on this page.
 */
export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [failed, setFailed] = useState(false);

  const clearDeviceState = async () => {
    // Best-effort cache + service-worker cleanup on successful logout.
    // Must never block the redirect.
    try {
      if (typeof caches !== "undefined" && caches.keys) {
        const keys = await caches.keys().catch(() => [] as string[]);

        await Promise.all(
          (keys || []).map((key) => caches.delete(key).catch(() => false)),
        );
      }
    } catch {
      // ignore — best effort only
    }
    try {
      const registrations = await navigator.serviceWorker
        ?.getRegistrations()
        .catch(() => [] as ServiceWorkerRegistration[]);

      if (registrations) {
        await Promise.all(
          registrations.map((registration) =>
            registration.unregister().catch(() => false),
          ),
        );
      }
    } catch {
      // ignore — best effort only
    }
  };

  const handleLogout = async () => {
    setFailed(false);
    setSigningOut(true);
    try {
      await logout();
      await clearDeviceState();
      router.push("/");
    } catch (error) {
      logError("Logout failed:", error);
      // Stay on the page so the user can retry instead of being
      // bounced home while still signed in.
      setFailed(true);
      setSigningOut(false);
      toast.error("Logout failed. Please try again.");
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="text-center space-y-4 max-w-sm px-4">
        {signingOut && !failed ? (
          <>
            <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-default-500">Signing you out...</p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold">Sign out?</h1>
            <p className="text-default-500">
              You will be signed out on this device.
            </p>
            {failed && (
              <p className="text-danger">Logout failed. Please try again.</p>
            )}
            <div className="flex gap-3 justify-center">
              <Button
                type="button"
                variant="secondary"
                onPress={() => router.back()}
              >
                Stay signed in
              </Button>
              <Button type="button" variant="danger" onPress={handleLogout}>
                Sign out
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
