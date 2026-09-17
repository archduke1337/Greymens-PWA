import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { CAPABILITIES, getAccessSummary, isCapability, requireCapability, hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const MAX_TEXT = 2000;

function text(value: unknown, max = MAX_TEXT) {
  return typeof value === "string" && value.trim().length <= max ? value.trim() : "";
}

function validFutureDate(value: string): boolean {
  if (!value) return true;
  const d = new Date(value);
  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  try {
    const summary = await getAccessSummary(authenticated.user.$id);
    const isAdmin = await hasServerCapability(authenticated.user.$id, "access.assign_roles");
    if (!isAdmin) return ok(summary);

    const { databases } = createServerDatabases();
    const [roles, assignments] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, [Query.orderAsc("name"), Query.limit(100)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [Query.orderDesc("assignedAt"), Query.limit(200)]),
    ]);
    return ok({ ...summary, capabilities: CAPABILITIES, roles: roles.documents, assignments: assignments.documents });
  } catch (error) {
    console.error("Access lookup error:", error);
    return fail("INTERNAL", "Unable to load access data", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "access.assign_roles");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 40);
    const { databases } = createServerDatabases();

    if (action === "create_role") {
      const name = text(body.name, 100);
      const slug = text(body.slug, 100);
      const description = text(body.description);
      const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
      const unknownCaps = rawCaps.filter((c) => !isCapability(c));
      if (unknownCaps.length > 0) {
        return fail("VALIDATION", `Unknown capabilities: ${unknownCaps.slice(0, 5).join(", ")}`, 400);
      }
      const capabilities = rawCaps.filter(isCapability);
      if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || capabilities.length === 0) {
        return fail("VALIDATION", "Name, valid slug, and at least one capability are required", 400);
      }
      const role = await databases.createDocument(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, ID.unique(), {
        name, slug, description, capabilities, teamId: text(body.teamId, 100) || null,
        teamRole: text(body.teamRole, 100) || null, label: text(body.label, 100) || null, isActive: true,
      });
      await recordAudit({ request, actor: authenticated.user, action: "access.role_created", entityType: "role_template", entityId: role.$id, details: { slug, capabilities } });
      return ok({ role }, 201);
    }

    if (action === "assign_role") {
      const userId = text(body.userId, 100);
      const roleId = text(body.roleId, 100);
      const scopeType = text(body.scopeType, 30) || "global";
      const scopeId = text(body.scopeId, 100);
      const expiresAt = text(body.expiresAt, 40);
      if (!userId || !roleId || !["global", "department", "team", "project"].includes(scopeType)) {
        return fail("VALIDATION", "User, role, and valid scope are required", 400);
      }
      if (expiresAt && !validFutureDate(expiresAt)) {
        return fail("VALIDATION", "expiresAt must be a future ISO date", 400);
      }
      const role = await databases.getDocument(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, roleId);
      if (role.isActive !== true) return fail("CONFLICT", "Role is inactive", 409);
      // Duplicate guard: avoid stacking N active rows.
      const dupes = await databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [
        Query.equal("userId", [userId]),
        Query.equal("roleId", [roleId]),
        Query.equal("isActive", [true]),
        Query.limit(1),
      ]).catch(() => ({ documents: [] as unknown[] }));
      if ((dupes as { documents: unknown[] }).documents.length > 0) {
        return fail("CONFLICT", "Active assignment already exists", 409);
      }
      const assignment = await databases.createDocument(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, ID.unique(), {
        userId, roleId, assignedBy: authenticated.user.$id, assignedAt: new Date().toISOString(),
        expiresAt: expiresAt || null, scopeType, scopeId: scopeId || null, isActive: true,
      });
      await recordAudit({ request, actor: authenticated.user, action: "access.role_assigned", entityType: "role_assignment", entityId: assignment.$id, details: { userId, roleId, scopeType, scopeId, expiresAt } });
      return ok({ assignment }, 201);
    }

    return fail("VALIDATION", "Unknown access action", 400);
  } catch (error) {
    console.error("Access mutation error:", error);
    return fail("INTERNAL", "Unable to update access", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "access.assign_roles");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const assignmentId = text(body.assignmentId, 100);
    const roleId = text(body.roleId, 100);
    const { databases } = createServerDatabases();
    if (assignmentId) {
      const expiresRaw = text(body.expiresAt, 40);
      if (expiresRaw && !validFutureDate(expiresRaw)) {
        return fail("VALIDATION", "expiresAt must be a future ISO date", 400);
      }
      const assignment = await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, assignmentId, {
        isActive: body.isActive === true,
        expiresAt: expiresRaw || null,
      });
      await recordAudit({ request, actor: authenticated.user, action: assignment.isActive ? "access.role_updated" : "access.role_revoked", entityType: "role_assignment", entityId: assignmentId, details: { expiresAt: expiresRaw || null, isActive: assignment.isActive } });
      return ok({ assignment });
    }
    if (roleId) {
      const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
      const unknownCaps = rawCaps.filter((c) => !isCapability(c));
      if (unknownCaps.length > 0) {
        return fail("VALIDATION", `Unknown capabilities: ${unknownCaps.slice(0, 5).join(", ")}`, 400);
      }
      const capabilities = rawCaps.filter(isCapability);
      if (!capabilities.length) return fail("VALIDATION", "At least one capability is required", 400);
      const role = await databases.updateDocument(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, roleId, {
        capabilities, isActive: body.isActive !== false,
      });
      await recordAudit({ request, actor: authenticated.user, action: "access.role_capabilities_updated", entityType: "role_template", entityId: roleId, details: { capabilities } });
      return ok({ role });
    }
    return fail("VALIDATION", "assignmentId or roleId is required", 400);
  } catch (error) {
    console.error("Access update error:", error);
    return fail("INTERNAL", "Unable to update access", 500);
  }
}
