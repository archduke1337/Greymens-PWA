import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  isCapability,
  requireCapability,
  unheldCapabilities,
} from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

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
  // A level no longer grants anything at all (see the capabilities column), so
  // the ceiling is descriptive — seniority for display, not a privilege
  // boundary. Authority a title carries must be listed explicitly and is
  // checked against no-grant-beyond-hold below.
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
    description:
      typeof body.description === "string"
        ? body.description.slice(0, 2000)
        : "",
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
  // Always written, so an empty list is a deliberate revocation rather than an
  // omitted field that silently leaves the previous grant in place.
  out.capabilities = (
    Array.isArray(body.capabilities) ? body.capabilities : []
  ).filter(isCapability);

  return out;
}

/** Unknown strings are rejected, not dropped: a typo must not read as "granted". */
function unknownCapabilities(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : [];

  return raw
    .filter((entry) => !isCapability(entry))
    .map((entry) => String(entry).slice(0, 60));
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
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
    logError("Admin designation list error:", error);

    return fail("INTERNAL", "Unable to load designations", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "designations.assign");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const validationError = validate(body);

    if (validationError) return fail("VALIDATION", validationError, 400);
    const unknown = unknownCapabilities(body.capabilities);

    if (unknown.length > 0) {
      return fail(
        "VALIDATION",
        `Unknown capabilities: ${unknown.slice(0, 5).join(", ")}`,
        400,
      );
    }
    const fields = pickDesignationFields(body);
    // A title can now carry authority, so it obeys the same
    // no-grant-beyond-hold rule as a role template or an office: a designation
    // manager cannot mint capability they do not hold.
    const unheld = await unheldCapabilities(
      authenticated.user.$id,
      Array.isArray(fields.capabilities) ? fields.capabilities : [],
    );

    if (unheld.length > 0) {
      return fail(
        "FORBIDDEN",
        `Cannot grant capabilities you do not hold: ${unheld.slice(0, 5).join(", ")}`,
        403,
      );
    }
    const { databases } = createServerDatabases();
    const designation = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      ID.unique(),
      { ...fields, isActive: true },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.create",
      entityType: "designation",
      entityId: designation.$id,
      details: {
        slug: designation.slug,
        level: designation.level,
        capabilities: fields.capabilities,
      },
    });

    return ok({ designation }, 201);
  } catch (error) {
    logError("Admin designation create error:", error);

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

    if (validationError) return fail("VALIDATION", validationError, 400);
    const unknown = unknownCapabilities(rest.capabilities);

    if (unknown.length > 0) {
      return fail(
        "VALIDATION",
        `Unknown capabilities: ${unknown.slice(0, 5).join(", ")}`,
        400,
      );
    }
    const fields = pickDesignationFields(rest);
    const unheld = await unheldCapabilities(
      authenticated.user.$id,
      Array.isArray(fields.capabilities) ? fields.capabilities : [],
    );

    if (unheld.length > 0) {
      return fail(
        "FORBIDDEN",
        `Cannot grant capabilities you do not hold: ${unheld.slice(0, 5).join(", ")}`,
        403,
      );
    }
    const { databases } = createServerDatabases();
    const designation = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DESIGNATIONS,
      designationId,
      fields,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "designation.update",
      entityType: "designation",
      entityId: designationId,
      details: { slug: fields.slug, capabilities: fields.capabilities },
    });

    return ok({ designation });
  } catch (error) {
    logError("Admin designation update error:", error);

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
    const { databases } = createServerDatabases();
    // Deactivation revokes every active grant: the old comment claimed a
    // cascade "via isActive filter", but no reader filters grants by the
    // catalogue row — holders kept their titles indefinitely.
    const holders = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_DESIGNATIONS,
      [
        Query.equal("designationId", [designationId]),
        Query.equal("isActive", [true]),
        Query.limit(500),
      ],
    );

    await Promise.all(
      holders.documents.map((holder) =>
        databases
          .updateDocument(
            DATABASE_ID,
            COLLECTIONS.USER_DESIGNATIONS,
            holder.$id,
            { isActive: false },
          )
          .catch(() => null),
      ),
    );
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
      details: { grantsRevoked: holders.documents.length },
    });

    return ok({ designation, grantsRevoked: holders.documents.length });
  } catch (error) {
    logError("Admin designation delete error:", error);

    return fail("INTERNAL", "Unable to deactivate designation", 500);
  }
}
