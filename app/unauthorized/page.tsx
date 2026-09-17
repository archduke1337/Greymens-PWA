"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";

function UnauthorizedContent() {
  const { user, loading: authLoading, logout } = useAuth();
  const {
    status,
    capabilities,
    loading: permLoading,
    error: permError,
    refresh: refreshPermissions,
  } = usePermissions();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/dashboard";
  const safeFrom = from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard";
  const [checking, setChecking] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // If permissions resolve to an entitled state (e.g. a grant landed while
  // this page was open), leave on their own — no manual navigation needed.
  useEffect(() => {
    if (!authLoading && !permLoading && user && capabilities.length > 0) {
      router.push(safeFrom);
    }
  }, [authLoading, permLoading, user, capabilities, router, safeFrom]);

  const handleCheckAgain = async () => {
    setChecking(true);
    try {
      await refreshPermissions();
    } finally {
      setChecking(false);
    }
  };

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  };

  const loading = authLoading || permLoading;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen text-center px-4">
      <h1 className="text-3xl font-bold">Access Denied</h1>
      <p className="text-gray-500 mt-2 max-w-md">
        {loading
          ? "Checking your access…"
          : !user
            ? "You are not signed in. Sign in with an authorized account to continue."
            : permError
              ? `Your access could not be verified (${permError}). Nothing was denied — retry before assuming the worst.`
              : `This area needs a capability your account does not currently hold. If you believe this is a mistake, contact an administrator with the details below.`}
      </p>

      {!loading && user && (
        <dl className="mt-6 text-left text-sm bg-default-100 dark:bg-default-100/5 rounded-lg px-5 py-4 space-y-1.5 max-w-md w-full">
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Signed in as</dt>
            <dd className="font-medium truncate">{user.name || user.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Account status</dt>
            <dd className="font-medium">{status}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Capabilities</dt>
            <dd className="font-medium">
              {capabilities.length > 0 ? `${capabilities.length} granted` : "none"}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-gray-500">Requested page</dt>
            <dd className="font-mono text-xs truncate max-w-[220px]">{safeFrom}</dd>
          </div>
        </dl>
      )}

      <div className="flex gap-3 mt-6 flex-wrap justify-center">
        {!loading && user && (
          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={checking}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {checking ? "Checking…" : "Check again"}
          </button>
        )}
        <Link
          href="/dashboard"
          className="px-4 py-2 rounded-lg border hover:bg-default-100 text-sm font-medium transition-colors"
        >
          Go to Dashboard
        </Link>
        {!loading && user && (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="px-4 py-2 rounded-lg border hover:bg-default-100 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {signingOut ? "Signing out…" : "Sign out and switch account"}
          </button>
        )}
      </div>
    </div>
  );
}

export default function UnauthorizedPage() {
  return (
    <Suspense>
      <UnauthorizedContent />
    </Suspense>
  );
}
