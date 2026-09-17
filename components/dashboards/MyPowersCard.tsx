"use client";

import { ZapIcon } from "lucide-react";
import { usePermissions } from "@/context/PermissionContext";

/**
 * Powers granted to the signed-in member, shown on their own dashboard.
 * Renders nothing when the member holds no active, unexpired powers — a
 * grant is visible to its holder and only to its holder.
 *
 * Source is the permission context (own active grants + catalogue), so no
 * extra fetch: the data already arrives with every authenticated session.
 * Expired grants are hidden even if a stale row lingers, matching the
 * server engine which enforces expiry on every check.
 */
export default function MyPowersCard() {
  const { userPowers, allPowers, allDepartments } = usePermissions();

  const now = Date.now();
  const live = userPowers.filter(
    (grant) =>
      grant.isActive !== false &&
      (!grant.expiresAt || new Date(grant.expiresAt).getTime() > now),
  );
  if (live.length === 0) return null;

  const powerById = new Map(allPowers.map((power) => [power.$id, power]));
  const deptName = (departmentId?: string) =>
    allDepartments.find((dept) => dept.$id === departmentId)?.name;

  return (
    <section
      aria-label="My granted powers"
      className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-6"
    >
      <div className="flex items-center gap-2 mb-1">
        <ZapIcon className="w-5 h-5 text-amber-500" />
        <h2 className="text-lg font-semibold">My Powers</h2>
        <span className="text-xs text-default-400">
          {live.length} active
        </span>
      </div>
      <p className="text-sm text-default-500 mb-4">
        Granted by the administration. Revocation takes effect immediately.
      </p>
      <ul className="space-y-2">
        {live.map((grant) => {
          const catalogue = powerById.get(grant.powerId);
          const scope = grant.departmentId
            ? (deptName(grant.departmentId) ?? "Department")
            : "Global";
          return (
            <li
              key={grant.$id ?? `${grant.powerId}-${grant.departmentId ?? "global"}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-default-200 bg-background/60 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold">
                  {catalogue?.displayName || catalogue?.name || grant.powerId}
                </p>
                {catalogue?.description && (
                  <p className="text-xs text-default-500 truncate max-w-md">
                    {catalogue.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-default-500">
                <span className="rounded-full bg-default-100 px-2 py-0.5">
                  {scope}
                </span>
                <span>
                  {grant.expiresAt
                    ? `Expires ${new Date(grant.expiresAt).toLocaleDateString()}`
                    : "No expiry"}
                </span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
