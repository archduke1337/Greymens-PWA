"use client";

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

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { logError } from "@/lib/logger";

import { useAuth } from "./AuthContext";

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
  capabilities: string[];

  /**
   * The capability check, against the server-resolved set from
   * GET /api/permissions (`capabilities: string[]`, `"*"` for admin/dev).
   *
   * This is the only authority check the client has, and deliberately so: the
   * legacy permission vocabulary that used to sit beside it resolved a
   * different set of strings in the browser, so a page gated on it could hide a
   * button the server would have allowed (or show one it would refuse). What a
   * route enforces with `requireCapability` is what the UI asks for here.
   */
  hasCapability: (capability: string) => boolean;
  isRole: (role: MembershipStatus) => boolean;
  isRoleOrAbove: (role: MembershipStatus) => boolean;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

// Server resolveMembershipStatus never emits `lead`/`head` — those tiers were
// folded into capabilities long ago. Keeping them here made isRoleOrAbove
// compare against slots the server cannot return. Order is still ascending.
const ROLE_HIERARCHY: MembershipStatus[] = [
  "no_account",
  "account",
  "applicant",
  "member",
  "core_member",
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

  return (ROLE_HIERARCHY as string[]).includes(value) ||
    value === "banned" ||
    value === "deactivated"
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
  hasCapability: () => false,
  isRole: () => false,
  isRoleOrAbove: () => false,
  loading: true,
  error: null,
  refresh: async () => {},
});

export const usePermissions = () => useContext(PermissionContext);

export function PermissionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, refreshUser } = useAuth();
  const [payload, setPayload] = useState<PermissionsPayload>(EMPTY_PAYLOAD);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Single-shot 401 recovery per sign-in: without the guard, a dead session
  // would refresh-then-retry in a loop on every loadUserData call.
  const recoveredRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

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
      lastUserIdRef.current = null;

      return;
    }
    // New sign-in resets the single-shot recovery budget.
    if (lastUserIdRef.current !== user.$id) {
      lastUserIdRef.current = user.$id;
      recoveredRef.current = false;
    }

    const applyPayload = (data: Record<string, unknown>) => {
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
    };

    try {
      const response = await fetch("/api/permissions", { cache: "no-store" });

      if (!response.ok) {
        // 401 can mean a rotated/expired session rather than a dead one: the
        // auth layer may still be able to re-sync (cookie refresh), so try
        // that exactly once before downgrading. Without this, a stale session
        // silently strips every capability and every gated page bounces the
        // user with no explanation. 403 is a real restriction verdict — a
        // refresh cannot change it, so downgrade immediately.
        if (response.status === 401 && !recoveredRef.current) {
          recoveredRef.current = true;
          try {
            await refreshUser();
          } catch {
            // Session truly dead: fall through to downgrade below.
          }
          const retry = await fetch("/api/permissions", { cache: "no-store" });

          if (retry.ok) {
            applyPayload((await retry.json()) as Record<string, unknown>);

            return;
          }
        }
        if (response.status === 401 || response.status === 403) {
          setPayload(EMPTY_PAYLOAD);
        }
        setError(`Unable to load permissions (status ${response.status})`);

        return;
      }
      const data = (await response.json()) as Record<string, unknown>;

      applyPayload(data);
    } catch (error) {
      logError("Error loading permissions:", error);
      // Preserve the last-good payload instead of downgrading to a wrong tier.
      setError(
        error instanceof Error ? error.message : "Unable to load permissions",
      );
    } finally {
      setLoading(false);
    }
  }, [user, refreshUser]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const hasCapability = useCallback(
    (capability: string) => {
      const set = payload.capabilities;

      return set.includes("*") || set.includes(capability);
    },
    [payload.capabilities],
  );

  const isRole = useCallback(
    (role: MembershipStatus) => payload.status === role,
    [payload.status],
  );

  const isRoleOrAbove = useCallback(
    (role: MembershipStatus) =>
      ROLE_HIERARCHY.indexOf(payload.status) >= ROLE_HIERARCHY.indexOf(role),
    [payload.status],
  );

  const value = useMemo(
    () => ({
      ...payload,
      hasCapability,
      isRole,
      isRoleOrAbove,
      loading,
      error,
      refresh: loadUserData,
    }),
    [
      payload,
      hasCapability,
      isRole,
      isRoleOrAbove,
      loading,
      error,
      loadUserData,
    ],
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}
