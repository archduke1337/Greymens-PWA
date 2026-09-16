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
 * `suspended` has no client counterpart, and a restricted account must never
 * inherit member-level UI defaults.
 */
function toMembershipStatus(value: unknown): MembershipStatus {
  if (typeof value !== "string") return "account";
  if (value === "suspended") return "banned";
  return (ROLE_HIERARCHY as string[]).includes(value) || value === "banned" || value === "deactivated"
    ? (value as MembershipStatus)
    : "account";
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
};

const PermissionContext = createContext<PermissionContextType>({
  ...EMPTY_PAYLOAD,
  status: "no_account",
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
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
        // Preserve the last-good payload instead of downgrading to a wrong
        // tier; surface the failure through error state.
        setError(`Unable to load permissions (status ${response.status})`);
        return;
      }
      const data = await response.json() as Record<string, unknown>;
      setPayload({
        status: toMembershipStatus(data.status),
        profile: (data.profile as Profile | null) ?? null,
        application: (data.application as Application | null) ?? null,
        membership: (data.membership as Membership | null) ?? null,
        userDepartments: (data.departments as UserDepartment[]) ?? [],
        userDesignations: (data.designations as UserDesignation[]) ?? [],
        userPowers: (data.powers as UserPower[]) ?? [],
        allDepartments: (data.allDepartments as Department[]) ?? [],
        allDesignations: (data.allDesignations as Designation[]) ?? [],
        allPowers: (data.allPowers as Power[]) ?? [],
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

  const hasPermission = useCallback(
    (permission: string, scope?: string) => {
      if (payload.status === "no_account") return false;
      return checkPermission(
        {
          status: payload.status,
          powers: payload.userPowers,
          departments: payload.userDepartments,
          designations: payload.userDesignations,
          allPowers: payload.allPowers,
          allDepartments: payload.allDepartments,
          allDesignations: payload.allDesignations,
        },
        permission,
        scope
      );
    },
    [payload]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[], scope?: string) => checkAllAnyPermissions(
      {
        status: payload.status,
        powers: payload.userPowers,
        departments: payload.userDepartments,
        designations: payload.userDesignations,
        allPowers: payload.allPowers,
        allDepartments: payload.allDepartments,
        allDesignations: payload.allDesignations,
      },
      permissions,
      scope
    ),
    [payload]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[], scope?: string) => checkAllPermissions(
      {
        status: payload.status,
        powers: payload.userPowers,
        departments: payload.userDepartments,
        designations: payload.userDesignations,
        allPowers: payload.allPowers,
        allDepartments: payload.allDepartments,
        allDesignations: payload.allDesignations,
      },
      permissions,
      scope
    ),
    [payload]
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
      isRole,
      isRoleOrAbove,
      loading,
      error,
      refresh: loadUserData,
    }),
    [payload, hasPermission, hasAnyPermission, hasAllPermissions, isRole, isRoleOrAbove, loading, error, loadUserData]
  );

  return <PermissionContext.Provider value={value}>{children}</PermissionContext.Provider>;
}
