import type { NextRequest } from "next/server";
import type { Capability } from "@/lib/capabilities";

import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { fail } from "@/lib/api";
import {
  requireAuthenticatedUser,
  resolveMembershipStatus,
  isBootstrapAdmin,
  RESTRICTED_STATUSES,
  type AuthResult,
} from "@/lib/server-auth";
import { OFFICE_CAPABILITIES, isCapability } from "@/lib/capabilities";

// The capability vocabulary lives in a dependency-free module so client
// components can render it without importing this server-only file.
export { CAPABILITIES, isCapability } from "@/lib/capabilities";
export type { Capability } from "@/lib/capabilities";

export interface RoleTemplate {
  $id?: string;
  name: string;
  slug: string;
  description?: string;
  capabilities: Capability[];
  teamId?: string;
  teamRole?: string;
  label?: string;
  isActive: boolean;
}

export interface RoleAssignment {
  $id?: string;
  userId: string;
  roleId: string;
  assignedBy: string;
  assignedAt: string;
  expiresAt?: string;
  scopeType?: "global" | "department" | "team" | "project";
  scopeId?: string;
  isActive: boolean;
}

const ADMIN_STATUSES = new Set(["admin", "dev"]);

/**
 * Operational power -> the capabilities it confers.
 *
 * The console has always offered both a Roles tab (capabilities on a role
 * template) and a Powers tab (legacy `user_powers` grants), but only two power
 * names were ever translated into capabilities — so 14 of the 16 seeded powers
 * looked authoritative in the UI and satisfied no `requireCapability` check.
 *
 * This table is the translation the Powers tab was missing: a power is now a
 * named bundle of capabilities, exactly like a role, and a grant made there
 * reaches the same server checks a role grant does.
 *
 * A power with an empty list is honest, not an oversight: the capability
 * vocabulary has no equivalent for it (`gallery_uploader` — uploading is
 * membership-open; `social_media_manager`, `pr_manager`, `design_manager` —
 * still legacy-only). Such a grant confers nothing today; the four are listed
 * here so the gap is visible instead of implied.
 */
export const POWER_CAPABILITIES: Record<string, Capability[]> = {
  membership_approver: [
    "membership.view_applications",
    "membership.approve",
    "membership.reject",
  ],
  event_manager: [
    "events.create",
    "events.update",
    "events.manage",
    "events.approve",
    "events.publish",
    "registrations.view",
    "registrations.manage",
  ],
  ticket_verifier: ["tickets.view", "tickets.verify", "tickets.invalidate"],
  blog_creator: ["blog.create"],
  blog_reviewer: ["blog.review", "blog.approve"],
  gallery_manager: ["gallery.manage"],
  gallery_uploader: [],
  resource_manager: ["resources.manage"],
  // No department-scoped capability exists yet, so these two map to the
  // global department views rather than inventing a wider grant.
  department_head: ["departments.view"],
  operations_head: [
    "departments.manage",
    "events.approve",
    "designations.assign",
    "registrations.view",
  ],
  profile_moderator: ["users.view", "users.update", "audit.view"],
  notification_admin: ["notifications.send"],
  newsletter_manager: ["notifications.send"],
  social_media_manager: [],
  pr_manager: [],
  design_manager: [],
};

function activeDate(expiresAt: unknown): boolean {
  return (
    typeof expiresAt !== "string" ||
    !expiresAt ||
    new Date(expiresAt).getTime() > Date.now()
  );
}

export async function getEffectiveCapabilities(
  userId: string,
  scope?: { type: string; id?: string },
  knownStatus?: string,
): Promise<Set<string>> {
  const { databases } = createServerDatabases();

  // Admin has all and every power — single wildcard, enforced in
  // hasServerCapability. No office, role, or power row can add
  // beyond this, and none is needed for admin.
  // Status is resolved once: restriction outranks every grant, so a banned,
  // suspended, or deactivated user keeps no capability even when stale
  // role/office/power rows still reference them.
  const status = knownStatus ?? (await resolveMembershipStatus(userId));

  if (ADMIN_STATUSES.has(status)) return new Set(["*"]);
  if (RESTRICTED_STATUSES.has(status)) return new Set<string>();

  const powers = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.USER_POWERS,
    [
      Query.equal("userId", [userId]),
      Query.equal("isActive", [true]),
      Query.limit(100),
    ],
  );
  let assignments: { documents: Array<Record<string, unknown>> } = {
    documents: [],
  };
  let roles: { documents: Array<Record<string, unknown>> } = { documents: [] };
  let offices: { documents: Array<Record<string, unknown>> } = {
    documents: [],
  };
  let userDesignations: { documents: Array<Record<string, unknown>> } = {
    documents: [],
  };

  try {
    const [
      assignmentResponse,
      roleResponse,
      officeResponse,
      designationResponse,
    ] = await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [
          Query.equal("userId", [userId]),
          Query.equal("isActive", [true]),
          Query.limit(100),
        ]),
        // Not filtered on isActive: an office's capabilities come from its
        // template, and "template exists but is switched off" (grant nothing)
        // must stay distinguishable from "no template yet" (seed default).
        databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, [
          Query.limit(200),
        ]),
        databases
          .listDocuments(DATABASE_ID, COLLECTIONS.OFFICE_ASSIGNMENTS, [
            Query.equal("userId", [userId]),
            Query.equal("status", ["active"]),
            Query.limit(100),
          ])
          .catch(() => ({ documents: [] as Array<Record<string, unknown>> })),
        databases
          .listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(50),
          ])
          .catch(() => ({ documents: [] as Array<Record<string, unknown>> })),
      ]);

    assignments = {
      documents: assignmentResponse.documents as Array<Record<string, unknown>>,
    };
    roles = {
      documents: roleResponse.documents as Array<Record<string, unknown>>,
    };
    offices = {
      documents:
        (officeResponse as { documents: Array<Record<string, unknown>> })
          .documents ?? [],
    };
    userDesignations = {
      documents:
        (designationResponse as { documents: Array<Record<string, unknown>> })
          .documents ?? [],
    };
  } catch {
    // Existing installations may not have the role tables yet; legacy powers remain valid.
  }

  const capabilities = new Set<string>();

  // A title can carry capabilities, but only when an administrator listed them
  // explicitly (see the `capabilities` column on `designations`). The catalogue
  // is read only when the account actually holds a title: the common case pays
  // nothing, and a request that never touches a designation pays no extra read.
  if (userDesignations.documents.length > 0) {
    try {
      const catalogue = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.DESIGNATIONS,
        [Query.equal("isActive", [true]), Query.limit(200)],
      );
      const heldIds = new Set(
        userDesignations.documents.map((row) => String(row.designationId ?? "")),
      );

      for (const row of catalogue.documents) {
        if (!heldIds.has(String(row.$id ?? ""))) continue;
        const values = Array.isArray(row.capabilities) ? row.capabilities : [];

        for (const value of values) {
          if (isCapability(value)) capabilities.add(value);
        }
      }
    } catch {
      // Catalogue unreadable — a held title grants nothing rather than
      // everything. Fail closed.
    }
  }

  // Grants may store either the catalogue row id or the power name: the seed
  // writes the name as the row id, older rows hold a generated id. Resolve
  // both, or the bridge below is silently inert for one of the two forms.
  const powerNameById = new Map<string, string>();

  try {
    const catalog = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.POWERS,
      [Query.limit(200)],
    );

    for (const row of catalog.documents) {
      const power = row as Record<string, unknown> & {
        $id: string;
        name?: unknown;
      };

      powerNameById.set(
        power.$id,
        typeof power.name === "string" && power.name ? power.name : power.$id,
      );
    }
  } catch {
    // Catalog unreadable — name-keyed grants still resolve below.
  }

  // Charter offices grant capabilities (Option B). Active assignment only,
  // and the term must not have ended: time alone revokes charter powers, no
  // human needed. Only well-formed past dates count — a garbage termEnd must
  // never silently strip (or extend) authority; fix the row instead.
  //
  // The capabilities are read from the office's role template, not from the
  // compile-time map: offices and roles are the same grant (a capability
  // bundle), so they share one table and one editable source. The map is only
  // the seed default, used until the template exists.
  for (const o of offices.documents) {
    const officeId = String(o.officeId ?? "");
    const termEnd = typeof o.termEnd === "string" ? o.termEnd : "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(termEnd) && termEnd < new Date().toISOString().slice(0, 10)) continue;

    officeCapabilities(officeId, roles.documents).forEach((c) =>
      capabilities.add(c),
    );
  }
  for (const power of powers.documents) {
    const row = power as Record<string, unknown>;

    if (!activeDate(row.expiresAt)) continue;
    const powerId = String(row.powerId || "");
    const name = POWER_CAPABILITIES[powerId]
      ? powerId
      : (powerNameById.get(powerId) ?? powerId);

    for (const capability of POWER_CAPABILITIES[name] ?? []) {
      capabilities.add(capability);
    }
  }

  const roleMap = new Map(
    roles.documents.map((role) => [String(role.$id || ""), role]),
  );

  for (const assignment of assignments.documents) {
    const row = assignment as Record<string, unknown>;

    if (!activeDate(row.expiresAt)) continue;
    // Fail closed on malformed scopes: a missing scopeType is a legacy global
    // grant, but an unknown non-empty value must never widen into one.
    const rawScope = row.scopeType;
    const assignmentScope =
      typeof rawScope === "string" && rawScope ? rawScope : "global";

    if (
      assignmentScope !== "global" &&
      assignmentScope !== "department" &&
      assignmentScope !== "team" &&
      assignmentScope !== "project"
    )
      continue;
    const assignmentScopeId =
      typeof row.scopeId === "string" ? row.scopeId : undefined;
    const scopeMatches =
      assignmentScope === "global" ||
      (scope &&
        scope.type === assignmentScope &&
        (!assignmentScopeId || scope.id === assignmentScopeId));

    if (!scopeMatches) continue;
    const role = roleMap.get(String(row.roleId));

    if (!role) continue;
    // Template list is unfiltered (see the query above) so inactive templates
    // can be told apart from missing ones — a role assignment must still grant
    // nothing when its template is switched off.
    if (role.isActive !== true) continue;
    const values = Array.isArray(role.capabilities) ? role.capabilities : [];

    // Only known vocabulary becomes a capability. A role-template writer must
    // not be able to mint arbitrary strings (including "*") into privileges.
    values
      .filter(isCapability)
      .forEach((value) => capabilities.add(value));
  }

  return capabilities;
}

export async function hasServerCapability(
  userId: string,
  capability: string,
  scope?: { type: string; id?: string },
): Promise<boolean> {
  const capabilities = await getEffectiveCapabilities(userId, scope);

  return capabilities.has("*") || capabilities.has(capability);
}

/**
 * The capabilities an office confers.
 *
 * An office IS a role: a bundle of capabilities. Its template carries them, so
 * editing the template changes what the office can do — no code change, no
 * redeploy. `OFFICE_CAPABILITIES` is only the seed default, used when no
 * template carries this `officeId` yet (fresh install before seeding, or a
 * template that was deleted).
 *
 * A template that exists but is switched off grants nothing, which is why the
 * caller must pass the *unfiltered* template list: "inactive" and "absent" must
 * not collapse into the same answer.
 */
export function officeCapabilities(
  officeId: string,
  templates: Array<Record<string, unknown>>,
): Capability[] {
  const template = templates.find((row) => row.officeId === officeId);

  if (template) {
    if (template.isActive !== true) return [];
    const values = Array.isArray(template.capabilities)
      ? template.capabilities
      : [];

    return values.filter(isCapability);
  }

  return OFFICE_CAPABILITIES[officeId] ?? [];
}

/** `officeCapabilities` against a live template read, for route-side checks. */
export async function getOfficeCapabilities(
  officeId: string,
): Promise<Capability[]> {
  const { databases } = createServerDatabases();

  try {
    const templates = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.ROLE_TEMPLATES,
      [Query.equal("officeId", [officeId]), Query.limit(1)],
    );

    return officeCapabilities(
      officeId,
      templates.documents as Array<Record<string, unknown>>,
    );
  } catch {
    // Column or table missing (pre-migration database): seed default.
    return OFFICE_CAPABILITIES[officeId] ?? [];
  }
}

/**
 * Capabilities in `caps` that `actorId` does not hold.
 *
 * "No grant beyond hold": a manager may only hand out capability they hold
 * themselves, otherwise any holder of `access.assign_roles` could mint a
 * superset for themselves. Admins hold `"*"` and bypass. Shared so the office
 * route applies the same rule the role route does — they used to differ, which
 * meant the same grant was checked through one door and unchecked through the
 * other.
 */
export async function unheldCapabilities(
  actorId: string,
  caps: readonly string[],
): Promise<string[]> {
  const held = await getEffectiveCapabilities(actorId);

  if (held.has("*")) return [];
  return caps.filter((cap) => !held.has(cap));
}

export async function requireCapability(
  request: NextRequest,
  capability: string,
  scope?: { type: string; id?: string },
): Promise<AuthResult> {
  return requireAnyCapability(request, [capability], scope);
}

/**
 * `requireCapability` for a set: the caller needs any one of them.
 *
 * Used where one action is legitimately reachable through more than one grant —
 * an event's `approve` step through a blanket `events.manage` or through the
 * narrower `events.approve`, an office's template edits through
 * `access.manage_role_templates` or `access.assign_roles`. Expressing the
 * alternatives here keeps the restriction and bootstrap rules in one place;
 * a route that re-implemented the preamble would eventually miss one.
 *
 * One capability read for the whole set, not one per candidate.
 */
export async function requireAnyCapability(
  request: NextRequest,
  capabilities: readonly string[],
  scope?: { type: string; id?: string },
): Promise<AuthResult> {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated;
  // Belt and braces: getEffectiveCapabilities already returns an empty set
  // for restricted statuses, but the ban check must not depend on that
  // remaining true through future refactors of the capability pipeline.
  const status = await resolveMembershipStatus(authenticated.user.$id);

  if (RESTRICTED_STATUSES.has(status)) {
    return {
      user: null,
      response: fail("FORBIDDEN", "Forbidden", 403),
    };
  }
  // Bootstrap escape hatch (ADMIN_EMAILS): the first administrator exists
  // before any user_roles row does, so the DB-only status above resolves to
  // "account" for them. Honor the same allowlist the status ladder uses —
  // after the restriction check, so a ban still wins.
  if (isBootstrapAdmin(authenticated.user.email)) return authenticated;

  const held = await getEffectiveCapabilities(authenticated.user.$id, scope);

  if (held.has("*") || capabilities.some((capability) => held.has(capability))) {
    return authenticated;
  }

  return {
    user: null,
    response: fail("FORBIDDEN", "Forbidden", 403),
  };
}

export async function getAccessSummary(userId: string, knownStatus?: string) {
  const status = knownStatus ?? (await resolveMembershipStatus(userId));
  const capabilities = await getEffectiveCapabilities(userId, undefined, status);
  return { status, capabilities: Array.from(capabilities).sort() };
}
