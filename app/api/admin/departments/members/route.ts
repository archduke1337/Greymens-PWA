import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { getAccountNames } from "@/lib/server-users";
import { isRecord } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Department membership, for the admin department screen.
 *
 * The previous client implementation issued one browser query for the member
 * list and then one more browser query per member for their profile — an N+1
 * over a table that grants no client read permission for these joins. This
 * endpoint performs both queries server-side behind `requireCapability` and returns
 * the joined result once.
 */

const MAX_LIMIT = 500;

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const departmentId =
      request.nextUrl.searchParams.get("departmentId")?.trim() ?? "";

    if (!departmentId) {
      return fail("VALIDATION", "departmentId is required", 400);
    }

    const { databases } = createServerDatabases();
    const members = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_DEPARTMENTS,
      [
        Query.equal("departmentId", [departmentId]),
        Query.equal("isActive", [true]),
        Query.limit(MAX_LIMIT),
      ],
    );

    const userIds = members.documents
      .map((member) => String(member.userId ?? ""))
      .filter(Boolean);

    const profiles = userIds.length
      ? await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
          Query.equal("userId", userIds),
          Query.limit(MAX_LIMIT),
        ])
      : { documents: [] };

    const profileByUser = new Map(
      profiles.documents.map((profile) => [
        String(profile.userId ?? ""),
        profile,
      ]),
    );

    const joined = members.documents.map((member) => ({
      ...member,
      profile: profileByUser.get(String(member.userId ?? "")) ?? null,
    }));

    // Names live on the auth record — best-effort so a lookup failure never
    // fails the member list.
    const accountNames = await getAccountNames(userIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok({ members: joined, total: members.total, accountNames });
  } catch (error) {
    logError("Department member list error:", error);

    return fail("INTERNAL", "Unable to load department members", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `department-member-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
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

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  const urn = typeof body.urn === "string" ? body.urn.trim() : "";
  const departmentId =
    typeof body.departmentId === "string" ? body.departmentId.trim() : "";
  const role = typeof body.role === "string" ? body.role : "";

  if ((!userId && !urn) || !departmentId) {
    return fail(
      "VALIDATION",
      "userId (or urn) and departmentId are required",
      400,
    );
  }
  if (!["member", "core_member", "lead"].includes(role)) {
    return fail("VALIDATION", "role must be member, core_member, or lead", 400);
  }

  try {
    const { databases } = createServerDatabases();

    const department = await databases
      .getDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, departmentId)
      .catch(() => null);

    if (!department) {
      return fail("NOT_FOUND", "Department not found", 404);
    }

    // A pasted URN resolves to its account here, so the console never needs
    // raw account ids. Exact match only — a near-miss must 404 with a clear
    // message rather than attach the wrong person.
    let resolvedUserId = userId;

    if (!resolvedUserId) {
      const profiles = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.PROFILES,
        [Query.equal("urn", [urn]), Query.limit(1)],
      );
      const match = profiles.documents[0];

      if (!match || typeof match.userId !== "string" || !match.userId) {
        return fail(
          "NOT_FOUND",
          "No member found with that URN — search by name and pick them from the list",
          404,
        );
      }
      resolvedUserId = match.userId;
    }

    // Idempotent: reactivate a soft-deleted assignment instead of duplicating.
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_DEPARTMENTS,
      [
        Query.equal("userId", [resolvedUserId]),
        Query.equal("departmentId", [departmentId]),
        Query.limit(100),
      ],
    );
    const inactive = existing.documents.find(
      (document) => document.isActive === false,
    );

    if (inactive) {
      const assignment = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.USER_DEPARTMENTS,
        inactive.$id,
        {
          role,
          isActive: true,
          assignedBy: authenticated.user.$id,
          assignedAt: new Date().toISOString(),
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "department_member.assign",
        entityType: "user_department",
        entityId: assignment.$id,
        details: {
          userId: resolvedUserId,
          departmentId,
          role,
          reactivated: true,
        },
      });

      return ok({ assignment, reactivated: true });
    }
    if (existing.documents.length > 0) {
      return fail("CONFLICT", "User is already in this department", 409);
    }

    const assignment = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.USER_DEPARTMENTS,
      ID.unique(),
      {
        userId: resolvedUserId,
        departmentId,
        role,
        assignedBy: authenticated.user.$id,
        assignedAt: new Date().toISOString(),
        isActive: true,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "department_member.assign",
      entityType: "user_department",
      entityId: assignment.$id,
      details: { userId: resolvedUserId, departmentId, role },
    });

    return ok({ assignment }, 201);
  } catch (error) {
    logError("Department assign error:", error);

    return fail("INTERNAL", "Unable to assign department member", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `department-member-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  const userId = request.nextUrl.searchParams.get("userId")?.trim() ?? "";
  const departmentId =
    request.nextUrl.searchParams.get("departmentId")?.trim() ?? "";

  if (!userId || !departmentId) {
    return fail("VALIDATION", "userId and departmentId are required", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const active = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_DEPARTMENTS,
      [
        Query.equal("userId", [userId]),
        Query.equal("departmentId", [departmentId]),
        Query.equal("isActive", [true]),
        Query.limit(MAX_LIMIT),
      ],
    );

    if (active.documents.length === 0) {
      return fail("NOT_FOUND", "Assignment not found", 404);
    }

    await Promise.all(
      active.documents.map((document) =>
        databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.USER_DEPARTMENTS,
          document.$id,
          {
            isActive: false,
          },
        ),
      ),
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "department_member.remove",
      entityType: "user_department",
      entityId: active.documents[0].$id,
      details: { userId, departmentId, removed: active.documents.length },
    });

    return ok({ removed: active.documents.length });
  } catch (error) {
    logError("Department remove error:", error);

    return fail("INTERNAL", "Unable to remove department member", 500);
  }
}
