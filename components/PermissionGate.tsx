"use client";

import { usePermissions } from "@/context/PermissionContext";

/**
 * PermissionGate controls presentation only. It does not provide authorization
 * security — every action must still call requireCapability()/requireAdmin()
 * server-side.
 *
 * Checks the capability vocabulary the server enforces (hasCapability) — the
 * only authority check the client has. The legacy permission set it used to
 * consult resolved a different vocabulary in the browser, so a gate written
 * against it hid controls from every office holder whose authority arrives as a
 * role, office, title or power grant.
 *
 * Usage:
 *   <PermissionGate capability="events.create">
 *     <CreateEventButton />
 *   </PermissionGate>
 */
export default function PermissionGate({
  capability,
  fallback = null,
  loadingFallback = null,
  children,
}: {
  capability: string;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasCapability, loading, status } = usePermissions();

  // Reserve space while permissions resolve instead of popping gated UI in
  // late; callers that care pass an explicit skeleton via loadingFallback.
  if (loading) return <>{loadingFallback}</>;
  const restricted = ["banned", "suspended", "deactivated"].includes(
    status as string,
  );

  if (restricted) return <>{fallback}</>;

  return hasCapability(capability) ? <>{children}</> : <>{fallback}</>;
}
