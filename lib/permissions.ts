/**
 * Greymens — Permission Resolution System
 *
 * Handles RBAC: status-based permissions + scoped powers + department permissions.
 * Admin always has ALL_PERMISSIONS (god-level bypass).
 */

import type {
  MembershipStatus,
  Permission,
  UserPower,
  UserDepartment,
  UserDesignation,
  Power,
  Department,
  Designation,
} from "@/lib/types";

// ============================================================
// Scope-restricted capabilities
// ============================================================

/**
 * Capabilities that are only ever granted inside a department scope.
 *
 * These are deliberately absent from STATUS_PERMISSIONS and
 * DESIGNATION_LEVEL_PERMISSIONS. `resolvePermissions` emits them in the scoped
 * form `${capability}:department:${departmentId}`, and `hasPermission` checks
 * the exact key before the scoped one — so if the same capability were also
 * granted globally, the scoped grant would be unreachable and the scope would
 * enforce nothing. Keeping them here is what makes the scope real.
 */
export const SCOPED_CAPABILITIES = [
  "manage_department_team",
  "draft_events",
] as const;

export type ScopedCapability = (typeof SCOPED_CAPABILITIES)[number];
export type Scope = `department:${string}`;

export function isScopedCapability(value: string): value is ScopedCapability {
  return (SCOPED_CAPABILITIES as readonly string[]).includes(value);
}

// ============================================================
// Status → Base Permissions Map
// ============================================================

const STATUS_PERMISSIONS: Record<MembershipStatus, Permission[]> = {
  no_account: [],
  account: [],
  applicant: [
    "view_public_content",
    "view_resources",
    "view_roadmaps",
    "view_members",
    "submit_application",
    "edit_own_application",
  ],
  member: [
    "view_public_content",
    "view_resources",
    "view_roadmaps",
    "view_members",
    "register_events",
    "view_member_resources",
    "manage_own_profile",
    "view_all_members",
    "request_department_assignment",
  ],
  core_member: [
    "view_public_content",
    "view_resources",
    "view_roadmaps",
    "view_members",
    "register_events",
    "view_member_resources",
    "manage_own_profile",
    "view_all_members",
    "manage_department_resources",
    "participate_in_department_events",
  ],
  lead: [
    "view_public_content",
    "view_resources",
    "view_roadmaps",
    "view_members",
    "register_events",
    "view_member_resources",
    "manage_own_profile",
    "view_all_members",
    "manage_department_resources",
    "participate_in_department_events",
    "view_department_stats",
  ],
  head: [
    "view_public_content",
    "view_resources",
    "view_roadmaps",
    "view_members",
    "register_events",
    "view_member_resources",
    "manage_own_profile",
    "view_all_members",
    "manage_department_resources",
    "participate_in_department_events",
    "view_department_stats",
    "approve_events_in_scope",
    "manage_multiple_departments",
    "view_operations_stats",
  ],
  admin: ["ALL_PERMISSIONS"],
  dev: ["ALL_PERMISSIONS", "system_developer_access"],
  banned: [],
  suspended: [],
  deactivated: [],
};

// ============================================================
// Power → Granted Permissions Map
// ============================================================

const POWER_GRANTS: Record<string, Permission[]> = {
  membership_approver: [
    "approve_applications",
    "reject_applications",
    "view_application_details",
  ],
  event_manager: [
    "create_events",
    "edit_events",
    "delete_events",
    "publish_events",
    "manage_registrations",
  ],
  ticket_verifier: [
    "verify_tickets",
    "manual_checkin",
    "view_attendee_list",
    "invalidate_tickets",
  ],
  blog_creator: ["create_blogs"],
  blog_reviewer: ["approve_blogs", "reject_blogs", "edit_blogs"],
  gallery_manager: ["approve_gallery", "reject_gallery", "delete_gallery"],
  gallery_uploader: ["upload_gallery"],
  resource_manager: ["upload_resources", "edit_resources", "delete_resources"],
  department_head: [
    "manage_department_team",
    "assign_department_roles",
    "view_department_data",
  ],
  operations_head: [
    "manage_multiple_departments",
    "approve_department_events",
    "view_operations_data",
    "assign_designations",
  ],
  profile_moderator: [
    "view_audit_logs",
    "revert_profile_changes",
    "view_sensitive_data",
    "manage_user_accounts",
  ],
  notification_admin: ["send_notifications", "manage_notification_templates"],
  newsletter_manager: ["manage_newsletter", "publish_newsletter"],
  social_media_manager: ["manage_social_media"],
  pr_manager: ["manage_pr_content"],
  design_manager: ["manage_design_assets"],
};

// ============================================================
// Department Role → Permissions Map
// ============================================================

const DEPARTMENT_ROLE_PERMISSIONS: Record<string, Permission[]> = {
  member: [],
  core_member: ["manage_department_resources"],
  lead: ["manage_department_team", "draft_events"],
  // The members route only issues member/core_member/lead today, but a head
  // assignment must never silently grant less than the lead it outranks.
  head: ["manage_department_team", "draft_events"],
};

// ============================================================
// Designation Level → Permissions Map
// ============================================================

/**
 * Designation levels grant seniority, never the wildcard.
 *
 * Level 10 used to map to `ALL_PERMISSIONS`. Because the designation management
 * endpoint accepts any level from 1 to 10, that made "create a designation at
 * level 10 and assign it" a second, unaudited route to total access — one that
 * bypassed the governance tier entirely, since `user_roles` is meant to be the
 * only thing that can confer `admin`/`dev`.
 *
 * The wildcard now comes from exactly one place: `resolvePermissions` returning
 * early for a governance role. Any level-10 row already in a database therefore
 * grants nothing beyond level 9, which is the safe way to retire it — no data
 * migration, and no silently privileged rows left behind.
 */
const DESIGNATION_LEVEL_PERMISSIONS: Record<number, Permission[]> = {
  1: [], // entry-level designations
  2: [],
  3: ["view_department_stats"],
  4: ["view_department_stats"],
  5: ["view_department_stats", "approve_events_in_scope"],
  6: ["view_operations_stats", "manage_multiple_departments"],
  7: ["view_reports", "manage_organization"],
  8: ["view_reports", "manage_organization"],
  9: ["view_reports", "manage_organization"],
  10: ["view_reports", "manage_organization"],
};

// ============================================================
// Core Permission Resolution
// ============================================================

export interface UserContext {
  status: MembershipStatus;
  powers: UserPower[];
  departments: UserDepartment[];
  designations: UserDesignation[];
  allPowers?: Power[];
  allDepartments?: Department[];
  allDesignations?: Designation[];
}

/**
 * Memoised permission sets, keyed on the context object itself.
 *
 * `resolvePermissions` rebuilds up to five Sets and two Maps on every call, and
 * `hasPermission` calls it once per check — so a component asking three
 * questions about the same user rebuilt everything three times, as did every
 * `hasAnyPermission`/`hasAllPermissions` element. A `WeakMap` is safe here
 * because a `UserContext` is a per-request snapshot that callers treat as
 * immutable (nothing in the codebase assigns to its fields after construction),
 * and because holding the key weakly means the cache cannot retain a context
 * after its request has finished.
 */
const permissionCache = new WeakMap<UserContext, Set<string>>();

/**
 * Resolve all effective permissions for a user.
 *
 * The result is cached per context object; see `permissionCache` above. Treat a
 * `UserContext` as immutable after construction — mutating one in place would
 * leave this cache returning stale permissions, and the caller has no way to
 * know.
 */
export function resolvePermissions(user: UserContext): Set<string> {
  const cached = permissionCache.get(user);

  if (cached) return cached;

  const resolved = computePermissions(user);

  permissionCache.set(user, resolved);

  return resolved;
}

function computePermissions(user: UserContext): Set<string> {
  // Admin/Dev bypass — always has everything
  if (user.status === "admin" || user.status === "dev") {
    return new Set(["ALL_PERMISSIONS"]);
  }

  const perms = new Set<string>();

  // 1. Base permissions from status
  const base = STATUS_PERMISSIONS[user.status] || [];

  base.forEach((p) => perms.add(p));

  // 2. Powers
  //
  // `user_powers.powerId` holds either the power document id or the power name
  // depending on which screen created the grant, so resolve whichever
  // identifier we were given to the canonical `powers` row and key the grant
  // map on `name`. Keying on `powerId` directly meant a grant written with a
  // document id — the form produced by `ID.unique()` in the seed script —
  // looked up `undefined` and silently granted nothing, so the entire power
  // layer was inert for any grant created that way.
  const powersById = new Map<string, Power>();
  const powersByName = new Map<string, Power>();

  for (const power of user.allPowers || []) {
    if (power.$id) powersById.set(power.$id, power);
    powersByName.set(power.name, power);
  }

  user.powers
    .filter(
      (p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date()),
    )
    .forEach((up) => {
      const power = powersById.get(up.powerId) || powersByName.get(up.powerId);

      if (!power) return;
      const grants = POWER_GRANTS[power.name] || [];

      grants.forEach((p) => perms.add(p));
    });

  // 3. Department role permissions
  user.departments
    .filter((ud) => ud.isActive)
    .forEach((ud) => {
      const rolePerms = DEPARTMENT_ROLE_PERMISSIONS[ud.role] || [];

      rolePerms.forEach((p) => perms.add(`${p}:department:${ud.departmentId}`));
    });

  // 4. Designation level permissions
  user.designations
    .filter((ud) => ud.isActive)
    .forEach((ud) => {
      const desig = user.allDesignations?.find(
        (d) => d.$id === ud.designationId,
      );

      if (desig) {
        const levelPerms = DESIGNATION_LEVEL_PERMISSIONS[desig.level] || [];

        levelPerms.forEach((p) => perms.add(p));
      }
    });

  return perms;
}

/**
 * Check if a user has a specific permission.
 */
export function hasPermission(
  user: UserContext,
  permission: string,
  scope?: string,
): boolean {
  const perms = resolvePermissions(user);

  // Admin always has everything
  if (perms.has("ALL_PERMISSIONS")) return true;

  // A scope-restricted capability must be checked with its scope. Without it
  // the check would fall through to a global allow, which is how department
  // scoping was previously bypassed. Fail closed instead of granting broadly.
  if (isScopedCapability(permission)) {
    return Boolean(scope) && perms.has(`${permission}:${scope}`);
  }

  // Check exact permission
  if (perms.has(permission)) return true;

  // Check scoped permission
  if (scope && perms.has(`${permission}:${scope}`)) return true;

  return false;
}

/**
 * Check if a user has any of the given permissions.
 */
export function hasAnyPermission(
  user: UserContext,
  permissions: string[],
  scope?: string,
): boolean {
  return permissions.some((p) => hasPermission(user, p, scope));
}

/**
 * Check if a user has all of the given permissions.
 */
export function hasAllPermissions(
  user: UserContext,
  permissions: string[],
  scope?: string,
): boolean {
  return permissions.every((p) => hasPermission(user, p, scope));
}

/**
 * Get all permissions for a user (for debugging/admin view).
 */
export function getAllPermissions(user: UserContext): string[] {
  return Array.from(resolvePermissions(user));
}

// ============================================================
// Power Granting Rules
// ============================================================

/**
 * Check if a user can grant a specific power.
 */
export function canGrantPower(
  grantor: UserContext,
  powerName: string,
  targetDepartmentId?: string,
): boolean {
  // Admin can grant anything
  if (grantor.status === "admin" || grantor.status === "dev") return true;
  // A restricted account grants nothing — including the blanket blog/gallery
  // rules below, which otherwise returned true for every status.
  if (
    grantor.status === "banned" ||
    grantor.status === "suspended" ||
    grantor.status === "deactivated"
  )
    return false;

  const rules: Record<string, (g: UserContext) => boolean> = {
    membership_approver: (g) => g.status === "admin",
    event_manager: (g) =>
      g.status === "admin" || hasPermission(g, "manage_multiple_departments"),
    ticket_verifier: (g) =>
      g.status === "admin" ||
      hasPermission(g, "manage_multiple_departments") ||
      hasPermission(
        g,
        "manage_department_team",
        `department:${targetDepartmentId}`,
      ),
    blog_creator: () => true, // any member can create blogs
    blog_reviewer: (g) => g.status === "admin",
    gallery_manager: (g) => g.status === "admin",
    gallery_uploader: () => true, // any member can upload to gallery
    resource_manager: (g) =>
      g.status === "admin" || hasPermission(g, "manage_multiple_departments"),
    department_head: (g) => g.status === "admin",
    operations_head: (g) => g.status === "admin",
    profile_moderator: (g) => g.status === "admin",
    notification_admin: (g) => g.status === "admin",
    newsletter_manager: (g) => g.status === "admin",
    social_media_manager: (g) => g.status === "admin",
    pr_manager: (g) => g.status === "admin",
    design_manager: (g) => g.status === "admin",
  };

  const checker = rules[powerName];

  return checker ? checker(grantor) : false;
}

// ============================================================
// Helper: Build UserContext from Appwrite data
// ============================================================

export function buildUserContext(data: {
  status: MembershipStatus;
  powers: UserPower[];
  departments: UserDepartment[];
  designations: UserDesignation[];
  allPowers?: Power[];
  allDepartments?: Department[];
  allDesignations?: Designation[];
}): UserContext {
  return {
    status: data.status,
    powers: data.powers,
    departments: data.departments,
    designations: data.designations,
    allPowers: data.allPowers,
    allDepartments: data.allDepartments,
    allDesignations: data.allDesignations,
  };
}
