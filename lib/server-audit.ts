import { ID, type Models } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getClientAddress } from "@/lib/rate-limit";
import { getMembershipStatus } from "@/lib/server-auth";

const MAX_DETAILS_LENGTH = 5000;

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
    const { databases } = createAdminClient();
    const actorRole = await getMembershipStatus(entry.actor);
    const details = entry.details ? JSON.stringify(entry.details).slice(0, MAX_DETAILS_LENGTH) : null;

    await databases.createDocument(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, ID.unique(), {
      actorId: entry.actor.$id,
      actorName: entry.actor.name || "Unknown",
      actorRole,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId,
      details,
      ipAddress: getClientAddress(entry.request).slice(0, 45),
      userAgent: (entry.request.headers.get("user-agent") || "").slice(0, 500),
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    console.error("Audit write failed:", error);
    return false;
  }
}
