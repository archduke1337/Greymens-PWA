import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { RESTRICTED_STATUSES, getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability, hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, ApiError } from "@/lib/api";

const STATUSES = new Set(["pending", "approved", "rejected", "expired", "revoked"]);

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const isAdmin = await hasServerCapability(authenticated.user.$id, "security.manage_incidents");
    const queries = isAdmin
      ? [Query.orderDesc("createdAt"), Query.limit(100)]
      : [Query.equal("requestedBy", [authenticated.user.$id]), Query.orderDesc("createdAt"), Query.limit(100)];
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.AUTHORIZED_ACTIVITIES, queries);
    return ok({ activities: response.documents, total: response.total });
  } catch (error) {
    console.error("Authorized activity list error:", error);
    return fail("INTERNAL", "Unable to load authorized activities", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const limited = consumeRateLimit(`security-activity:${authenticated.user.$id}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  // Restricted accounts cannot open new authorization requests — consistent
  // with audit, onboarding, and registration, which all bar them.
  const writerStatus = await getMembershipStatus(authenticated.user);
  if (RESTRICTED_STATUSES.has(writerStatus)) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const requiredStrings = ["title", "description", "target", "scope", "dataBoundary", "purpose", "startsAt", "endsAt"];
    if (requiredStrings.some((key) => typeof body[key] !== "string" || !(body[key] as string).trim() || (body[key] as string).length > 65535)) {
      return fail("VALIDATION", "Title, target, scope, data boundary, purpose, and time window are required", 400);
    }
    const startsAt = new Date(String(body.startsAt));
    const endsAt = new Date(String(body.endsAt));
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime()) || endsAt <= startsAt) {
      return fail("VALIDATION", "Invalid activity time window", 400);
    }
    const techniques = Array.isArray(body.techniques)
      ? body.techniques.filter((item): item is string => typeof item === "string" && item.length <= 255).slice(0, 30)
      : [];
    const { databases } = createServerDatabases();
    const activity = await databases.createDocument(DATABASE_ID, COLLECTIONS.AUTHORIZED_ACTIVITIES, ID.unique(), {
      title: String(body.title).trim().slice(0, 255),
      description: String(body.description).trim(),
      requestedBy: authenticated.user.$id,
      target: String(body.target).trim().slice(0, 500),
      scope: String(body.scope).trim(),
      techniques,
      dataBoundary: String(body.dataBoundary).trim(),
      purpose: String(body.purpose).trim().slice(0, 2000),
      startsAt: startsAt.toISOString(),
      endsAt: endsAt.toISOString(),
      status: "pending",
      createdAt: new Date().toISOString(),
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "activity.request",
      entityType: "authorized_activity",
      entityId: activity.$id,
      details: {},
    });
    return ok({ activity }, 201);
  } catch (error) {
    console.error("Authorized activity request error:", error);
    return fail("INTERNAL", "Unable to submit authorized activity", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "security.manage_incidents");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as { activityId?: unknown; status?: unknown };
    const activityId = typeof body.activityId === "string" ? body.activityId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!activityId || !STATUSES.has(status)) return fail("VALIDATION", "Invalid activity decision", 400);
    const { databases } = createServerDatabases();
    const activity = await databases.updateDocument(DATABASE_ID, COLLECTIONS.AUTHORIZED_ACTIVITIES, activityId, {
      status,
      approvedBy: authenticated.user.$id,
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "activity.decide",
      entityType: "authorized_activity",
      entityId: activityId,
      details: { status },
    });
    return ok({ activity });
  } catch (error) {
    console.error("Authorized activity decision error:", error);
    return fail("INTERNAL", "Unable to update authorized activity", 500);
  }
}
