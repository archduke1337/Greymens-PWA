import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import { readOptionalString } from "@/lib/validation";
import { ok, fail } from "@/lib/api";

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

/**
 * Avatar lookup for the actors on the current page: one bounded profiles
 * query so the audit table can show uploaded pictures instead of initials.
 * Best-effort — a lookup failure returns an empty map, never fails the log.
 */
async function actorAvatarMap(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  logs: Array<Record<string, unknown>>,
): Promise<Record<string, string>> {
  const actorIds = [...new Set(logs.map((log) => String(log.actorId ?? "")).filter(Boolean))];
  if (actorIds.length === 0) return {};
  try {
    const profiles = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
      Query.equal("userId", actorIds.slice(0, 100)),
      Query.limit(100),
    ]);
    const map: Record<string, string> = {};
    for (const profile of profiles.documents as Array<Record<string, unknown>>) {
      const avatar = String(profile.avatar ?? "");
      if (avatar) map[String(profile.userId ?? "")] = avatar;
    }
    return map;
  } catch {
    return {};
  }
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "audit.view");
  if (!authenticated.user) return authenticated.response;

  try {
    const params = request.nextUrl.searchParams;
    const rawPage = Number(params.get("page"));
    const rawLimit = Number(params.get("limit"));
    const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.min(100, Math.floor(rawPage)) : 0;
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))
      : DEFAULT_PAGE_SIZE;

    const action = readOptionalString(params.get("action"), 100);
    const entityType = readOptionalString(params.get("entityType"), 50);
    const entityId = readOptionalString(params.get("entityId"), 36);
    const actorId = readOptionalString(params.get("actorId"), 36);
    const from = readOptionalString(params.get("from"), 40);
    const to = readOptionalString(params.get("to"), 40);
    // Present-but-invalid filters must not silently widen into unfiltered
    // reads; reject them instead of ignoring them.
    if ([action, entityType, entityId, actorId, from, to].some((value) => value === null)) {
      return fail("VALIDATION", "Invalid query parameters", 400);
    }

    const queries: string[] = [];
    if (action) queries.push(Query.equal("action", [action]));
    if (entityType) queries.push(Query.equal("entityType", [entityType]));
    if (entityId) queries.push(Query.equal("entityId", [entityId]));
    if (actorId) queries.push(Query.equal("actorId", [actorId]));
    // `timestamp` is stored as an ISO-8601 string, so lexical comparison is
    // chronological and can be pushed into the query.
    if (from) queries.push(Query.greaterThanEqual("timestamp", from));
    if (to) queries.push(Query.lessThanEqual("timestamp", to));
    queries.push(Query.orderDesc("timestamp"));
    queries.push(Query.limit(limit));
    queries.push(Query.offset(page * limit));

    const { databases } = createServerDatabases();
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const [response, last24h] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, queries),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, [
        Query.greaterThanEqual("timestamp", since),
        Query.limit(1),
      ]),
    ]);

    return ok({
      logs: response.documents,
      total: response.total,
      stats: { total: response.total, last24h: last24h.total },
      page,
      limit,
      actorAvatars: await actorAvatarMap(databases, response.documents),
    });
  } catch (error) {
    console.error("Audit log lookup error:", error);
    return fail("INTERNAL", "Unable to load audit logs", 500);
  }
}
