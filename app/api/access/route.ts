import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import {
  getAccessSummary,
  isCapability,
  normalizeCapability,
  requireAnyCapability,
  hasServerCapability,
  unheldCapabilities,
} from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, isConflict } from "@/lib/api";
import { logError } from "@/lib/logger";
import { GOVERNANCE_OFFICES } from "@/lib/governance";
import { LEGACY_CAPABILITY_ALIASES } from "@/lib/capabilities";

const MAX_TEXT = 2000;

function text(value: unknown, max = MAX_TEXT) {
  return typeof value === "string" && value.trim().length <= max
    ? value.trim()
    : "";
}

function validFutureDate(value: string): boolean {
  if (!value) return true;
  const d = new Date(value);

  return !Number.isNaN(d.getTime()) && d.getTime() > Date.now();
}

// Charter office ids an office capability template may attach to.
const OFFICE_IDS = new Set(GOVERNANCE_OFFICES.map((office) => office.id));

/**
 * Read model for the Access console. Each half is gated on the capability that
 * owns it, so an offices-only manager still gets the office list (and is told
 * nothing about roles) rather than a 403 for the whole page.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;
  try {
    const summary = await getAccessSummary(authenticated.user.$id);
    const [canAssignRoles, canManageOffices, canAssignDesignations] =
      await Promise.all([
        hasServerCapability(authenticated.user.$id, "access.assign_roles"),
        hasServerCapability(
          authenticated.user.$id,
          "governance.manage_offices",
        ),
        hasServerCapability(authenticated.user.$id, "designations.assign"),
      ]);

    if (!canAssignRoles && !canManageOffices && !canAssignDesignations) {
      return ok(summary);
    }

    const empty = Promise.resolve({
      documents: [] as Array<Record<string, unknown>>,
    });
    const { databases } = createServerDatabases();
    const [
      roles,
      assignments,
      officeAssignments,
      designations,
      designationAssignments,
    ] = await Promise.all([
      // Only active templates: the authorizer ignores inactive roles, so
      // offering them here would promise grants that never take effect.
      canAssignRoles
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, [
            Query.equal("isActive", [true]),
            Query.orderAsc("name"),
            Query.limit(100),
          ])
        : empty,
      canAssignRoles
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [
            Query.orderDesc("assignedAt"),
            Query.limit(200),
          ])
        : empty,
      canManageOffices
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.OFFICE_ASSIGNMENTS, [
            Query.orderDesc("termStart"),
            Query.limit(200),
          ])
        : empty,
      // A title can carry capabilities, so it is an authority grant and
      // belongs in the same view. Gated on the capability that administers
      // it: you see the grant types you administer.
      canAssignDesignations
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
            Query.equal("isActive", [true]),
            Query.orderAsc("level"),
            Query.limit(100),
          ])
        : empty,
      canAssignDesignations
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
            Query.equal("isActive", [true]),
            Query.limit(500),
          ])
        : empty,
    ]);
    // Names live on the auth record — best-effort so a lookup failure never
    // fails the access center.
    const assigneeIds = [
      ...new Set(
        [
          ...assignments.documents.map((item) => String(item.userId ?? "")),
          ...officeAssignments.documents.map((item) =>
            String(item.userId ?? ""),
          ),
          ...designationAssignments.documents.map((item) =>
            String(item.userId ?? ""),
          ),
        ].filter(Boolean),
      ),
    ];
    const accountNames = await getAccountNames(assigneeIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok({
      ...summary,
      roles: roles.documents,
      assignments: assignments.documents,
      officeAssignments: officeAssignments.documents,
      designations: designations.documents,
      designationAssignments: designationAssignments.documents,
      accountNames,
    });
  } catch (error) {
    logError("Access lookup error:", error);

    return fail("INTERNAL", "Unable to load access data", 500);
  }
}

export async function POST(request: NextRequest) {
  // Creating a role template is `access.manage_role_templates`; assigning one
  // is `access.assign_roles`. The route serves both, so it opens on either and
  // each branch narrows to its own below.
  const authenticated = await requireAnyCapability(request, [
    "access.assign_roles",
    "access.manage_role_templates",
  ]);

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `access-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 40);
    const { databases } = createServerDatabases();

    if (action === "create_role") {
      const name = text(body.name, 100);
      const slug = text(body.slug, 100);
      const description = text(body.description);
      const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
      // Legacy names (blog.submit, access.manage_powers, …) are mapped to
      // their current equivalents rather than rejected — a template written
      // before a rename must stay editable, not lock its editors out.
      const capabilities = rawCaps
        .map(normalizeCapability)
        .filter(
          (cap): cap is NonNullable<ReturnType<typeof normalizeCapability>> =>
            cap !== null,
        );
      const unknownCaps = rawCaps.filter(
        (c) =>
          typeof c === "string" &&
          !isCapability(c) &&
          !(c in LEGACY_CAPABILITY_ALIASES),
      );

      if (unknownCaps.length > 0) {
        return fail(
          "VALIDATION",
          `Unknown capabilities: ${unknownCaps.slice(0, 5).join(", ")}`,
          400,
        );
      }

      if (
        !name ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ||
        capabilities.length === 0
      ) {
        return fail(
          "VALIDATION",
          "Name, valid slug, and at least one capability are required",
          400,
        );
      }
      const unheld = await unheldCapabilities(
        authenticated.user.$id,
        capabilities,
      );

      if (unheld.length > 0) {
        return fail(
          "FORBIDDEN",
          `Cannot grant capabilities you do not hold: ${unheld.slice(0, 5).join(", ")}`,
          403,
        );
      }
      // An office template carries the charter office's capability bundle
      // (assigned with a term from the Offices tab). officeId must name a
      // real charter office, and each office gets exactly one template —
      // duplicates would make officeCapabilities' lookup ambiguous.
      const officeId = text(body.officeId, 100);

      if (officeId) {
        if (!OFFICE_IDS.has(officeId)) {
          return fail("VALIDATION", "Unknown charter office", 400);
        }
        const dupe = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.ROLE_TEMPLATES,
          [Query.equal("officeId", [officeId]), Query.limit(1)],
        );

        if (dupe.documents.length > 0) {
          return fail(
            "CONFLICT",
            "That office already has a capability template — edit it instead",
            409,
          );
        }
      }
      const role = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.ROLE_TEMPLATES,
        ID.unique(),
        {
          name,
          slug,
          description,
          capabilities,
          teamId: text(body.teamId, 100) || undefined,
          teamRole: text(body.teamRole, 100) || undefined,
          label: text(body.label, 100) || undefined,
          officeId: officeId || undefined,
          isActive: true,
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "access.role_created",
        entityType: "role_template",
        entityId: role.$id,
        details: { slug, capabilities },
      });

      return ok({ role }, 201);
    }

    if (action === "delete_role") {
      const canManageTemplates = await requireAnyCapability(request, [
        "access.manage_role_templates",
      ]);

      if (!canManageTemplates.user) return canManageTemplates.response;
      const roleId = text(body.roleId, 100);

      if (!roleId) return fail("VALIDATION", "roleId is required", 400);
      const template = await databases
        .getDocument(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, roleId)
        .catch(() => null);

      if (!template) return fail("NOT_FOUND", "Role template not found", 404);
      // Charter office templates are seeded rows: deleting one removes the
      // office's capability bundle until the seeder runs again, which reads as
      // a random regression days later. Editing it is the console's job.
      if (String(template.officeId ?? "")) {
        return fail(
          "CONFLICT",
          "Charter office roles cannot be deleted — edit the office's capabilities instead",
          409,
        );
      }
      // Assignments reference the template; deleting under live grants strands
      // them, exactly like deleting a power with active grants.
      const grants = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.ROLE_ASSIGNMENTS,
        [Query.equal("roleId", [roleId]), Query.limit(200)],
      );
      const now = new Date().toISOString();
      const live = grants.documents.filter((row) => {
        const record = row as Record<string, unknown>;

        if (record.isActive === false) return false;
        const expiresAt = String(record.expiresAt ?? "");

        return !expiresAt || expiresAt > now;
      });

      if (live.length > 0) {
        return fail(
          "CONFLICT",
          `Role still has ${live.length} live assignment(s) — revoke them first`,
          409,
        );
      }
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.ROLE_TEMPLATES,
        roleId,
      );
      await recordAudit({
        request,
        actor: authenticated.user,
        action: "access.role_deleted",
        entityType: "role_template",
        entityId: roleId,
        details: {
          name: String(template.name ?? ""),
          slug: String(template.slug ?? ""),
        },
      });

      return ok({ deleted: true });
    }

    if (action === "assign_role") {
      // Writing a template and handing one out are different jobs, so the
      // capability that names the first one is checked here rather than assumed
      // from the coarse gate above: a template editor may not assign.
      const canAssign = await requireAnyCapability(request, [
        "access.assign_roles",
      ]);

      if (!canAssign.user) return canAssign.response;
      // userId/roleId are Appwrite document IDs (36 chars): validating wider
      // only moves the failure to the column size.
      const userId = text(body.userId, 36);
      const roleId = text(body.roleId, 36);
      const scopeType = text(body.scopeType, 30) || "global";
      const scopeId = text(body.scopeId, 100);
      const expiresAt = text(body.expiresAt, 40);

      if (
        !userId ||
        !roleId ||
        !["global", "department", "team", "project"].includes(scopeType)
      ) {
        return fail(
          "VALIDATION",
          "User, role, and valid scope are required",
          400,
        );
      }
      if (expiresAt && !validFutureDate(expiresAt)) {
        return fail("VALIDATION", "expiresAt must be a future ISO date", 400);
      }
      const role = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.ROLE_TEMPLATES,
        roleId,
      );

      if (role.isActive !== true)
        return fail("CONFLICT", "Role is inactive", 409);
      const templateCaps = Array.isArray(role.capabilities)
        ? role.capabilities.filter((c): c is string => typeof c === "string")
        : [];
      const unheldAssign = await unheldCapabilities(
        authenticated.user.$id,
        templateCaps,
      );

      if (unheldAssign.length > 0) {
        return fail(
          "FORBIDDEN",
          `Cannot assign a role with capabilities you do not hold: ${unheldAssign.slice(0, 5).join(", ")}`,
          403,
        );
      }
      // Duplicate guard: avoid stacking N active rows.
      const dupes = await databases
        .listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [
          Query.equal("userId", [userId]),
          Query.equal("roleId", [roleId]),
          Query.equal("isActive", [true]),
          Query.limit(1),
        ])
        .catch(() => ({ documents: [] as unknown[] }));

      if ((dupes as { documents: unknown[] }).documents.length > 0) {
        return fail("CONFLICT", "Active assignment already exists", 409);
      }
      const assignment = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.ROLE_ASSIGNMENTS,
        ID.unique(),
        {
          userId,
          roleId,
          assignedBy: authenticated.user.$id,
          assignedAt: new Date().toISOString(),
          expiresAt: expiresAt || undefined,
          scopeType,
          scopeId: scopeId || undefined,
          isActive: true,
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "access.role_assigned",
        entityType: "role_assignment",
        entityId: assignment.$id,
        details: { userId, roleId, scopeType, scopeId, expiresAt },
      });

      return ok({ assignment }, 201);
    }

    return fail("VALIDATION", "Unknown access action", 400);
  } catch (error) {
    logError("Access mutation error:", error);

    return fail("INTERNAL", "Unable to update access", 500);
  }
}

export async function PATCH(request: NextRequest) {
  // assignmentId edits an assignment (access.assign_roles); roleId rewrites a
  // template (access.manage_role_templates or access.assign_roles). Same split
  // as POST: open on either, narrow per branch.
  const authenticated = await requireAnyCapability(request, [
    "access.assign_roles",
    "access.manage_role_templates",
  ]);

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `access-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const assignmentId = text(body.assignmentId, 100);
    const roleId = text(body.roleId, 100);
    const { databases } = createServerDatabases();

    if (assignmentId) {
      const canAssign = await requireAnyCapability(request, [
        "access.assign_roles",
      ]);

      if (!canAssign.user) return canAssign.response;
      const expiresRaw = text(body.expiresAt, 40);

      if (expiresRaw && !validFutureDate(expiresRaw)) {
        return fail("VALIDATION", "expiresAt must be a future ISO date", 400);
      }
      const assignment = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.ROLE_ASSIGNMENTS,
        assignmentId,
        {
          isActive: body.isActive === true,
          expiresAt: expiresRaw || undefined,
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: assignment.isActive
          ? "access.role_updated"
          : "access.role_revoked",
        entityType: "role_assignment",
        entityId: assignmentId,
        details: {
          expiresAt: expiresRaw || undefined,
          isActive: assignment.isActive,
        },
      });

      return ok({ assignment });
    }
    if (roleId) {
      const rawCaps = Array.isArray(body.capabilities) ? body.capabilities : [];
      // Same legacy-name policy as create_role: map renames, reject typos.
      const capabilities = rawCaps
        .map(normalizeCapability)
        .filter(
          (cap): cap is NonNullable<ReturnType<typeof normalizeCapability>> =>
            cap !== null,
        );
      const unknownCaps = rawCaps.filter(
        (c) =>
          typeof c === "string" &&
          !isCapability(c) &&
          !(c in LEGACY_CAPABILITY_ALIASES),
      );

      if (unknownCaps.length > 0) {
        return fail(
          "VALIDATION",
          `Unknown capabilities: ${unknownCaps.slice(0, 5).join(", ")}`,
          400,
        );
      }

      if (!capabilities.length)
        return fail("VALIDATION", "At least one capability is required", 400);
      const unheldRewrite = await unheldCapabilities(
        authenticated.user.$id,
        capabilities,
      );

      if (unheldRewrite.length > 0) {
        return fail(
          "FORBIDDEN",
          `Cannot grant capabilities you do not hold: ${unheldRewrite.slice(0, 5).join(", ")}`,
          403,
        );
      }
      // Full template edit: name/slug/description ride along when provided.
      // Slug keeps its format rule; uniqueness is enforced by the table index
      // and translated to a 409 below instead of leaking a driver error.
      const updates: Record<string, unknown> = {
        capabilities,
        isActive: body.isActive !== false,
      };

      if (body.name !== undefined) {
        const name = text(body.name, 100);

        if (!name) return fail("VALIDATION", "Role name is required", 400);
        updates.name = name;
      }
      if (body.slug !== undefined) {
        const slug = text(body.slug, 100);

        if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug))
          return fail("VALIDATION", "Invalid role slug", 400);
        updates.slug = slug;
      }
      if (body.description !== undefined) {
        updates.description =
          typeof body.description === "string"
            ? body.description.slice(0, 2000)
            : null;
      }
      // Deactivation retires the template: live assignments resolve through
      // inactive templates to nothing, so refuse while any are still live
      // rather than silently stranding holders.
      if (updates.isActive === false) {
        const live = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.ROLE_ASSIGNMENTS,
          [
            Query.equal("roleId", [roleId]),
            Query.equal("isActive", [true]),
            Query.limit(1),
          ],
        );

        if (live.documents.length > 0) {
          return fail(
            "CONFLICT",
            "Role still has active assignments — revoke them first",
            409,
          );
        }
      }
      let role: Record<string, unknown>;

      try {
        role = (await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.ROLE_TEMPLATES,
          roleId,
          updates,
        )) as unknown as Record<string, unknown>;
      } catch (error) {
        if (isConflict(error)) {
          return fail("CONFLICT", "Another role already uses that slug", 409);
        }
        throw error;
      }

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "access.role_capabilities_updated",
        entityType: "role_template",
        entityId: roleId,
        details: { capabilities },
      });

      return ok({ role });
    }

    return fail("VALIDATION", "assignmentId or roleId is required", 400);
  } catch (error) {
    logError("Access update error:", error);

    return fail("INTERNAL", "Unable to update access", 500);
  }
}
