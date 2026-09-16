import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { isRecord } from "@/lib/validation";
import { ok, fail, ApiError } from "@/lib/api";

/**
 * Designation assignment and revocation.
 *
 * `user_designations` is a crown-jewel table: it decides who the site presents
 * as leadership and feeds the capability engine. It grants no client write
 * permission, so the previous browser-side `designationService.assign/revoke`
 * calls could never have succeeded — they just failed silently as "failed to
 * assign". Every mutation here derives the actor from the verified session,
 * validates the target records, and writes an audit entry.
 */

const MAX_LIMIT = 500;

async function getActiveDesignation(designationId: string) {
  const { databases } = createAdminClient();
  try {
    const designation = await databases.getDocument(DATABASE_ID, COLLECTIONS.DESIGNATIONS, designationId);
    if ((designation as Record<string, unknown>).isActive !== true) return null;
    return designation;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");
  if (!authenticated.user) return authenticated.response;

  try {
    const designationId = request.nextUrl.searchParams.get("designationId")?.trim() ?? "";
    if (!designationId) {
      return fail("VALIDATION", "designationId is required", 400);
    }

    const designation = await getActiveDesignation(designationId);
    if (!designation) {
      return fail("NOT_FOUND", "Designation not found", 404);
    }

    const { databases } = createAdminClient();
    const holders = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
      Query.equal("designationId", [designationId]),
      Query.equal("isActive", [true]),
      Query.limit(MAX_LIMIT),
    ]);

    return ok({ holders: holders.documents, total: holders.total });
  } catch (error) {
    console.error("Designation holder list error:", error);
    return fail("INTERNAL", "Unable to load designation holders", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");
  if (!authenticated.user) return authenticated.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (!isRecord(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const designationId = typeof body.designationId === "string" ? body.designationId.trim() : "";
  if (!userId || !designationId) {
    return fail("VALIDATION", "userId and designationId are required", 400);
  }

  try {
    const { databases } = createAdminClient();

    const designation = await getActiveDesignation(designationId);
    if (!designation) {
      return fail("NOT_FOUND", "Designation not found", 404);
    }

    // Respect maxHolders: an optional cap on how many people may hold this
    // designation at once. Without this check the field is decoration.
    if (typeof designation.maxHolders === "number" && designation.maxHolders > 0) {
      const current = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
        Query.equal("designationId", [designationId]),
        Query.equal("isActive", [true]),
        Query.limit(1),
      ]);
      if (current.total >= designation.maxHolders) {
        return fail("CONFLICT", `This designation is limited to ${designation.maxHolders} holder(s)`, 409);
      }
    }

    // Idempotent assignment: an active grant for the same pair is a no-op
    // rather than a duplicate row.
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
      Query.equal("userId", [userId]),
      Query.equal("designationId", [designationId]),
      Query.equal("isActive", [true]),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      return ok({ assignment: existing.documents[0], alreadyAssigned: true });
    }

    const assignment = await databases.createDocument(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, ID.unique(), {
      userId,
      designationId,
      assignedBy: authenticated.user.$id,
      assignedAt: new Date().toISOString(),
      isActive: true,
    });

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.assign",
      entityType: "user_designations",
      entityId: assignment.$id,
      details: { userId, designationId, designationName: designation.name },
    });

    return ok({ assignment }, 201);
  } catch (error) {
    console.error("Designation assign error:", error);
    return fail("INTERNAL", "Unable to assign designation", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");
  if (!authenticated.user) return authenticated.response;

  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const designationId = request.nextUrl.searchParams.get("designationId")?.trim() ?? "";
  if (!userId || !designationId) {
    return fail("VALIDATION", "userId and designationId are required", 400);
  }

  try {
    const { databases } = createAdminClient();
    const designation = await getActiveDesignation(designationId);
    if (!designation) {
      return fail("NOT_FOUND", "Designation not found", 404);
    }

    const active = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
      Query.equal("userId", [userId]),
      Query.equal("designationId", [designationId]),
      Query.equal("isActive", [true]),
      Query.limit(MAX_LIMIT),
    ]);
    if (active.documents.length === 0) {
      return fail("NOT_FOUND", "Assignment not found", 404);
    }

    const now = new Date().toISOString();
    await Promise.all(
      active.documents.map((document) =>
        databases.updateDocument(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, document.$id, {
          isActive: false,
          revokedBy: authenticated.user!.$id,
          revokedAt: now,
        }),
      ),
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.revoke",
      entityType: "user_designations",
      entityId: active.documents[0]?.$id ?? designationId,
      details: { userId, designationId, designationName: designation.name, revoked: active.documents.length, assignmentIds: active.documents.map((d) => d.$id) },
    });

    return ok({ revoked: active.documents.length });
  } catch (error) {
    console.error("Designation revoke error:", error);
    return fail("INTERNAL", "Unable to revoke designation", 500);
  }
}
