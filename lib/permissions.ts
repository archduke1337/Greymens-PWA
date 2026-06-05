/**
 * Mind Mesh — Permission Resolution System
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
    "manage_department_team",
    "draft_events",
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
    "manage_department_team",
    "draft_events",
    "view_department_stats",
    "approve_events_in_scope",
    "manage_multiple_departments",
    "view_operations_stats",
  ],
  admin: ["ALL_PERMISSIONS"],
  dev: ["ALL_PERMISSIONS", "system_developer_access"],
  banned: [],
  deactivated: [],
};

// ============================================================
// Power → Granted Permissions Map
// ============================================================

const POWER_GRANTS: Record<string, Permission[]> = {
  membership_approver: ["approve_applications", "reject_applications", "view_application_details"],
  event_manager: ["create_events", "edit_events", "publish_events", "manage_registrations"],
  ticket_verifier: ["verify_tickets", "manual_checkin", "view_attendee_list"],
  blog_creator: ["create_blogs"],
  blog_reviewer: ["approve_blogs", "reject_blogs", "edit_blogs"],
  gallery_manager: ["approve_gallery", "reject_gallery", "delete_gallery"],
  gallery_uploader: ["upload_gallery"],
  resource_manager: ["upload_resources", "edit_resources", "delete_resources"],
  department_head: ["manage_department_team", "assign_department_roles", "view_department_data"],
  operations_head: ["manage_multiple_departments", "approve_department_events", "view_operations_data"],
  profile_moderator: ["view_audit_logs", "revert_profile_changes", "view_sensitive_data"],
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
};

// ============================================================
// Designation Level → Permissions Map
// ============================================================

const DESIGNATION_LEVEL_PERMISSIONS: Record<number, Permission[]> = {
  1: [], // entry-level designations
  2: [],
  3: ["view_department_stats"],
  4: ["view_department_stats", "manage_department_team"],
  5: ["view_department_stats", "manage_department_team", "approve_events_in_scope"],
  6: ["view_operations_stats", "manage_multiple_departments"],
  7: ["view_reports", "manage_organization"],
  8: ["view_reports", "manage_organization"],
  9: ["view_reports", "manage_organization"],
  10: ["ALL_PERMISSIONS"], // admin-level
};

// ============================================================
// Core Permission Resolution
// ============================================================

interface UserContext {
  status: MembershipStatus;
  powers: UserPower[];
  departments: UserDepartment[];
  designations: UserDesignation[];
  allPowers?: Power[];
  allDepartments?: Department[];
  allDesignations?: Designation[];
}

/**
 * Resolve all effective permissions for a user.
 */
export function resolvePermissions(user: UserContext): Set<string> {
  // Admin/Dev bypass — always has everything
  if (user.status === "admin" || user.status === "dev") {
    return new Set(["ALL_PERMISSIONS"]);
  }

  const perms = new Set<string>();

  // 1. Base permissions from status
  const base = STATUS_PERMISSIONS[user.status] || [];
  base.forEach((p) => perms.add(p));

  // 2. Scoped powers
  user.powers
    .filter((p) => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date()))
    .forEach((up) => {
      const grants = POWER_GRANTS[up.powerId] || [];
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
      const desig = user.allDesignations?.find((d) => d.$id === ud.designationId);
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
  scope?: string
): boolean {
  const perms = resolvePermissions(user);

  // Admin always has everything
  if (perms.has("ALL_PERMISSIONS")) return true;

  // Check exact permission
  if (perms.has(permission)) return true;

  // Check scoped permission
  if (scope && perms.has(`${permission}:${scope}`)) return true;

  // Check wildcard
  if (perms.has(`${permission}:*`)) return true;

  return false;
}

/**
 * Check if a user has any of the given permissions.
 */
export function hasAnyPermission(
  user: UserContext,
  permissions: string[],
  scope?: string
): boolean {
  return permissions.some((p) => hasPermission(user, p, scope));
}

/**
 * Check if a user has all of the given permissions.
 */
export function hasAllPermissions(
  user: UserContext,
  permissions: string[],
  scope?: string
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
  targetDepartmentId?: string
): boolean {
  // Admin can grant anything
  if (grantor.status === "admin" || grantor.status === "dev") return true;

  const rules: Record<string, (g: UserContext) => boolean> = {
    membership_approver: (g) => g.status === "admin",
    event_manager: (g) =>
      g.status === "admin" ||
      hasPermission(g, "manage_multiple_departments"),
    ticket_verifier: (g) =>
      g.status === "admin" ||
      hasPermission(g, "manage_multiple_departments") ||
      hasPermission(g, "manage_department_team", `department:${targetDepartmentId}`),
    blog_creator: () => true, // any member can create blogs
    blog_reviewer: (g) => g.status === "admin",
    gallery_manager: (g) => g.status === "admin",
    gallery_uploader: () => true, // any member can upload to gallery
    resource_manager: (g) =>
      g.status === "admin" ||
      hasPermission(g, "manage_multiple_departments"),
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
