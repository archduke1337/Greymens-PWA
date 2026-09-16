import type { AuditLog } from "./types";

/**
 * Audit records are written and read through `/api/audit`.
 *
 * They cannot be written from the browser SDK: the `audit_logs` table grants no
 * client permissions, and the actor identity must come from the verified
 * session rather than from client-supplied fields.
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
  };
}

export const auditService = {
  /**
   * Records an audit entry.
   *
   * Resolves to false when the entry could not be recorded. It deliberately does
   * not throw: the action being audited has already succeeded, so a failed audit
   * write must not be reported to the operator as a failed action. Failures are
   * logged for the server and, where it matters, surfaced by the caller.
   */
  async log(data: AuditLogInput): Promise<boolean> {
    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: data.action,
          entityType: data.entityType,
          entityId: data.entityId,
          details: data.details,
        }),
      });

      if (!response.ok) {
        console.error("Failed to record audit entry:", data.action, response.status);
        return false;
      }

      return true;
    } catch (error) {
      console.error("Failed to record audit entry:", data.action, error);
      return false;
    }
  },

  async getLogs(filters?: AuditLogFilters): Promise<AuditLogPage> {
    return fetchAuditLogs(filters ?? {});
  },

  async getUserActivity(userId: string, limit = 50): Promise<AuditLog[]> {
    const { logs } = await fetchAuditLogs({ actorId: userId, limit });
    return logs;
  },
};
