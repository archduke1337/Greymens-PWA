"use client";

import { usePermissions } from "@/context/PermissionContext";

/**
 * PermissionGate controls presentation only. It does not provide authorization
 * security — every action must still call requireCapability()/requireAdmin()
 * server-side.
 *
 * Usage:
 *   <PermissionGate capability="events:create">
 *     <CreateEventButton />
 *   </PermissionGate>
 */
export default function PermissionGate({
  capability,
  scope,
  fallback = null,
  children,
}: {
  capability: string;
  scope?: string;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission, loading, status } = usePermissions();

  if (loading) return null;
  const restricted = ["banned", "suspended", "deactivated"].includes(
    status as string,
  );

  if (restricted) return <>{fallback}</>;

  return hasPermission(capability, scope) ? <>{children}</> : <>{fallback}</>;
}
