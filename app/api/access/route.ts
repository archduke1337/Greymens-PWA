import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { CAPABILITIES, getAccessSummary, getEffectiveCapabilities, isCapability, requireCapability, hasServerCapability } from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
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

/**
 * No-grant-beyond-hold: a role manager can only deal capabilities they hold
 * themselves (admins hold "*" and bypass). Without this, any holder of
 * access.assign_roles can mint themselves a superset role — self-escalation
 * through the front door.
 */
async function unheldCapabilities(actorId: string, caps: string[]): Promise<string[]> {
  const held = await getEffectiveCapabilities(actorId);
  if (held.has("*")) return [];
  return caps.filter((cap) => !held.has(cap));
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
      // Only active templates: the authorizer ignores inactive roles, so
      // offering them here would promise grants that never take effect.
      databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, [Query.equal("isActive", [true]), Query.orderAsc("name"), Query.limit(100)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [Query.orderDesc("assignedAt"), Query.limit(200)]),
    ]);
    // Names live on the auth record — best-effort so a lookup failure never
    // fails the access center.
    const assigneeIds = [...new Set(assignments.documents.map((item) => String(item.userId ?? "")).filter(Boolean))];
    const accountNames = await getAccountNames(assigneeIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );
    return ok({ ...summary, capabilities: CAPABILITIES, roles: roles.documents, assignments: assignments.documents, accountNames });
  } catch (error) {
    console.error("Access lookup error:", error);
    return fail("INTERNAL", "Unable to load access data", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "access.assign_roles");
  if (!authenticated.user) return authenticated.response;
  if (!consumeRateLimit(`access-mutate:${authenticated.user.$id}`, 60, 10 * 60 * 1000).allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
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
      const unheld = await unheldCapabilities(authenticated.user.$id, capabilities);
      if (unheld.length > 0) {
        return fail("FORBIDDEN", `Cannot grant capabilities you do not hold: ${unheld.slice(0, 5).join(", ")}`, 403);
      }
      const role = await databases.createDocument(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, ID.unique(), {
        name, slug, description, capabilities, teamId: text(body.teamId, 100) || undefined,
        teamRole: text(body.teamRole, 100) || undefined, label: text(body.label, 100) || undefined, isActive: true,
      });
      await recordAudit({ request, actor: authenticated.user, action: "access.role_created", entityType: "role_template", entityId: role.$id, details: { slug, capabilities } });
      return ok({ role }, 201);
    }

    if (action === "assign_role") {
      // userId/roleId are Appwrite document IDs (36 chars): validating wider
      // only moves the failure to the column size.
      const userId = text(body.userId, 36);
      const roleId = text(body.roleId, 36);
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
      const templateCaps = Array.isArray(role.capabilities) ? role.capabilities.filter((c): c is string => typeof c === "string") : [];
      const unheldAssign = await unheldCapabilities(authenticated.user.$id, templateCaps);
      if (unheldAssign.length > 0) {
        return fail("FORBIDDEN", `Cannot assign a role with capabilities you do not hold: ${unheldAssign.slice(0, 5).join(", ")}`, 403);
      }
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
        expiresAt: expiresAt || undefined, scopeType, scopeId: scopeId || undefined, isActive: true,
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
  if (!consumeRateLimit(`access-mutate:${authenticated.user.$id}`, 60, 10 * 60 * 1000).allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
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
        expiresAt: expiresRaw || undefined,
      });
      await recordAudit({ request, actor: authenticated.user, action: assignment.isActive ? "access.role_updated" : "access.role_revoked", entityType: "role_assignment", entityId: assignmentId, details: { expiresAt: expiresRaw || undefined, isActive: assignment.isActive } });
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
      const unheldRewrite = await unheldCapabilities(authenticated.user.$id, capabilities);
      if (unheldRewrite.length > 0) {
        return fail("FORBIDDEN", `Cannot grant capabilities you do not hold: ${unheldRewrite.slice(0, 5).join(", ")}`, 403);
      }
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
