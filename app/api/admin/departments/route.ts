import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const CATEGORIES = new Set(["technical", "content", "operations"]);

// Only these columns may be written from client input. Anything else in the
// body (present or future privileged columns) is dropped, never stored.
const EDITABLE_DEPARTMENT_FIELDS = [
  "name",
  "slug",
  "description",
  "icon",
  "color",
  "parentId",
  "headId",
  "displayOrder",
  "category",
] as const;

function pickDepartmentFields(
  body: Record<string, unknown>,
  allowActive = false,
) {
  const out: Record<string, unknown> = {};

  for (const key of EDITABLE_DEPARTMENT_FIELDS) {
    const value = body[key];

    if (value === undefined) continue;
    // An untouched empty link field arrives as "" — store null (no link),
    // never an empty string that a later read treats as a department id.
    if ((key === "parentId" || key === "headId") && value === "") {
      out[key] = null;
      continue;
    }
    out[key] = value;
  }
  // Activation state is server-forced on create; on update it is an explicit,
  // validated boolean so the console toggle keeps working.
  if (allowActive && typeof body.isActive === "boolean") {
    out.isActive = body.isActive;
  }

  return out;
}

function validate(body: Record<string, unknown>) {
  if (
    typeof body.name !== "string" ||
    !body.name.trim() ||
    body.name.length > 100
  )
    return "Invalid department name";
  if (
    typeof body.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)
  )
    return "Invalid department slug";
  if (typeof body.category !== "string" || !CATEGORIES.has(body.category))
    return "Invalid department category";
  if (
    body.description !== undefined &&
    body.description !== null &&
    (typeof body.description !== "string" || body.description.length > 65535)
  )
    return "Invalid department description";
  if (
    body.icon !== undefined &&
    body.icon !== null &&
    (typeof body.icon !== "string" || body.icon.length > 100)
  )
    return "Invalid department icon";
  if (
    body.color !== undefined &&
    body.color !== null &&
    (typeof body.color !== "string" || body.color.length > 20)
  )
    return "Invalid department color";
  // Empty string and null both mean "no link" — normalize before validating
  // so clearing a parent/head (or submitting an untouched empty field) never
  // 400s. `null` is stored, which clears the column.
  for (const key of ["parentId", "headId"] as const) {
    if (body[key] === "" || body[key] === null) body[key] = null;
  }
  if (
    body.parentId !== undefined &&
    body.parentId !== null &&
    (typeof body.parentId !== "string" ||
      !body.parentId.trim() ||
      body.parentId.length > 36)
  )
    return "Invalid parent department";
  if (
    body.headId !== undefined &&
    body.headId !== null &&
    (typeof body.headId !== "string" ||
      !body.headId.trim() ||
      body.headId.length > 36)
  )
    return "Invalid department head";
  if (
    body.displayOrder !== undefined &&
    (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0)
  )
    return "Invalid display order";

  return null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const [response, assignments] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.orderAsc("displayOrder"),
        Query.limit(100),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
        Query.equal("isActive", [true]),
        Query.limit(500),
      ]),
    ]);

    // Member counts ride along with the list so the screen needs one request
    // instead of one browser query per department.
    const counts: Record<string, number> = {};

    for (const department of response.documents) {
      counts[department.$id] = 0;
    }
    for (const assignment of assignments.documents) {
      const key = String(assignment.departmentId ?? "");

      if (key in counts) counts[key] += 1;
    }

    return ok({
      departments: response.documents,
      memberCounts: counts,
      total: response.total,
    });
  } catch (error) {
    logError("Admin department list error:", error);

    return fail("INTERNAL", "Unable to load departments", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `department-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fields = pickDepartmentFields(body);
    const validationError = validate(fields);

    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createServerDatabases();
    const department = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS,
      ID.unique(),
      { ...fields, isActive: true },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "department.create",
      entityType: "department",
      entityId: department.$id,
      details: {},
    });

    return ok({ department }, 201);
  } catch (error) {
    logError("Admin department create error:", error);

    return fail("INTERNAL", "Unable to create department", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `department-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const departmentId =
      typeof body.departmentId === "string" ? body.departmentId.trim() : "";

    if (!departmentId)
      return fail("VALIDATION", "departmentId is required", 400);
    const { departmentId: _departmentId, ...rest } = body;
    const data = pickDepartmentFields(rest, true);

    // A department cannot parent itself — the tree walk elsewhere assumes
    // acyclic links, and a self-link would render the department inside
    // itself.
    if (data.parentId === departmentId) {
      return fail("VALIDATION", "A department cannot be its own parent", 400);
    }
    // PATCH keeps full-object semantics (name/slug/category required) so a
    // partial typo cannot silently blank a required column server-side.
    const validationError = validate(data);

    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createServerDatabases();
    const department = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS,
      departmentId,
      data,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "department.update",
      entityType: "department",
      entityId: departmentId,
      details: { fields: Object.keys(data) },
    });

    return ok({ department });
  } catch (error) {
    logError("Admin department update error:", error);

    return fail("INTERNAL", "Unable to update department", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `department-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const departmentId = new URL(request.url).searchParams
      .get("departmentId")
      ?.trim();

    if (!departmentId)
      return fail("VALIDATION", "departmentId is required", 400);
    const { databases } = createServerDatabases();
    const department = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.DEPARTMENTS,
      departmentId,
      { isActive: false },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "department.delete",
      entityType: "department",
      entityId: departmentId,
      details: { softDeleted: true },
    });

    return ok({ department });
  } catch (error) {
    logError("Admin department delete error:", error);

    return fail("INTERNAL", "Unable to deactivate department", 500);
  }
}
