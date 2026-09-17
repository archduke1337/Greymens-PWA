"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext";
import {
  hasPermission as checkPermission,
  hasAnyPermission as checkAllAnyPermissions,
  hasAllPermissions as checkAllPermissions,
} from "@/lib/permissions";
import type {
  MembershipStatus,
  Profile,
  Application,
  Membership,
  UserDepartment,
  UserDesignation,
  UserPower,
  Department,
  Designation,
  Power,
} from "@/lib/types";

interface PermissionContextType {
  status: MembershipStatus;
  profile: Profile | null;
  application: Application | null;
  membership: Membership | null;
  userDepartments: UserDepartment[];
  userDesignations: UserDesignation[];
  userPowers: UserPower[];
  allDepartments: Department[];
  allDesignations: Designation[];
  allPowers: Power[];
  hasPermission: (permission: string, scope?: string) => boolean;
  hasAnyPermission: (permissions: string[], scope?: string) => boolean;
  hasAllPermissions: (permissions: string[], scope?: string) => boolean;
  /**
   * New-vocabulary capability check against the server-resolved set from
   * GET /api/permissions (`capabilities: string[]`, `"*"` for admin/dev).
   * Use this — not hasPermission — for anything the server gates with
   * requireCapability, or office holders will be bounced despite valid
   * grants: hasPermission only knows the legacy permission vocabulary.
   */
  hasCapability: (capability: string) => boolean;
  isRole: (role: MembershipStatus) => boolean;
  isRoleOrAbove: (role: MembershipStatus) => boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const ROLE_HIERARCHY: MembershipStatus[] = [
  "no_account",
  "account",
  "applicant",
  "member",
  "core_member",
  "lead",
  "head",
  "admin",
  "dev",
];

/**
 * The server is the authority on status. Anything it can return that this union
 * does not model is treated conservatively rather than optimistically:
 * `suspended` has no client counterpart, a restricted account must never
 * inherit member-level UI defaults, and an unknown value means the client and
 * server vocabularies have drifted — which must show nothing, not the
 * member funnel.
 */
function toMembershipStatus(value: unknown): MembershipStatus {
  if (typeof value !== "string") return "no_account";
  if (value === "suspended") return "banned";
  return (ROLE_HIERARCHY as string[]).includes(value) || value === "banned" || value === "deactivated"
    ? (value as MembershipStatus)
    : "no_account";
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

interface PermissionsPayload {
  status: MembershipStatus;
  profile: Profile | null;
  application: Application | null;
  membership: Membership | null;
  userDepartments: UserDepartment[];
  userDesignations: UserDesignation[];
  userPowers: UserPower[];
  allDepartments: Department[];
  allDesignations: Designation[];
  allPowers: Power[];
  capabilities: string[];
}

const EMPTY_PAYLOAD: PermissionsPayload = {
  status: "no_account",
  profile: null,
  application: null,
  membership: null,
  userDepartments: [],
  userDesignations: [],
  userPowers: [],
  allDepartments: [],
  allDesignations: [],
  allPowers: [],
  capabilities: [],
};

const PermissionContext = createContext<PermissionContextType>({
  ...EMPTY_PAYLOAD,
  status: "no_account",
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  hasCapability: () => false,
  isRole: () => false,
  isRoleOrAbove: () => false,
  loading: true,
  error: null,
  refresh: async () => {},
});

export const usePermissions = () => useContext(PermissionContext);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [payload, setPayload] = useState<PermissionsPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * One authenticated request replaces nine direct database reads.
   *
   * The previous implementation queried `profiles`, `applications`,
   * `memberships`, `user_departments`, `user_designations`, `user_powers`,
   * `departments`, `designations` and `powers` from the browser on every
   * authenticated render, which required every one of those tables — including
   * the identity tables — to be readable by any signed-in account.
   */
  const loadUserData = useCallback(async () => {
    if (!user) {
      setPayload(EMPTY_PAYLOAD);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/permissions", { cache: "no-store" });
      if (!response.ok) {
        // 401/403 means the session is dead or the account was just
        // restricted: holding the previous privileged UI would lie to the
        // user, so downgrade. Any other failure (5xx, network) preserves the
        // last-good payload instead of downgrading to a wrong tier.
        if (response.status === 401 || response.status === 403) {
          setPayload(EMPTY_PAYLOAD);
        }
        setError(`Unable to load permissions (status ${response.status})`);
        return;
      }
      const data = await response.json() as Record<string, unknown>;
      setPayload({
        status: toMembershipStatus(data.status),
        profile: (data.profile as Profile | null) ?? null,
        application: (data.application as Application | null) ?? null,
        membership: (data.membership as Membership | null) ?? null,
        userDepartments: asArray<UserDepartment>(data.departments),
        userDesignations: asArray<UserDesignation>(data.designations),
        userPowers: asArray<UserPower>(data.powers),
        allDepartments: asArray<Department>(data.allDepartments),
        allDesignations: asArray<Designation>(data.allDesignations),
        allPowers: asArray<Power>(data.allPowers),
        capabilities: asArray<string>(data.capabilities),
      });
      setError(null);
    } catch (error) {
      console.error("Error loading permissions:", error);
      // Preserve the last-good payload instead of downgrading to a wrong tier.
      setError(error instanceof Error ? error.message : "Unable to load permissions");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  // One stable snapshot per payload so the WeakMap memo inside
  // lib/permissions actually hits instead of rebuilding Sets on every check.
  const userContext = useMemo(
    () => ({
      status: payload.status,
      powers: payload.userPowers,
      departments: payload.userDepartments,
      designations: payload.userDesignations,
      allPowers: payload.allPowers,
      allDepartments: payload.allDepartments,
      allDesignations: payload.allDesignations,
    }),
    [payload]
  );

  const hasPermission = useCallback(
    (permission: string, scope?: string) => {
      if (payload.status === "no_account") return false;
      return checkPermission(userContext, permission, scope);
    },
    [payload.status, userContext]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[], scope?: string) => checkAllAnyPermissions(userContext, permissions, scope),
    [userContext]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[], scope?: string) => checkAllPermissions(userContext, permissions, scope),
    [userContext]
  );

  const hasCapability = useCallback(
    (capability: string) => {
      const set = payload.capabilities;
      return set.includes("*") || set.includes(capability);
    },
    [payload.capabilities]
  );

  const isRole = useCallback((role: MembershipStatus) => payload.status === role, [payload.status]);

  const isRoleOrAbove = useCallback(
    (role: MembershipStatus) =>
      ROLE_HIERARCHY.indexOf(payload.status) >= ROLE_HIERARCHY.indexOf(role),
    [payload.status]
  );

  const value = useMemo(
    () => ({
      ...payload,
      hasPermission,
      hasAnyPermission,
      hasAllPermissions,
      hasCapability,
      isRole,
      isRoleOrAbove,
      loading,
      error,
      refresh: loadUserData,
    }),
    [payload, hasPermission, hasAnyPermission, hasAllPermissions, hasCapability, isRole, isRoleOrAbove, loading, error, loadUserData]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}
