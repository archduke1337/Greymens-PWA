'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useAuth } from '@/context/AuthContext';

export default function LogoutPage() {
  const { logout } = useAuth();
  const router = useRouter();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const handleLogout = async () => {
      try {
        await logout();
        if (cancelled) return;
        // Best-effort cache + service-worker cleanup on successful logout.
        // Must never block the redirect.
        try {
          if (typeof caches !== 'undefined' && caches.keys) {
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
        if (!cancelled) router.push('/');
      } catch (error) {
        console.error('Logout failed:', error);
        if (!cancelled) {
          // Stay on the page so the user can retry instead of being
          // bounced home while still signed in.
          setFailed(true);
          toast.error('Logout failed. Please try again.');
        }
      }
    };

    handleLogout();

    return () => {
      cancelled = true;
    };
  }, [logout, router]);

  const handleRetry = async () => {
    setFailed(false);
    try {
      await logout();
      try {
        if (typeof caches !== 'undefined' && caches.keys) {
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
      router.push('/');
    } catch (error) {
      console.error('Logout failed:', error);
      setFailed(true);
      toast.error('Logout failed. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
      <div className="text-center space-y-4">
        {failed ? (
          <>
            <p className="text-danger">Logout failed. Please try again.</p>
            <button
              type="button"
              onClick={handleRetry}
              className="text-sm font-medium underline underline-offset-4"
            >
              Try again
            </button>
          </>
        ) : (
          <>
            <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-default-500">Signing you out...</p>
          </>
        )}
      </div>
    </div>
  );
}
