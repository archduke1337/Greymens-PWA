"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth } from "./AuthContext";
import { resolvePermissions, hasPermission as checkPermission, hasAnyPermission as checkAnyPermission, hasAllPermissions as checkAllPermissions } from "@/lib/permissions";
import { profileService } from "@/lib/profiles";
import { applicationService } from "@/lib/applications";
import { membershipService } from "@/lib/memberships";
import { departmentService } from "@/lib/departments";
import { designationService } from "@/lib/designations";
import { powerService } from "@/lib/powers";
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
  loading: boolean;
  refresh: () => Promise<void>;
}

const PermissionContext = createContext<PermissionContextType>({
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
  hasPermission: () => false,
  hasAnyPermission: () => false,
  hasAllPermissions: () => false,
  loading: true,
  refresh: async () => {},
});

export const usePermissions = () => useContext(PermissionContext);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [status, setStatus] = useState<MembershipStatus>("no_account");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [application, setApplication] = useState<Application | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [userDepartments, setUserDepartments] = useState<UserDepartment[]>([]);
  const [userDesignations, setUserDesignations] = useState<UserDesignation[]>([]);
  const [userPowers, setUserPowers] = useState<UserPower[]>([]);
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allDesignations, setAllDesignations] = useState<Designation[]>([]);
  const [allPowers, setAllPowers] = useState<Power[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async () => {
    if (!user) {
      setStatus("no_account");
      setProfile(null);
      setApplication(null);
      setMembership(null);
      setUserDepartments([]);
      setUserDesignations([]);
      setUserPowers([]);
      setLoading(false);
      return;
    }

    try {
      const [profileData, appData, memData, depts, desigs, powers, allDepts, allDesigs, allPowersData] = await Promise.all([
        profileService.getByUserId(user.$id),
        applicationService.getByUserId(user.$id),
        membershipService.getByUserId(user.$id),
        departmentService.getUserDepartments(user.$id),
        designationService.getUserDesignations(user.$id),
        powerService.getUserPowers(user.$id),
        departmentService.getAll(),
        designationService.getAll(),
        powerService.getAll(),
      ]);

      setProfile(profileData);
      setApplication(appData);
      setMembership(memData);
      setUserDepartments(depts);
      setUserDesignations(desigs);
      setUserPowers(powers);
      setAllDepartments(allDepts);
      setAllDesignations(allDesigs);
      setAllPowers(allPowersData);

      // Determine status
      if (memData?.status === "active") {
        setStatus("member");
      } else if (appData?.status === "approved") {
        setStatus("member");
      } else if (appData?.status === "pending") {
        setStatus("applicant");
      } else if (appData?.status === "rejected") {
        setStatus("applicant");
      } else if (profileData) {
        setStatus("account");
      } else {
        setStatus("account");
      }

      // Check for elevated roles via designations
      if (desigs.length > 0) {
        const highestLevel = Math.max(...desigs.map(d => {
          const desig = allDesigs.find(dd => dd.$id === d.designationId);
          return desig?.level || 0;
        }));
        if (highestLevel >= 5) setStatus("lead");
        if (highestLevel >= 6) setStatus("head");
      }

      // Check admin via email (simple check for now)
      if (user.email === "admin@mindmesh.club" || user.email === "gauravramyadav@gmail.com") {
        setStatus("admin");
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadUserData();
  }, [loadUserData]);

  const hasPermission = useCallback(
    (permission: string, scope?: string) => {
      if (status === "no_account") return false;
      return checkPermission(
        {
          status,
          powers: userPowers,
          departments: userDepartments,
          designations: userDesignations,
          allPowers,
          allDepartments,
          allDesignations,
        },
        permission,
        scope
      );
    },
    [status, userPowers, userDepartments, userDesignations, allPowers, allDepartments, allDesignations]
  );

  const hasAnyPermission = useCallback(
    (permissions: string[], scope?: string) => {
      return permissions.some((p) => hasPermission(p, scope));
    },
    [hasPermission]
  );

  const hasAllPermissions = useCallback(
    (permissions: string[], scope?: string) => {
      return permissions.every((p) => hasPermission(p, scope));
    },
    [hasPermission]
  );

  return (
    <PermissionContext.Provider
      value={{
        status,
        profile,
        application,
        membership,
        userDepartments,
        userDesignations,
        userPowers,
        allDepartments,
        allDesignations,
        allPowers,
        hasPermission,
        hasAnyPermission,
        hasAllPermissions,
        loading,
        refresh: loadUserData,
      }}
    >
      {children}
    </PermissionContext.Provider>
  );
}
