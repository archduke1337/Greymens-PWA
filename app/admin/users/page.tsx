// app/admin/users/page.tsx
"use client";
import type {
  Profile,
  Membership,
  Department,
  Designation,
  Power,
  UserDepartment,
  UserDesignation,
  UserPower,
  AuditLog,
} from "@/lib/types";

import { useEffect, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  UsersIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  UserMinusIcon,
  UserCheckIcon,
  PencilIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MailIcon,
  CalendarIcon,
  BriefcaseIcon,
  AwardIcon,
  ZapIcon,
  XIcon,
  EyeIcon,
  HistoryIcon,
  CheckCircleIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader, TableContent, TableScrollContainer,
  TableRow,
  useOverlayState,
} from "@heroui/react";

import { getErrorMessage } from "@/lib/errorHandler";
import { auditService } from "@/lib/audit";
import { useAuth } from "@/context/AuthContext";

type StatusFilter = "all" | "active" | "inactive" | "banned" | "suspended" | "deactivated" | "no_account";
type ChipColor = "accent" | "danger" | "default" | "success" | "warning";

interface EnrichedUser {
  profile: Profile;
  membership: Membership | null;
  departments: UserDepartment[];
  designations: UserDesignation[];
  powers: UserPower[];
}

/** Label used in confirmations. Prefers the account name; a raw 36-character account id is not readable. */
function userLabel(user: EnrichedUser, names: Record<string, string> = {}): string {
  return names[user.profile.userId] || user.profile.urn?.trim() || user.profile.userId.slice(0, 8);
}

export default function AdminUsersPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOpen, open, close } = useOverlayState();
  const {
    isOpen: isAuditOpen,
    open: openAudit,
    close: closeAudit,
  } = useOverlayState();

  const [enrichedUsers, setEnrichedUsers] = useState<EnrichedUser[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [allDepartments, setAllDepartments] = useState<Department[]>([]);
  const [allDesignations, setAllDesignations] = useState<Designation[]>([]);
  const [allPowers, setAllPowers] = useState<Power[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState<Partial<Profile>>({});
  const [saving, setSaving] = useState(false);

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [auditUser, setAuditUser] = useState<EnrichedUser | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [grantDesigId, setGrantDesigId] = useState("");
  const [grantPowerId, setGrantPowerId] = useState("");
  const [grantBusy, setGrantBusy] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadAllData();
  }, [user, authLoading, router]);

  /**
   * One request returns every account joined to its membership, departments,
   * designations and powers, plus the reference catalogues used to render names.
   *
   * The browser previously read all profiles and then issued four further
   * queries per profile, which is why the identity tables had to be readable by
   * any signed-in account. The join now happens server-side behind
   * `requireAdmin`.
   */
  const loadAllData = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const response = await fetch("/api/admin/users?limit=500", {
        cache: "no-store",
      });
      const payload = (await response.json().catch(() => null)) as {
        users?: EnrichedUser[];
        departments?: Department[];
        designations?: Designation[];
        powers?: Power[];
        accountNames?: Record<string, string>;
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(payload?.error || "Failed to load users");

      setAllDepartments(payload?.departments ?? []);
      setAllDesignations(payload?.designations ?? []);
      setAllPowers(payload?.powers ?? []);
      setAccountNames(payload?.accountNames ?? {});
      setEnrichedUsers(payload?.users ?? []);
      return payload?.users ?? [];
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error(getErrorMessage(error) || "Failed to load users");
      return [];
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return enrichedUsers.filter((eu) => {
      const matchesSearch =
        !q ||
        accountNames[eu.profile.userId]?.toLowerCase().includes(q) ||
        eu.profile.userId?.toLowerCase().includes(q) ||
        eu.profile.urn?.toLowerCase().includes(q) ||
        eu.profile.branch?.toLowerCase().includes(q) ||
        eu.profile.phone?.toLowerCase().includes(q) ||
        eu.profile.program?.toLowerCase().includes(q) ||
        eu.profile.skills?.some((s) => s.toLowerCase().includes(q)) ||
        eu.profile.interests?.some((i) => i.toLowerCase().includes(q));

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "no_account" && !eu.membership) ||
        eu.membership?.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [enrichedUsers, searchQuery, statusFilter, accountNames]);

  const stats = useMemo(() => {
    const total = enrichedUsers.length;
    const byStatus = (status: string) =>
      enrichedUsers.filter((eu) => eu.membership?.status === status).length;
    const active = byStatus("active");
    const inactive = byStatus("inactive");
    const banned = byStatus("banned");
    const noMembership = enrichedUsers.filter((eu) => !eu.membership).length;
    // Membership rows outside the headline states (suspended, deactivated,
    // legacy values): counted explicitly so the cards always sum to total.
    const other = total - active - inactive - banned - noMembership;

    return { total, active, inactive, banned, noMembership, other };
  }, [enrichedUsers]);

  const toggleRow = (userId: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);

      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }

      return next;
    });
  };

  const handleViewProfile = (eu: EnrichedUser) => {
    setSelectedUser(eu);
    setEditForm({ ...eu.profile });
    setIsEditing(false);
    setGrantDesigId("");
    setGrantPowerId("");
    open();
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_profile",
          userId: selectedUser.profile.userId,
          // The whole form is sent; the server keeps only editable keys and
          // rejects invalid values, so immutable fields cannot be written.
          fields: editForm,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        user?: Profile;
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(payload?.error || "Failed to update profile");

      toast.success("Profile updated successfully");
      setIsEditing(false);
      if (payload?.user) {
        setSelectedUser((prev) =>
          prev ? { ...prev, profile: payload.user! } : prev,
        );
        setEditForm({ ...payload.user });
      }
      await loadAllData();
    } catch (error) {
      const message = getErrorMessage(error);

      toast.error(message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleViewAudit = async (eu: EnrichedUser) => {
    setAuditUser(eu);
    setLoadingAudit(true);
    openAudit();
    try {
      const logs = await auditService.getUserActivity(eu.profile.userId, 50);

      setAuditLogs(logs);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit logs");
      setAuditLogs([]);
    } finally {
      setLoadingAudit(false);
    }
  };

  /**
   * Every account action goes through one server call.
   *
   * The audit entry is written by the server from the verified session, so the
   * client no longer has any say in who an action is attributed to. The previous
   * implementation also could not work at all: it wrote to the memberships table
   * with the browser SDK, and that table grants no client write permission.
   */
  const applyUserAction = useCallback(
    async (
      eu: EnrichedUser,
      action: string,
      body: Record<string, unknown>,
      successMessage: string,
    ) => {
      setActionLoading(
        // Keyed by the status being set so each row button tracks its own
        // request: `${userId}-banned`, `${userId}-inactive`, `${userId}-active`.
        `${eu.profile.userId}-${String(body.status ?? action)}`,
      );
      try {
        const response = await fetch("/api/admin/users", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, userId: eu.profile.userId, ...body }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok)
          throw new Error(payload?.error || "The change could not be applied");

        toast.success(successMessage);
        await loadAllData();
      } catch (error) {
        toast.error(
          getErrorMessage(error) || "The change could not be applied",
        );
      } finally {
        setActionLoading(null);
      }
    },
    [loadAllData],
  );

  const handleBanUser = async (eu: EnrichedUser) => {
    if (
      !confirm(
        `Ban ${userLabel(eu, accountNames)}? Their access is revoked immediately. This can be reversed later.`,
      )
    )
      return;
    await applyUserAction(
      eu,
      "set_membership_status",
      { status: "banned" },
      "Membership banned",
    );
  };

  const handleDeactivateUser = async (eu: EnrichedUser) => {
    if (
      !confirm(
        `Deactivate ${userLabel(eu, accountNames)}? They keep their record but lose member access.`,
      )
    )
      return;
    await applyUserAction(
      eu,
      "set_membership_status",
      { status: "inactive" },
      "Membership deactivated",
    );
  };

  const handleReactivateUser = async (eu: EnrichedUser) => {
    if (
      !confirm(`Reactivate ${userLabel(eu, accountNames)}? Member access will be restored.`)
    )
      return;
    await applyUserAction(
      eu,
      "set_membership_status",
      { status: "active" },
      "Membership reactivated",
    );
  };

  /**
   * Refresh the open detail panel after a grant/revoke: loadAllData updates
   * the table, but selectedUser is a snapshot that would otherwise show stale
   * designations/powers until the panel is closed and reopened.
   */
  const refreshSelectedUser = useCallback(
    async (userId: string) => {
      const users = await loadAllData();
      const fresh = users.find((eu) => eu.profile.userId === userId);
      if (fresh) {
        setSelectedUser(fresh);
        setEditForm({ ...fresh.profile });
      }
    },
    [loadAllData],
  );

  const handleGrantDesignation = async () => {
    if (!selectedUser || !grantDesigId) return;
    const userId = selectedUser.profile.userId;
    setGrantBusy(`desig-grant`);
    try {
      const response = await fetch("/api/admin/designations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, designationId: grantDesigId }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      // 404 (deactivated designation) and 409 (maxHolders cap reached) carry
      // the real reason — surface it instead of a generic failure.
      if (!response.ok) throw new Error(payload?.error || "Could not grant designation");
      toast.success(`Designation granted to ${userLabel(selectedUser, accountNames)}`);
      setGrantDesigId("");
      await refreshSelectedUser(userId);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not grant designation");
    } finally {
      setGrantBusy(null);
    }
  };

  const handleRevokeDesignation = async (designationId: string, designationName: string) => {
    if (!selectedUser) return;
    if (!confirm(`Revoke "${designationName}" from ${userLabel(selectedUser, accountNames)}?`)) return;
    const userId = selectedUser.profile.userId;
    setGrantBusy(`desig-${designationId}`);
    try {
      const response = await fetch(
        `/api/admin/designations/assign?${new URLSearchParams({ userId, designationId })}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not revoke designation");
      toast.success(`Designation revoked from ${userLabel(selectedUser, accountNames)}`);
      await refreshSelectedUser(userId);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not revoke designation");
    } finally {
      setGrantBusy(null);
    }
  };

  const handleGrantPower = async () => {
    if (!selectedUser || !grantPowerId) return;
    const userId = selectedUser.profile.userId;
    setGrantBusy(`power-grant`);
    try {
      const response = await fetch("/api/admin/powers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "grant", userId, powerId: grantPowerId }),
      });
      const payload = (await response.json().catch(() => null)) as { alreadyGranted?: boolean; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not grant power");
      toast.success(
        payload?.alreadyGranted
          ? `${userLabel(selectedUser, accountNames)} already holds this power — no duplicate created`
          : `Power granted to ${userLabel(selectedUser, accountNames)}`,
      );
      setGrantPowerId("");
      await refreshSelectedUser(userId);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not grant power");
    } finally {
      setGrantBusy(null);
    }
  };

  const handleRevokePower = async (powerId: string, powerName: string) => {
    if (!selectedUser) return;
    if (!confirm(`Revoke "${powerName}" from ${userLabel(selectedUser, accountNames)}? They lose this privilege immediately.`)) return;
    const userId = selectedUser.profile.userId;
    setGrantBusy(`power-${powerId}`);
    try {
      const response = await fetch("/api/admin/powers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke", userId, powerId }),
      });
      const payload = (await response.json().catch(() => null)) as { revoked?: number; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not revoke power");
      toast.success(`Power revoked from ${userLabel(selectedUser, accountNames)}`);
      await refreshSelectedUser(userId);
    } catch (error) {
      toast.error(getErrorMessage(error) || "Could not revoke power");
    } finally {
      setGrantBusy(null);
    }
  };

  const getDepartmentName = (deptId: string) => {
    const dept = allDepartments.find((d) => d.$id === deptId);

    return dept?.name || deptId;
  };

  const getDesignationName = (desigId: string) => {
    const desig = allDesignations.find((d) => d.$id === desigId);

    return desig?.name || desigId;
  };

  const getPowerName = (powerId: string) => {
    const power = allPowers.find((p) => p.$id === powerId);

    return power?.displayName || power?.name || powerId;
  };

  const getRoleLabel = (status: string) => {
    switch (status) {
      case "active":
        return "Active Member";
      case "inactive":
        return "Inactive";
      case "banned":
        return "Banned";
      case "suspended":
        return "Suspended";
      default:
        return "No Membership";
    }
  };

  const getRoleColor = (
    status: string,
  ): "success" | "warning" | "danger" | "default" | "accent" => {
    switch (status) {
      case "active":
        return "success";
      case "inactive":
        return "warning";
      case "banned":
        return "danger";
      case "suspended":
        return "danger";
      default:
        return "default";
    }
  };

  const getDepartmentRoleLabel = (role: string) => {
    switch (role) {
      case "lead":
        return "Lead";
      case "core_member":
        return "Core Member";
      case "member":
        return "Member";
      default:
        return role;
    }
  };

  const getDepartmentRoleColor = (role: string): ChipColor => {
    switch (role) {
      case "lead":
        return "accent";
      case "core_member":
        return "success";
      default:
        return "default";
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return "N/A";
    return parsed.toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (authLoading || loadingUsers) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            User Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Manage all user profiles, roles, and permissions
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Users</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Active Members</p>
                <p className="text-2xl font-bold">{stats.active}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Inactive</p>
                <p className="text-2xl font-bold">{stats.inactive}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <UserMinusIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Banned</p>
                <p className="text-2xl font-bold">{stats.banned}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <ShieldOffIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {(stats.other > 0 || stats.noMembership > 0) && (
          <Card className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-default-500">Other / No membership</p>
                  <p className="text-2xl font-bold">{stats.other + stats.noMembership}</p>
                </div>
                <div className="w-12 h-12 rounded-full bg-default-100 dark:bg-default-900/30 flex items-center justify-center">
                  <UsersIcon className="w-6 h-6 text-default-500" />
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, URN, phone, branch, program, skills..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  "all",
                  "active",
                  "inactive",
                  "banned",
                  "suspended",
                  "deactivated",
                  "no_account",
                ] satisfies StatusFilter[]
              ).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? "primary" : "ghost"}
                  onPress={() => setStatusFilter(status)}
                >
                  {status === "all"
                    ? "All"
                    : status === "active"
                      ? "Active"
                      : status === "no_account"
                        ? "No Membership"
                        : status.charAt(0).toUpperCase() + status.slice(1)}
                </Button>
              ))}
            </div>
          </div>
          <div className="mt-3 text-sm text-default-500">
            Showing {filteredUsers.length} of {enrichedUsers.length} users
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableScrollContainer>
                <TableContent aria-label="Users table" className="min-w-full">
              <TableHeader>
                <TableColumn>USER</TableColumn>
                <TableColumn className="hidden md:table-cell">URN</TableColumn>
                <TableColumn className="hidden lg:table-cell">
                  BRANCH
                </TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn className="hidden lg:table-cell">
                  DEPARTMENTS
                </TableColumn>
                <TableColumn>ACTIONS</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredUsers.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6}>
                      <div className="text-center py-12">
                        <UsersIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                        <p className="text-default-500">
                          {searchQuery
                            ? "No users match your search"
                            : "No users found"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredUsers.map((eu) => (
                    <TableRow key={eu.profile.userId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          {eu.profile.avatar ? (
                            <img
                              alt={eu.profile.userId}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              src={eu.profile.avatar}
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm flex-shrink-0">
                              {eu.profile.userId?.charAt(0)?.toUpperCase() ||
                                "?"}
                            </div>
                          )}
                           <div className="min-w-0">
                            <p className="font-semibold text-sm truncate max-w-[150px]">
                              {accountNames[eu.profile.userId] || eu.profile.userId}
                            </p>
                            {eu.profile.phone && (
                              <p className="text-xs text-default-400 truncate">
                                {eu.profile.phone}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm font-mono">
                          {eu.profile.urn || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <span className="text-sm">
                          {eu.profile.branch || "N/A"}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Chip
                          className="text-xs"
                          color={getRoleColor(eu.membership?.status || "none")}
                          size="sm"
                          variant="primary"
                        >
                          {getRoleLabel(eu.membership?.status || "none")}
                        </Chip>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {eu.departments.length === 0 ? (
                            <span className="text-xs text-default-400">
                              None
                            </span>
                          ) : (
                            eu.departments.slice(0, 2).map((ud) => (
                              <Chip
                                key={ud.$id}
                                className="text-xs"
                                color={getDepartmentRoleColor(ud.role)}
                                size="sm"
                                variant="soft"
                              >
                                {getDepartmentName(ud.departmentId)}
                              </Chip>
                            ))
                          )}
                          {eu.departments.length > 2 && (
                            <Chip className="text-xs" size="sm" variant="soft">
                              +{eu.departments.length - 2}
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={() => handleViewProfile(eu)}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={() => handleViewAudit(eu)}
                          >
                            <HistoryIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            isIconOnly
                            size="sm"
                            variant="ghost"
                            onPress={() => toggleRow(eu.profile.userId)}
                          >
                            {expandedRows.has(eu.profile.userId) ? (
                              <ChevronUpIcon className="w-4 h-4" />
                            ) : (
                              <ChevronDownIcon className="w-4 h-4" />
                            )}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
                </TableContent>
              </TableScrollContainer>
            </Table>
          </div>
        </CardContent>
      </Card>

      {selectedUser && (
        <Modal>
          <ModalBackdrop
            isOpen={isOpen}
            onOpenChange={(open: boolean) => {
              if (!open) {
                close();
                setIsEditing(false);
                setSelectedUser(null);
              }
            }}
          >
            <ModalContainer>
              <ModalDialog>
                <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      User Profile
                    </h2>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        close();
                        setIsEditing(false);
                        setSelectedUser(null);
                      }}
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-default-500 font-normal">
                    {accountNames[selectedUser.profile.userId] || selectedUser.profile.userId}
                  </p>
                </ModalHeader>

                <ModalBody className="py-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-default-100 dark:bg-default-50/10 rounded-xl">
                      {selectedUser.profile.avatar ? (
                        <img
                          alt={accountNames[selectedUser.profile.userId] || selectedUser.profile.userId}
                          className="w-16 h-16 rounded-full object-cover"
                          src={selectedUser.profile.avatar}
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-bold text-xl">
                          {(accountNames[selectedUser.profile.userId] || selectedUser.profile.userId)
                            ?.charAt(0)
                            ?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg">
                          {accountNames[selectedUser.profile.userId] || selectedUser.profile.userId}
                        </p>
                        <p className="text-sm text-default-500">
                          {selectedUser.profile.urn || "No URN"}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Chip
                            color={getRoleColor(
                              selectedUser.membership?.status || "none",
                            )}
                            size="sm"
                            variant="primary"
                          >
                            {getRoleLabel(
                              selectedUser.membership?.status || "none",
                            )}
                          </Chip>
                          {selectedUser.membership?.membershipNumber && (
                            <Chip size="sm" variant="soft">
                              {selectedUser.membership.membershipNumber}
                            </Chip>
                          )}
                        </div>
                      </div>
                    </div>

                    {isEditing && (
                      <div className="p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <PencilIcon className="w-4 h-4 text-primary" />
                          Edit correctable fields
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {(
                            [
                              ["phone", "Phone"],
                              ["urn", "URN"],
                              ["program", "Program"],
                              ["branch", "Branch"],
                              ["year", "Year"],
                              ["semester", "Semester"],
                              ["address", "Address"],
                            ] as Array<[keyof Profile, string]>
                          ).map(([field, label]) => (
                            <div key={field}>
                              <label className="text-xs text-default-500 mb-1 block">
                                {label}
                              </label>
                              <Input
                                value={String(editForm[field] ?? "")}
                                onChange={(e: any) =>
                                  setEditForm((prev) => ({
                                    ...prev,
                                    [field]: e.target.value,
                                  }))
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <div>
                          <label className="text-xs text-default-500 mb-1 block">
                            Bio
                          </label>
                          <Input
                            value={String(editForm.bio ?? "")}
                            onChange={(e: any) =>
                              setEditForm((prev) => ({
                                ...prev,
                                bio: e.target.value,
                              }))
                            }
                          />
                        </div>
                        <p className="text-xs text-default-500">
                          Saving sends the whole form; the server writes only
                          editable fields and rejects invalid values.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3 p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <MailIcon className="w-4 h-4 text-primary" />
                          Contact Information
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-default-500">Phone</span>
                            <span>{selectedUser.profile.phone || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Address</span>
                            <span className="text-right max-w-[180px] truncate">
                              {selectedUser.profile.address || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">
                              Date of Birth
                            </span>
                            <span>
                              {formatDate(selectedUser.profile.dateOfBirth)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Gender</span>
                            <span>{selectedUser.profile.gender || "N/A"}</span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <BriefcaseIcon className="w-4 h-4 text-primary" />
                          Academic Information
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-default-500">Program</span>
                            <span>{selectedUser.profile.program || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Branch</span>
                            <span>{selectedUser.profile.branch || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Year</span>
                            <span>{selectedUser.profile.year || "N/A"}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Semester</span>
                            <span>
                              {selectedUser.profile.semester || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {selectedUser.profile.bio && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2">Bio</h3>
                        <p className="text-sm text-default-600">
                          {selectedUser.profile.bio}
                        </p>
                      </div>
                    )}

                    {(selectedUser.profile.githubUrl ||
                      selectedUser.profile.linkedinUrl ||
                      selectedUser.profile.portfolioUrl ||
                      selectedUser.profile.instagramUrl) && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2">Links</h3>
                        <div className="space-y-1 text-sm">
                          {selectedUser.profile.githubUrl && (
                            <a
                              className="text-primary hover:underline block truncate"
                              href={selectedUser.profile.githubUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {selectedUser.profile.githubUrl}
                            </a>
                          )}
                          {selectedUser.profile.linkedinUrl && (
                            <a
                              className="text-primary hover:underline block truncate"
                              href={selectedUser.profile.linkedinUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {selectedUser.profile.linkedinUrl}
                            </a>
                          )}
                          {selectedUser.profile.portfolioUrl && (
                            <a
                              className="text-primary hover:underline block truncate"
                              href={selectedUser.profile.portfolioUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {selectedUser.profile.portfolioUrl}
                            </a>
                          )}
                          {selectedUser.profile.instagramUrl && (
                            <a
                              className="text-primary hover:underline block truncate"
                              href={selectedUser.profile.instagramUrl}
                              rel="noopener noreferrer"
                              target="_blank"
                            >
                              {selectedUser.profile.instagramUrl}
                            </a>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedUser.profile.skills &&
                      selectedUser.profile.skills.length > 0 && (
                        <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                          <h3 className="font-semibold text-sm mb-2">Skills</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedUser.profile.skills.map((skill, index) => (
                              <Chip key={index} size="sm" variant="soft">
                                {skill}
                              </Chip>
                            ))}
                          </div>
                        </div>
                      )}

                    {selectedUser.profile.interests &&
                      selectedUser.profile.interests.length > 0 && (
                        <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                          <h3 className="font-semibold text-sm mb-2">
                            Interests
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedUser.profile.interests.map(
                              (interest, index) => (
                                <Chip
                                  key={index}
                                  color="accent"
                                  size="sm"
                                  variant="soft"
                                >
                                  {interest}
                                </Chip>
                              ),
                            )}
                          </div>
                        </div>
                      )}

                    {selectedUser.departments.length > 0 && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <BriefcaseIcon className="w-4 h-4 text-primary" />
                          Departments
                        </h3>
                        <div className="space-y-2">
                          {selectedUser.departments.map((ud) => (
                            <div
                              key={ud.$id}
                              className="flex items-center justify-between p-2 bg-default-100 dark:bg-default-200/10 rounded-lg"
                            >
                              <span className="text-sm font-medium">
                                {getDepartmentName(ud.departmentId)}
                              </span>
                              <div className="flex items-center gap-2">
                                <Chip
                                  color={getDepartmentRoleColor(ud.role)}
                                  size="sm"
                                  variant="soft"
                                >
                                  {getDepartmentRoleLabel(ud.role)}
                                </Chip>
                                <span className="text-xs text-default-400">
                                  {formatDate(ud.assignedAt)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <AwardIcon className="w-4 h-4 text-primary" />
                          Designations
                        </h3>
                        <div className="space-y-2">
                          {selectedUser.designations.length === 0 && (
                            <p className="text-xs text-default-400">No designations held.</p>
                          )}
                          {selectedUser.designations.map((ud) => (
                            <div
                              key={ud.$id}
                              className="flex items-center justify-between p-2 bg-default-100 dark:bg-default-200/10 rounded-lg"
                            >
                              <span className="text-sm font-medium">
                                {getDesignationName(ud.designationId)}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-default-400">
                                  {formatDate(ud.assignedAt)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isPending={grantBusy === `desig-${ud.designationId}`}
                                  onPress={() => handleRevokeDesignation(ud.designationId, getDesignationName(ud.designationId))}
                                >
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Select
                            fullWidth
                            aria-label="Designation to grant"
                            value={grantDesigId === "" ? null : grantDesigId}
                            onChange={(value) => setGrantDesigId(String(value ?? ""))}
                          >
                            <Label>Grant designation</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {allDesignations.map((desig) => (
                                  <ListBox.Item key={desig.$id} id={desig.$id!} textValue={desig.name}>
                                    {desig.name}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <Button
                            size="sm"
                            variant="primary"
                            isPending={grantBusy === "desig-grant"}
                            isDisabled={!grantDesigId}
                            onPress={handleGrantDesignation}
                          >
                            Grant
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedUser && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <ZapIcon className="w-4 h-4 text-primary" />
                          Powers
                        </h3>
                        <div className="space-y-2">
                          {selectedUser.powers.length === 0 && (
                            <p className="text-xs text-default-400">No powers granted.</p>
                          )}
                          {selectedUser.powers.map((up) => (
                            <div
                              key={up.$id}
                              className="flex items-center justify-between p-2 bg-default-100 dark:bg-default-200/10 rounded-lg"
                            >
                              <span className="text-sm font-medium">
                                {getPowerName(up.powerId)}
                              </span>
                              <div className="flex items-center gap-2">
                                {up.expiresAt && (
                                  <span className="text-xs text-default-400">
                                    Expires: {formatDate(up.expiresAt)}
                                  </span>
                                )}
                                <span className="text-xs text-default-400">
                                  {formatDate(up.grantedAt)}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isPending={grantBusy === `power-${up.powerId}`}
                                  onPress={() => handleRevokePower(up.powerId, getPowerName(up.powerId))}
                                >
                                  Revoke
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        <div className="flex gap-2 mt-3">
                          <Select
                            fullWidth
                            aria-label="Power to grant"
                            value={grantPowerId === "" ? null : grantPowerId}
                            onChange={(value) => setGrantPowerId(String(value ?? ""))}
                          >
                            <Label>Grant power</Label>
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {allPowers.map((power) => (
                                  <ListBox.Item key={power.$id} id={power.$id!} textValue={power.displayName || power.name}>
                                    {power.displayName || power.name}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                          <Button
                            size="sm"
                            variant="primary"
                            isPending={grantBusy === "power-grant"}
                            isDisabled={!grantPowerId}
                            onPress={handleGrantPower}
                          >
                            Grant
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedUser.membership && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <ShieldCheckIcon className="w-4 h-4 text-primary" />
                          Membership Details
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-default-500">
                              Membership Number
                            </span>
                            <span className="font-mono">
                              {selectedUser.membership.membershipNumber}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Status</span>
                            <Chip
                              color={getRoleColor(
                                selectedUser.membership.status,
                              )}
                              size="sm"
                              variant="primary"
                            >
                              {selectedUser.membership.status}
                            </Chip>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Joined At</span>
                            <span>
                              {formatDate(selectedUser.membership.joinedAt)}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">
                              Approved By
                            </span>
                            <span className="truncate max-w-[150px]">
                              {selectedUser.membership.approvedBy}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <CalendarIcon className="w-4 h-4 text-primary" />
                        Preferences
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">Pronouns</span>
                          <span>{selectedUser.profile.pronouns || "N/A"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Availability</span>
                          <span>
                            {selectedUser.profile.availability || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">
                            Profile Visibility
                          </span>
                          <span>
                            {selectedUser.profile.profileVisibility || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">
                            Show on About Page
                          </span>
                          <span>
                            {selectedUser.profile.showOnAboutPage
                              ? "Yes"
                              : "No"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {selectedUser.profile.experience && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2">
                          Experience
                        </h3>
                        <p className="text-sm text-default-600">
                          {selectedUser.profile.experience}
                        </p>
                      </div>
                    )}

                    {selectedUser.profile.whyJoin && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2">Why Join</h3>
                        <p className="text-sm text-default-600">
                          {selectedUser.profile.whyJoin}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-primary" />
                        Record Info
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">Profile ID</span>
                          <span className="font-mono text-xs">
                            {selectedUser.profile.$id}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Created</span>
                          <span>
                            {formatDateTime(selectedUser.profile.$createdAt)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Last Updated</span>
                          <span>
                            {formatDateTime(selectedUser.profile.$updatedAt)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ModalBody>

                <ModalFooter className="border-t pt-4 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      close();
                      setIsEditing(false);
                      setSelectedUser(null);
                    }}
                  >
                    Close
                  </Button>
                  {isEditing ? (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
                        isPending={saving}
                        size="sm"
                        onPress={handleSaveProfile}
                      >
                        Save Changes
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={handleEditProfile}
                      >
                        <PencilIcon className="w-4 h-4 mr-1" />
                        Edit Profile
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onPress={() => {
                          close();
                          setIsEditing(false);
                          setSelectedUser(null);
                          handleViewAudit(selectedUser);
                        }}
                      >
                        <HistoryIcon className="w-4 h-4 mr-1" />
                        Audit Trail
                      </Button>
                      {selectedUser.membership?.status === "active" && (
                        <>
                          <Button
                            isPending={
                              actionLoading ===
                              selectedUser.profile.userId + "-inactive"
                            }
                            size="sm"
                            variant="tertiary"
                            onPress={() => handleDeactivateUser(selectedUser)}
                          >
                            <UserMinusIcon className="w-4 h-4 mr-1" />
                            Deactivate
                          </Button>
                          <Button
                            isPending={
                              actionLoading ===
                              selectedUser.profile.userId + "-banned"
                            }
                            size="sm"
                            variant="danger-soft"
                            onPress={() => handleBanUser(selectedUser)}
                          >
                            <ShieldOffIcon className="w-4 h-4 mr-1" />
                            Ban
                          </Button>
                        </>
                      )}
                      {(selectedUser.membership?.status === "inactive" ||
                        selectedUser.membership?.status === "banned" ||
                        !selectedUser.membership) && (
                        <Button
                          isPending={
                            actionLoading ===
                            selectedUser.profile.userId + "-active"
                          }
                          size="sm"
                          variant="primary"
                          onPress={() => handleReactivateUser(selectedUser)}
                        >
                          <UserCheckIcon className="w-4 h-4 mr-1" />
                          Reactivate
                        </Button>
                      )}
                    </>
                  )}
                </ModalFooter>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      )}

      {auditUser && (
        <Modal>
          <ModalBackdrop
            isOpen={isAuditOpen}
            onOpenChange={(open: boolean) => {
              if (!open) {
                closeAudit();
                setAuditUser(null);
                setAuditLogs([]);
              }
            }}
          >
            <ModalContainer>
              <ModalDialog>
                <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl md:text-2xl font-bold tracking-tight text-foreground">
                      Audit Trail
                    </h2>
                    <Button
                      isIconOnly
                      size="sm"
                      variant="ghost"
                      onPress={() => {
                        closeAudit();
                        setAuditUser(null);
                        setAuditLogs([]);
                      }}
                    >
                      <XIcon className="w-4 h-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-default-500 font-normal">
                    Activity log for {auditUser.profile.userId}
                  </p>
                </ModalHeader>

                <ModalBody className="py-6 max-h-[70vh] overflow-y-auto">
                  {loadingAudit ? (
                    <div className="flex items-center justify-center py-12">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                    </div>
                  ) : auditLogs.length === 0 ? (
                    <div className="text-center py-12">
                      <HistoryIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                      <p className="text-default-500">
                        No audit logs found for this user
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {auditLogs.map((log) => (
                        <div
                          key={log.$id}
                          className="p-3 bg-default-50 dark:bg-default-100/5 rounded-xl"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <Chip
                                  className="text-xs"
                                  color={
                                    log.action.includes("ban")
                                      ? "danger"
                                      : log.action.includes("deactivate")
                                        ? "warning"
                                        : log.action.includes("promote") ||
                                            log.action.includes("reactivate")
                                          ? "success"
                                          : "default"
                                  }
                                  size="sm"
                                  variant="soft"
                                >
                                  {log.action.replace(/_/g, " ")}
                                </Chip>
                                <span className="text-xs text-default-400">
                                  {log.entityType}
                                </span>
                              </div>
                              <p className="text-sm text-default-600">
                                Actor: {log.actorName} ({log.actorRole})
                              </p>
                              {log.details && (
                                <p className="text-xs text-default-400 mt-1 font-mono">
                                  {typeof log.details === "string"
                                    ? log.details
                                    : JSON.stringify(log.details)}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-default-400 whitespace-nowrap">
                              {formatDateTime(log.timestamp)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ModalBody>

                <ModalFooter className="border-t pt-4">
                  <Button
                    size="sm"
                    variant="ghost"
                    onPress={() => {
                      closeAudit();
                      setAuditUser(null);
                      setAuditLogs([]);
                    }}
                  >
                    Close
                  </Button>
                </ModalFooter>
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      )}
    </div>
  );
}
