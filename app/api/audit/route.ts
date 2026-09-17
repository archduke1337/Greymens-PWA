import { NextRequest, NextResponse } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import { isRecord, readOptionalString, readString } from "@/lib/validation";
import { ok, fail, ApiError } from "@/lib/api";

const MAX_DETAILS_LENGTH = 5000;
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

// Audit writes are frequent (one per mutation) but should never be unbounded.
const WRITE_RATE_LIMIT = 120;
const WRITE_RATE_WINDOW_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  // Restricted + Sybil guard: banned/suspended/deactivated cannot write forensics.
  const writerStatus = await getMembershipStatus(authenticated.user);
  if (["banned", "suspended", "deactivated"].includes(writerStatus)) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  const limited = consumeRateLimit(`audit:${authenticated.user.$id}`, WRITE_RATE_LIMIT, WRITE_RATE_WINDOW_MS);
  if (!limited.allowed) {
    return NextResponse.json({ success: false, error: { code: "RATE_LIMITED", message: "Too many audit writes. Please try again shortly." } }, { status: 429, headers: { "Retry-After": String(limited.retryAfter) } });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  if (!isRecord(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  const action = readString(body.action, 100);
  const entityType = readString(body.entityType, 50);
  const entityId = readString(body.entityId, 36);

  if (!action || !entityType || !entityId) {
    return fail("VALIDATION", "action, entityType, and entityId are required", 400);
  }

  let details: string | null = null;
  if (body.details !== undefined && body.details !== null) {
    if (!isRecord(body.details)) {
      return fail("VALIDATION", "Invalid details", 400);
    }
    const serialized = JSON.stringify(body.details);
    if (serialized.length > MAX_DETAILS_LENGTH) {
      return fail("VALIDATION", "Audit details are too large", 400);
    }
    details = serialized;
  }

  try {
    const { databases } = createServerDatabases();
    // Actor identity is taken from the verified session and the stored profile,
    // never from the request body, so a client cannot attribute an action to
    // somebody else.
    const actorRole = await getMembershipStatus(authenticated.user);
    const created = await databases.createDocument(DATABASE_ID, COLLECTIONS.AUDIT_LOGS, ID.unique(), {
      actorId: authenticated.user.$id,
      actorName: authenticated.user.name || "Unknown",
      actorRole,
      action,
      entityType,
      entityId,
      details,
      ipAddress: getClientAddress(request).slice(0, 45),
      userAgent: (request.headers.get("user-agent") || "").slice(0, 500),
      timestamp: new Date().toISOString(),
    });

    return ok({ log: created }, 201);
  } catch (error) {
    console.error("Audit write error:", error);
    return fail("INTERNAL", "Unable to record audit entry", 500);
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
    });
  } catch (error) {
    console.error("Audit log lookup error:", error);
    return fail("INTERNAL", "Unable to load audit logs", 500);
  }
}
