import type { AuditLog } from "./types";

/**
 * Audit records are written server-side only (`recordAudit` in
 * lib/server-audit.ts writes direct to the table) and read through
 * `/api/audit` GET.
 *
 * They cannot be written from the browser SDK or any HTTP endpoint: the
 * `audit_logs` table grants no client permissions, and a previous
 * client-writable POST accepted arbitrary action/entity/details from any
 * account — letting the audited forge the forensic trail. It was removed;
 * actor identity always comes from the verified session.
 */

export interface AuditLogInput {
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
  /**
   * Ignored. Actor id, name and role are resolved server-side from the verified
   * session so an audit entry cannot be attributed to another account.
   * Retained only so existing call sites keep compiling.
   */
  actorId?: string;
  actorName?: string;
  actorRole?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogFilters {
  action?: string;
  entityType?: string;
  entityId?: string;
  actorId?: string;
  /** Inclusive ISO timestamp bounds. */
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

export interface AuditLogPage {
  logs: AuditLog[];
  total: number;
  stats: { total: number; last24h: number };
  actorAvatars: Record<string, string>;
}

async function fetchAuditLogs(filters: AuditLogFilters): Promise<AuditLogPage> {
  const params = new URLSearchParams();

  for (const key of ["action", "entityType", "entityId", "actorId", "from", "to"] as const) {
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (filters.page !== undefined) params.set("page", String(filters.page));
  if (filters.limit !== undefined) params.set("limit", String(filters.limit));

  const response = await fetch(`/api/audit?${params.toString()}`, { credentials: "include" });
  const payload = (await response.json().catch(() => null)) as
    | (Partial<AuditLogPage> & { error?: string })
    | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load audit logs");
  }

  return {
    logs: payload?.logs ?? [],
    total: payload?.total ?? 0,
    stats: payload?.stats ?? { total: 0, last24h: 0 },
    actorAvatars: payload?.actorAvatars ?? {},
  };
}

export const auditService = {
  async getLogs(filters?: AuditLogFilters): Promise<AuditLogPage> {
    return fetchAuditLogs(filters ?? {});
  },

  async getUserActivity(userId: string, limit = 50): Promise<AuditLog[]> {
    const { logs } = await fetchAuditLogs({ actorId: userId, limit });
    return logs;
  },
};
