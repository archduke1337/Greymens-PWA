import { ID, type Models } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getClientAddress } from "@/lib/rate-limit";
import { getMembershipStatus } from "@/lib/server-auth";
import { logError } from "@/lib/logger";

const MAX_DETAILS_LENGTH = 5000;
const MAX_DETAIL_STRING = 1000;

/**
 * Serialize audit details so the stored value stays valid JSON in practice.
 *
 * A flat slice of the stringified object can cut mid-token and store broken
 * JSON that forensic tooling then cannot parse, so long strings are truncated
 * per-value first. The outer slice remains only as a last-resort size guard
 * for pathological key counts.
 */
function serializeDetails(details: Record<string, unknown>): string {
  const trimmed: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(details)) {
    // Redact email-shaped values centrally: audit details flow from dozens of
    // call sites and per-site redaction never happens (see wiki drift note).
    const redacted =
      typeof value === "string" && value.includes("@")
        ? value.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[redacted]")
        : value;

    trimmed[key] =
      typeof redacted === "string" && redacted.length > MAX_DETAIL_STRING
        ? `${redacted.slice(0, MAX_DETAIL_STRING)}…(truncated)`
        : redacted;
  }
  const serialized = JSON.stringify(trimmed);

  return serialized.length > MAX_DETAILS_LENGTH
    ? `${serialized.slice(0, MAX_DETAILS_LENGTH)}…(truncated)`
    : serialized;
}

export interface AuditEntry {
  request: Request;
  actor: Models.User<Models.Preferences>;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown>;
}

/**
 * Write an audit record from inside an API route.
 *
 * Actor identity is derived from the verified session, never from the request
 * body, so a caller cannot attribute an action to somebody else.
 *
 * A failure here is logged and swallowed rather than surfaced. By the time this
 * runs, the mutation it describes has already been applied, so failing the
 * request would tell the caller their action did not happen when it did. The
 * trade-off is deliberate: an unlogged administrative action is bad, but a
 * response that misreports the state of the database is worse.
 */
export async function recordAudit(entry: AuditEntry): Promise<boolean> {
  try {
    const { databases } = createServerDatabases();
    const actorRole = await getMembershipStatus(entry.actor);
    const details = entry.details ? serializeDetails(entry.details) : null;

    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.AUDIT_LOGS,
      ID.unique(),
      {
        actorId: entry.actor.$id,
        actorName: entry.actor.name || "Unknown",
        actorRole,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        details,
        ipAddress: getClientAddress(entry.request).slice(0, 45),
        userAgent: (entry.request.headers.get("user-agent") || "").slice(
          0,
          500,
        ),
        timestamp: new Date().toISOString(),
      },
    );

    return true;
  } catch (error) {
    logError("Audit write failed:", error);

    return false;
  }
}
