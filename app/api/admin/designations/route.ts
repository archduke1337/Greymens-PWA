import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const CATEGORIES = new Set([
  "department",
  "operations",
  "executive",
  "special",
]);

function validate(body: Record<string, unknown>) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 100
  )
    return "Invalid designation name";
  if (
    typeof body.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)
  )
    return "Invalid designation slug";
  // Levels are capped at 9 because level 10 was the reserved "everything" tier.
  // The wildcard now comes only from the governance role in `user_roles`, so a
  // designation can never be a route to full access. Raise this ceiling only if
  // `DESIGNATION_LEVEL_PERMISSIONS` gains a level 10 that grants something
  // bounded.
  if (
    !Number.isInteger(body.level) ||
    Number(body.level) < 1 ||
    Number(body.level) > 9
  ) {
    return "Level must be between 1 and 9";
  }
  if (typeof body.category !== "string" || !CATEGORIES.has(body.category))
    return "Invalid designation category";
  if (
    body.departmentId !== undefined &&
    body.departmentId !== null &&
    body.departmentId !== "" &&
    (typeof body.departmentId !== "string" || body.departmentId.length > 36)
  )
    return "Invalid department";
  if (
    body.badgeIcon !== undefined &&
    (typeof body.badgeIcon !== "string" || body.badgeIcon.length > 100)
  )
    return "Invalid badge icon";
  if (
    body.badgeColor !== undefined &&
    (typeof body.badgeColor !== "string" || body.badgeColor.length > 20)
  )
    return "Invalid badge color";
  if (
    body.maxHolders !== undefined &&
    body.maxHolders !== null &&
    (!Number.isInteger(body.maxHolders) || Number(body.maxHolders) < 1)
  )
    return "Invalid holder limit";
  if (
    body.displayOrder !== undefined &&
    body.displayOrder !== null &&
    (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0)
  )
    return "Invalid display order";

  return null;
}

function pickDesignationFields(body: Record<string, unknown>) {
  // Explicit allowlist: never spread client body (mass-assignment).
  const out: Record<string, unknown> = {
    name: String(body.name ?? "").trim(),
    slug: String(body.slug ?? "").trim(),
    level: Number(body.level),
    category: String(body.category ?? "").trim(),
    description: typeof body.description === "string" ? body.description.slice(0, 2000) : "",
  };

  if (
    typeof body.departmentId === "string" &&
    body.departmentId.trim() &&
    body.departmentId.length <= 36
  ) {
    out.departmentId = body.departmentId.trim();
  }
  if (typeof body.badgeIcon === "string" && body.badgeIcon.length <= 100) {
    out.badgeIcon = body.badgeIcon;
  }
  if (typeof body.badgeColor === "string" && body.badgeColor.length <= 20) {
    out.badgeColor = body.badgeColor;
  }
  if (Number.isInteger(body.maxHolders) && Number(body.maxHolders) >= 1) {
    out.maxHolders = Number(body.maxHolders);
  }
  if (Number.isInteger(body.displayOrder) && Number(body.displayOrder) >= 0) {
    out.displayOrder = Number(body.displayOrder);
  }
  return out;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      [
        Query.equal("isActive", [true]),
        Query.orderAsc("level"),
        Query.limit(100),
      ],
    );

    return ok({
      designations: response.documents,
      total: response.total,
    });
  } catch (error) {
    console.error("Admin designation list error:", error);

    return fail("INTERNAL", "Unable to load designations", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validationError = validate(body);

    if (validationError)
      return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const designation = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      ID.unique(),
      { ...pickDesignationFields(body), isActive: true },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.create",
      entityType: "designation",
      entityId: designation.$id,
      details: { slug: designation.slug, level: designation.level },
    });

    return ok({ designation }, 201);
  } catch (error) {
    console.error("Admin designation create error:", error);

    return fail("INTERNAL", "Unable to create designation", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const designationId =
      typeof body.designationId === "string" ? body.designationId.trim() : "";

    if (!designationId)
      return fail("VALIDATION", "designationId is required", 400);
    const { designationId: _designationId, ...rest } = body;
    const validationError = validate({ ...rest, designationId: undefined });

    if (validationError)
      return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const designation = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      designationId,
      pickDesignationFields(rest),
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.update",
      entityType: "designation",
      entityId: designationId,
      details: { slug: pickDesignationFields(rest).slug },
    });

    return ok({ designation });
  } catch (error) {
    console.error("Admin designation update error:", error);

    return fail("INTERNAL", "Unable to update designation", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const designationId = new URL(request.url).searchParams
      .get("designationId")
      ?.trim();

    if (!designationId)
      return fail("VALIDATION", "designationId is required", 400);
    const { databases } = createAdminClient();
    // Warn if holders exist; deactivation cascades via isActive filter.
    const holders = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
      Query.equal("designationId", [designationId]),
      Query.equal("isActive", [true]),
      Query.limit(1),
    ]);
    const designation = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      designationId,
      { isActive: false },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.deactivate",
      entityType: "designation",
      entityId: designationId,
      details: { activeHolders: holders.total },
    });

    return ok({ designation, activeHolders: holders.total });
  } catch (error) {
    console.error("Admin designation delete error:", error);

    return fail("INTERNAL", "Unable to deactivate designation", 500);
  }
}
