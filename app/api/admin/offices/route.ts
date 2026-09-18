import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  getOfficeCapabilities,
  requireCapability,
  unheldCapabilities,
} from "@/lib/access-control";
import { consumeRateLimit } from "@/lib/rate-limit";
import { recordAudit } from "@/lib/server-audit";
import { GOVERNANCE_OFFICES } from "@/lib/governance";
import { isIsoDate } from "@/lib/validation";
import { getAccountNames } from "@/lib/server-users";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const OFFICE_IDS = new Set<string>(
  GOVERNANCE_OFFICES.map((office) => office.id),
);
const METHODS = new Set(["election", "appointment", "interim"]);
const STATUSES = new Set(["active", "ended", "vacant"]);

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "governance.manage_offices",
  );

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.OFFICE_ASSIGNMENTS,
      [Query.orderDesc("termStart"), Query.limit(100)],
    );

    return ok({ assignments: response.documents, total: response.total });
  } catch (error) {
    logError("Office assignment list error:", error);

    return fail("INTERNAL", "Unable to load office assignments", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "governance.manage_offices",
  );

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `office-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const officeId =
      typeof body.officeId === "string" ? body.officeId.trim() : "";
    const userId = typeof body.userId === "string" ? body.userId.trim() : "";
    const selectionMethod =
      typeof body.selectionMethod === "string"
        ? body.selectionMethod.trim()
        : "";
    const termStart =
      typeof body.termStart === "string" ? body.termStart.trim() : "";
    const termEnd =
      typeof body.termEnd === "string" && body.termEnd.trim()
        ? body.termEnd.trim()
        : undefined;

    if (
      !OFFICE_IDS.has(officeId) ||
      !userId ||
      !METHODS.has(selectionMethod) ||
      !isIsoDate(termStart)
    )
      return fail("VALIDATION", "Invalid office assignment", 400);
    if (termEnd !== undefined && !isIsoDate(termEnd))
      return fail("VALIDATION", "Term end must be a valid date", 400);
    if (termEnd && termEnd <= termStart)
      return fail("VALIDATION", "Term end must follow term start", 400);
    const nameMap = await getAccountNames([userId]);

    if (!nameMap.has(userId)) return fail("NOT_FOUND", "User not found", 404);
    // Parity with /api/access: no grant beyond hold. An office is a capability
    // bundle (its role template), so assigning one must pass the same check as
    // assigning a role — otherwise the same grant was checked through one door
    // and unchecked through the other.
    const unheld = await unheldCapabilities(
      authenticated.user.$id,
      await getOfficeCapabilities(officeId),
    );

    if (unheld.length > 0) {
      return fail(
        "FORBIDDEN",
        `Cannot assign an office whose capabilities you do not hold: ${unheld.slice(0, 5).join(", ")}`,
        403,
      );
    }
    const { databases } = createServerDatabases();
    const active = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.OFFICE_ASSIGNMENTS,
      [
        Query.equal("officeId", [officeId]),
        Query.equal("status", ["active"]),
        Query.limit(1),
      ],
    );

    if (active.documents.length > 0)
      return fail(
        "CONFLICT",
        "That office already has an active assignment",
        409,
      );
    const assignment = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.OFFICE_ASSIGNMENTS,
      ID.unique(),
      {
        officeId,
        userId,
        appointedBy: authenticated.user.$id,
        selectionMethod,
        termStart,
        termEnd,
        status: "active",
        notes:
          typeof body.notes === "string"
            ? body.notes.trim().slice(0, 2000)
            : null,
        createdAt: new Date().toISOString(),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "office.assign",
      entityType: "office_assignment",
      entityId: assignment.$id,
      details: { officeId, userId },
    });

    return ok({ assignment }, 201);
  } catch (error) {
    logError("Office assignment create error:", error);

    return fail("INTERNAL", "Unable to assign office", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "governance.manage_offices",
  );

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as {
      assignmentId?: unknown;
      status?: unknown;
      notes?: unknown;
    };
    const assignmentId =
      typeof body.assignmentId === "string" ? body.assignmentId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";

    if (!assignmentId || !STATUSES.has(status))
      return fail("VALIDATION", "Invalid assignment update", 400);
    const { databases } = createServerDatabases();
    const assignment = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.OFFICE_ASSIGNMENTS,
      assignmentId,
      {
        status,
        ...(typeof body.notes === "string"
          ? { notes: body.notes.trim().slice(0, 2000) }
          : {}),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "office.end",
      entityType: "office_assignment",
      entityId: assignmentId,
      details: { status },
    });

    return ok({ assignment });
  } catch (error) {
    logError("Office assignment update error:", error);

    return fail("INTERNAL", "Unable to update office assignment", 500);
  }
}
