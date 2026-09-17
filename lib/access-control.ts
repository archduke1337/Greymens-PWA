import type { NextRequest } from "next/server";
import type { Capability } from "@/lib/capabilities";

import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { fail } from "@/lib/api";
import {
  requireAuthenticatedUser,
  resolveMembershipStatus,
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
  // hasServerCapability + hasPower. No office, role, or power row can add
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

  try {
    const [assignmentResponse, roleResponse, officeResponse] =
      await Promise.all([
        databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_ASSIGNMENTS, [
          Query.equal("userId", [userId]),
          Query.equal("isActive", [true]),
          Query.limit(100),
        ]),
        databases.listDocuments(DATABASE_ID, COLLECTIONS.ROLE_TEMPLATES, [
          Query.equal("isActive", [true]),
          Query.limit(100),
        ]),
        databases
          .listDocuments(DATABASE_ID, COLLECTIONS.OFFICE_ASSIGNMENTS, [
            Query.equal("userId", [userId]),
            Query.equal("status", ["active"]),
            Query.limit(100),
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
  } catch {
    // Existing installations may not have the role tables yet; legacy powers remain valid.
  }

  const capabilities = new Set<string>();

  // Charter offices grant capabilities (Option B). Active assignment only;
  // term enforcement lives in offices route (active/ended/vacant).
  for (const o of offices.documents) {
    const officeId = String(o.officeId ?? "");
    const caps = OFFICE_CAPABILITIES[officeId] ?? [];

    caps.forEach((c) => capabilities.add(c));
  }
  for (const power of powers.documents) {
    if (activeDate((power as Record<string, unknown>).expiresAt)) {
      const powerId = String((power as Record<string, unknown>).powerId || "");

      if (powerId === "blog_creator") capabilities.add("blog.create");
      if (powerId === "blog_reviewer") {
        capabilities.add("blog.review");
        capabilities.add("blog.approve");
        capabilities.add("blog.request_revision");
      }
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
 * Check a legacy `user_powers` grant.
 *
 * Admin has every power by definition — returns true before any table lookup.
 * The capability vocabulary covers governance and content workflows, while the
 * operational powers (`ticket_verifier`, `gallery_manager`, ...) still live in
 * the powers table. Both are needed until that migration completes, so the check
 * is shared here rather than re-implemented inside each route.
 */
export async function hasPower(
  userId: string,
  powerId: string,
): Promise<boolean> {
  // Admin wildcard: all and every power, no row required.
  // Restriction outranks grants here too: a banned user keeps no power even
  // when the grant row has not been cleaned up yet.
  try {
    const status = await resolveMembershipStatus(userId);

    if (ADMIN_STATUSES.has(status)) return true;
    if (RESTRICTED_STATUSES.has(status)) return false;
  } catch {
    // Fall through to table check on status resolution failure.
  }
  const { databases } = createServerDatabases();
  // Resolve both id and name: grants may store either (see permissions.ts dual
  // resolution). Fetch catalog once to map.
  let acceptedIds = new Set<string>([powerId]);

  try {
    const catalog = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.POWERS,
      [Query.limit(200)],
    );

    for (const p of catalog.documents) {
      const row = p as Record<string, unknown> & {
        $id: string;
        name?: unknown;
      };

      if (row.$id === powerId && typeof row.name === "string")
        acceptedIds.add(row.name);
      if (typeof row.name === "string" && row.name === powerId)
        acceptedIds.add(row.$id);
    }
  } catch {
    // Catalog unreadable — fall back to exact match.
  }
  const response = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.USER_POWERS,
    [
      Query.equal("userId", [userId]),
      Query.equal("powerId", [...acceptedIds]),
      Query.equal("isActive", [true]),
      Query.limit(10),
    ],
  );

  return response.documents.some((document) => {
    const expiresAt = (document as Record<string, unknown>).expiresAt;

    return (
      typeof expiresAt !== "string" ||
      !expiresAt ||
      new Date(expiresAt).getTime() > Date.now()
    );
  });
}

export async function requireCapability(
  request: NextRequest,
  capability: string,
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
  if (!(await hasServerCapability(authenticated.user.$id, capability, scope))) {
    return {
      user: null,
      response: fail("FORBIDDEN", "Forbidden", 403),
    };
  }

  return authenticated;
}

export async function getAccessSummary(userId: string, knownStatus?: string) {
  const status = knownStatus ?? (await resolveMembershipStatus(userId));
  const capabilities = await getEffectiveCapabilities(userId, undefined, status);
  return { status, capabilities: Array.from(capabilities).sort() };
}
