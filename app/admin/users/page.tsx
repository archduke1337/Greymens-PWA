// app/admin/users/page.tsx
"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { profileService } from "@/lib/profiles";
import { membershipService } from "@/lib/memberships";
import { departmentService } from "@/lib/departments";
import { designationService } from "@/lib/designations";
import { powerService } from "@/lib/powers";
import { auditService } from "@/lib/audit";
import { getErrorMessage } from "@/lib/errorHandler";
import { toast } from "sonner";
import {
  SearchIcon,
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
  PhoneIcon,
  MapPinIcon,
  CalendarIcon,
  BriefcaseIcon,
  AwardIcon,
  ZapIcon,
  XIcon,
  FilterIcon,
  EyeIcon,
  HistoryIcon,
  CheckCircleIcon,
  XCircleIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  useOverlayState,
} from "@heroui/react";
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
  MembershipStatus,
} from "@/lib/types";

type StatusFilter = "all" | MembershipStatus;

interface EnrichedUser {
  profile: Profile;
  membership: Membership | null;
  departments: UserDepartment[];
  designations: UserDesignation[];
  powers: UserPower[];
  applicationStatus: string;
  membershipStatus: string;
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

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadAllData();
  }, [user, authLoading, router]);

  const loadAllData = async () => {
    try {
      setLoadingUsers(true);
      const [profiles, departments, designations, powers] = await Promise.all([
        profileService.getAll(),
        departmentService.getAll(),
        designationService.getAll(),
        powerService.getAll(),
      ]);

      setAllDepartments(departments);
      setAllDesignations(designations);
      setAllPowers(powers);

      const enriched: EnrichedUser[] = await Promise.all(
        profiles.map(async (profile) => {
          const [membership, userDepts, userDesigs, userPowers] =
            await Promise.all([
              membershipService.getByUserId(profile.userId),
              departmentService.getUserDepartments(profile.userId),
              designationService.getUserDesignations(profile.userId),
              powerService.getUserPowers(profile.userId),
            ]);

          return {
            profile,
            membership,
            departments: userDepts,
            designations: userDesigs,
            powers: userPowers,
            applicationStatus: membership ? membership.status : "none",
            membershipStatus: membership ? membership.status : "none",
          };
        })
      );

      setEnrichedUsers(enriched);
    } catch (error) {
      console.error("Error loading users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoadingUsers(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return enrichedUsers.filter((eu) => {
      const matchesSearch =
        !q ||
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
        (statusFilter === "member" &&
          eu.membership?.status === "active") ||
        (statusFilter === "inactive" &&
          eu.membership?.status === "inactive") ||
        (statusFilter === "banned" &&
          eu.membership?.status === "banned");

      return matchesSearch && matchesStatus;
    });
  }, [enrichedUsers, searchQuery, statusFilter]);

  const stats = useMemo(() => {
    const total = enrichedUsers.length;
    const active = enrichedUsers.filter(
      (eu) => eu.membership?.status === "active"
    ).length;
    const inactive = enrichedUsers.filter(
      (eu) => eu.membership?.status === "inactive"
    ).length;
    const banned = enrichedUsers.filter(
      (eu) => eu.membership?.status === "banned"
    ).length;
    return { total, active, inactive, banned };
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
    open();
  };

  const handleEditProfile = () => {
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!selectedUser) return;
    setSaving(true);
    try {
      await profileService.update(selectedUser.profile.userId, editForm);
      toast.success("Profile updated successfully");
      setIsEditing(false);
      await loadAllData();
      const updatedProfile = await profileService.getByUserId(
        selectedUser.profile.userId
      );
      if (updatedProfile) {
        setSelectedUser((prev) =>
          prev ? { ...prev, profile: updatedProfile } : prev
        );
        setEditForm({ ...updatedProfile });
      }
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

  const handleBanUser = async (eu: EnrichedUser) => {
    if (
      !confirm(
        `Are you sure you want to ban ${eu.profile.userId}? This action can be reversed later.`
      )
    )
      return;
    setActionLoading(eu.profile.userId + "-ban");
    try {
      await membershipService.ban(eu.profile.userId);
      await auditService.log({
        actorId: user?.$id || "",
        actorName: user?.name || "Admin",
        actorRole: "admin",
        action: "ban_user",
        entityType: "membership",
        entityId: eu.profile.userId,
        details: { targetUserId: eu.profile.userId },
      });
      toast.success("User banned successfully");
      await loadAllData();
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message || "Failed to ban user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeactivateUser = async (eu: EnrichedUser) => {
    if (
      !confirm(
        `Are you sure you want to deactivate ${eu.profile.userId}?`
      )
    )
      return;
    setActionLoading(eu.profile.userId + "-deactivate");
    try {
      await membershipService.deactivate(eu.profile.userId);
      await auditService.log({
        actorId: user?.$id || "",
        actorName: user?.name || "Admin",
        actorRole: "admin",
        action: "deactivate_user",
        entityType: "membership",
        entityId: eu.profile.userId,
        details: { targetUserId: eu.profile.userId },
      });
      toast.success("User deactivated successfully");
      await loadAllData();
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message || "Failed to deactivate user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleReactivateUser = async (eu: EnrichedUser) => {
    if (
      !confirm(
        `Are you sure you want to reactivate ${eu.profile.userId}?`
      )
    )
      return;
    setActionLoading(eu.profile.userId + "-reactivate");
    try {
      await membershipService.update(eu.profile.userId, {
        status: "active",
      });
      await auditService.log({
        actorId: user?.$id || "",
        actorName: user?.name || "Admin",
        actorRole: "admin",
        action: "reactivate_user",
        entityType: "membership",
        entityId: eu.profile.userId,
        details: { targetUserId: eu.profile.userId },
      });
      toast.success("User reactivated successfully");
      await loadAllData();
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message || "Failed to reactivate user");
    } finally {
      setActionLoading(null);
    }
  };

  const handlePromoteRole = async (
    eu: EnrichedUser,
    newStatus: MembershipStatus
  ) => {
    if (
      !confirm(
        `Are you sure you want to promote ${eu.profile.userId} to ${newStatus}?`
      )
    )
      return;
    setActionLoading(eu.profile.userId + "-promote");
    try {
      await membershipService.update(eu.profile.userId, {
        status: "active",
      });
      await auditService.log({
        actorId: user?.$id || "",
        actorName: user?.name || "Admin",
        actorRole: "admin",
        action: "promote_user",
        entityType: "membership",
        entityId: eu.profile.userId,
        details: {
          targetUserId: eu.profile.userId,
          newStatus,
        },
      });
      toast.success(`User promoted to ${newStatus}`);
      await loadAllData();
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message || "Failed to promote user");
    } finally {
      setActionLoading(null);
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
    status: string
  ): "success" | "warning" | "danger" | "default" | "primary" => {
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

  const getDepartmentRoleColor = (
    role: string
  ): "primary" | "secondary" | "default" => {
    switch (role) {
      case "lead":
        return "primary";
      case "core_member":
        return "secondary";
      default:
        return "default";
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatDateTime = (dateStr?: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-purple-600" />
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
      </div>

      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search by name, URN, phone, branch, skills..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
                startContent={<SearchIcon className="w-4 h-4 text-default-400" />}
                isClearable
                onClear={() => setSearchQuery("")}
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  "all",
                  "member",
                  "inactive",
                  "banned",
                  "no_account",
                ] as StatusFilter[]
              ).map((status) => (
                <Button
                  key={status}
                  size="sm"
                  variant={statusFilter === status ? "primary" : "ghost"}
                  onPress={() => setStatusFilter(status)}
                >
                  {status === "all"
                    ? "All"
                    : status === "member"
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
            <Table aria-label="Users table" className="min-w-full">
              <TableHeader>
                <TableColumn>USER</TableColumn>
                <TableColumn className="hidden md:table-cell">URN</TableColumn>
                <TableColumn className="hidden lg:table-cell">BRANCH</TableColumn>
                <TableColumn>STATUS</TableColumn>
                <TableColumn className="hidden lg:table-cell">DEPARTMENTS</TableColumn>
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
                              src={eu.profile.avatar}
                              alt={eu.profile.userId}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                              {eu.profile.userId?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-semibold text-sm truncate max-w-[150px]">
                              {eu.profile.userId}
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
                          color={getRoleColor(
                            eu.membership?.status || "none"
                          )}
                          variant="primary"
                          size="sm"
                          className="text-xs"
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
                                color={getDepartmentRoleColor(ud.role)}
                                variant="flat"
                                size="sm"
                                className="text-xs"
                              >
                                {getDepartmentName(ud.departmentId)}
                              </Chip>
                            ))
                          )}
                          {eu.departments.length > 2 && (
                            <Chip
                              variant="flat"
                              size="sm"
                              className="text-xs"
                            >
                              +{eu.departments.length - 2}
                            </Chip>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            onPress={() => handleViewProfile(eu)}
                          >
                            <EyeIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            onPress={() => handleViewAudit(eu)}
                          >
                            <HistoryIcon className="w-4 h-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
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
                    <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      User Profile
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
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
                    {selectedUser.profile.userId}
                  </p>
                </ModalHeader>

                <ModalBody className="py-6 max-h-[70vh] overflow-y-auto">
                  <div className="space-y-6">
                    <div className="flex items-center gap-4 p-4 bg-default-100 dark:bg-default-50/10 rounded-xl">
                      {selectedUser.profile.avatar ? (
                        <img
                          src={selectedUser.profile.avatar}
                          alt={selectedUser.profile.userId}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xl">
                          {selectedUser.profile.userId?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="font-bold text-lg">
                          {selectedUser.profile.userId}
                        </p>
                        <p className="text-sm text-default-500">
                          {selectedUser.profile.urn || "No URN"}
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Chip
                            color={getRoleColor(
                              selectedUser.membership?.status || "none"
                            )}
                            variant="primary"
                            size="sm"
                          >
                            {getRoleLabel(
                              selectedUser.membership?.status || "none"
                            )}
                          </Chip>
                          {selectedUser.membership?.membershipNumber && (
                            <Chip variant="flat" size="sm">
                              {selectedUser.membership.membershipNumber}
                            </Chip>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-3 p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <MailIcon className="w-4 h-4 text-purple-600" />
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
                            <span>
                              {selectedUser.profile.gender || "N/A"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-3 p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm flex items-center gap-2">
                          <BriefcaseIcon className="w-4 h-4 text-purple-600" />
                          Academic Information
                        </h3>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-default-500">Program</span>
                            <span>
                              {selectedUser.profile.program || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Branch</span>
                            <span>
                              {selectedUser.profile.branch || "N/A"}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">Year</span>
                            <span>
                              {selectedUser.profile.year || "N/A"}
                            </span>
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
                      selectedUser.profile.portfolioUrl) && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2">Links</h3>
                        <div className="space-y-1 text-sm">
                          {selectedUser.profile.githubUrl && (
                            <a
                              href={selectedUser.profile.githubUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:underline block truncate"
                            >
                              {selectedUser.profile.githubUrl}
                            </a>
                          )}
                          {selectedUser.profile.linkedinUrl && (
                            <a
                              href={selectedUser.profile.linkedinUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:underline block truncate"
                            >
                              {selectedUser.profile.linkedinUrl}
                            </a>
                          )}
                          {selectedUser.profile.portfolioUrl && (
                            <a
                              href={selectedUser.profile.portfolioUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-purple-600 hover:underline block truncate"
                            >
                              {selectedUser.profile.portfolioUrl}
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
                            {selectedUser.profile.skills.map(
                              (skill, index) => (
                                <Chip
                                  key={index}
                                  variant="flat"
                                  size="sm"
                                >
                                  {skill}
                                </Chip>
                              )
                            )}
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
                                  variant="flat"
                                  size="sm"
                                  color="primary"
                                >
                                  {interest}
                                </Chip>
                              )
                            )}
                          </div>
                        </div>
                      )}

                    {selectedUser.departments.length > 0 && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <BriefcaseIcon className="w-4 h-4 text-purple-600" />
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
                                  variant="flat"
                                  size="sm"
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

                    {selectedUser.designations.length > 0 && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <AwardIcon className="w-4 h-4 text-purple-600" />
                          Designations
                        </h3>
                        <div className="space-y-2">
                          {selectedUser.designations.map((ud) => (
                            <div
                              key={ud.$id}
                              className="flex items-center justify-between p-2 bg-default-100 dark:bg-default-200/10 rounded-lg"
                            >
                              <span className="text-sm font-medium">
                                {getDesignationName(ud.designationId)}
                              </span>
                              <span className="text-xs text-default-400">
                                {formatDate(ud.assignedAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.powers.length > 0 && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <ZapIcon className="w-4 h-4 text-purple-600" />
                          Powers
                        </h3>
                        <div className="space-y-2">
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
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedUser.membership && (
                      <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                        <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                          <ShieldCheckIcon className="w-4 h-4 text-purple-600" />
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
                                selectedUser.membership.status
                              )}
                              variant="primary"
                              size="sm"
                            >
                              {selectedUser.membership.status}
                            </Chip>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-default-500">
                              Joined At
                            </span>
                            <span>
                              {formatDate(
                                selectedUser.membership.joinedAt
                              )}
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
                        <CalendarIcon className="w-4 h-4 text-purple-600" />
                        Preferences
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">Pronouns</span>
                          <span>
                            {selectedUser.profile.pronouns || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">
                            Availability
                          </span>
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
                        <h3 className="font-semibold text-sm mb-2">
                          Why Join
                        </h3>
                        <p className="text-sm text-default-600">
                          {selectedUser.profile.whyJoin}
                        </p>
                      </div>
                    )}

                    <div className="p-4 bg-default-50 dark:bg-default-100/5 rounded-xl">
                      <h3 className="font-semibold text-sm mb-2 flex items-center gap-2">
                        <ClockIcon className="w-4 h-4 text-purple-600" />
                        Record Info
                      </h3>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-default-500">
                            Profile ID
                          </span>
                          <span className="font-mono text-xs">
                            {selectedUser.profile.$id}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">Created</span>
                          <span>
                            {formatDateTime(
                              selectedUser.profile.$createdAt
                            )}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-default-500">
                            Last Updated
                          </span>
                          <span>
                            {formatDateTime(
                              selectedUser.profile.$updatedAt
                            )}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </ModalBody>

                <ModalFooter className="border-t pt-4 flex flex-wrap gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
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
                        variant="ghost"
                        size="sm"
                        onPress={() => setIsEditing(false)}
                      >
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        isPending={saving}
                        onPress={handleSaveProfile}
                        className="bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold"
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
                            size="sm"
                            variant="ghost"
                            color="warning"
                            isPending={
                              actionLoading ===
                              selectedUser.profile.userId + "-deactivate"
                            }
                            onPress={() =>
                              handleDeactivateUser(selectedUser)
                            }
                          >
                            <UserMinusIcon className="w-4 h-4 mr-1" />
                            Deactivate
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            color="danger"
                            isPending={
                              actionLoading ===
                              selectedUser.profile.userId + "-ban"
                            }
                            onPress={() =>
                              handleBanUser(selectedUser)
                            }
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
                          size="sm"
                          variant="ghost"
                          color="success"
                          isPending={
                            actionLoading ===
                            selectedUser.profile.userId + "-reactivate"
                          }
                          onPress={() =>
                            handleReactivateUser(selectedUser)
                          }
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
                    <h2 className="text-xl md:text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                      Audit Trail
                    </h2>
                    <Button
                      size="sm"
                      variant="ghost"
                      isIconOnly
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
                                  variant="flat"
                                  size="sm"
                                  className="text-xs"
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
                    variant="ghost"
                    size="sm"
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
