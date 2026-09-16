import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const CATEGORIES = new Set(["technical", "content", "operations"]);

function validate(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 100) return "Invalid department name";
  if (typeof body.slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug)) return "Invalid department slug";
  if (typeof body.category !== "string" || !CATEGORIES.has(body.category)) return "Invalid department category";
  return null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const [response, assignments] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [Query.orderAsc("displayOrder"), Query.limit(100)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [Query.equal("isActive", [true]), Query.limit(500)]),
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

    return ok({ departments: response.documents, memberCounts: counts, total: response.total });
  } catch (error) {
    console.error("Admin department list error:", error);
    return fail("INTERNAL", "Unable to load departments", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const validationError = validate(body);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const department = await databases.createDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, ID.unique(), { ...body, isActive: true });
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
    console.error("Admin department create error:", error);
    return fail("INTERNAL", "Unable to create department", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const departmentId = typeof body.departmentId === "string" ? body.departmentId.trim() : "";
    if (!departmentId) return fail("VALIDATION", "departmentId is required", 400);
    const { departmentId: _departmentId, ...data } = body;
    const validationError = validate(data);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const department = await databases.updateDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, departmentId, data);
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
    console.error("Admin department update error:", error);
    return fail("INTERNAL", "Unable to update department", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "departments.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const departmentId = new URL(request.url).searchParams.get("departmentId")?.trim();
    if (!departmentId) return fail("VALIDATION", "departmentId is required", 400);
    const { databases } = createAdminClient();
    const department = await databases.updateDocument(DATABASE_ID, COLLECTIONS.DEPARTMENTS, departmentId, { isActive: false });
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
    console.error("Admin department delete error:", error);
    return fail("INTERNAL", "Unable to deactivate department", 500);
  }
}
