"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errorHandler";
import { toast } from "sonner";
import type { Application, Membership, Profile, Department } from "@/lib/types";
import {
  CheckCircleIcon,
  UsersIcon,
  Building2Icon,
  CalendarIcon,
  SearchIcon,
  ArrowLeftIcon,
  HashIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Input,
} from "@heroui/react";

interface ApprovedMember {
  application: Application;
  membership: Membership | undefined;
  profile: Profile | null;
}

export default function AdminMembershipApprovedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<ApprovedMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/membership?status=approved", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        applications?: Application[];
        profiles?: Profile[];
        memberships?: Membership[];
        departments?: Department[];
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to load approved members");

      const approvedApps = payload?.applications ?? [];
      setDepartments(payload?.departments ?? []);

      const membershipMap: Record<string, Membership> = {};
      for (const membership of payload?.memberships ?? []) membershipMap[membership.applicationId] = membership;

      const profileMap: Record<string, Profile> = {};
      for (const profile of payload?.profiles ?? []) profileMap[profile.userId] = profile;

      setMembers(approvedApps.map((application) => ({
        application,
        membership: membershipMap[application.$id ?? ""],
        profile: profileMap[application.userId] ?? null,
      })));
    } catch (error) {
      console.error("Error loading approved members:", error);
      toast.error(getErrorMessage(error) || "Failed to load approved members");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.push("/login");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const getDepartmentNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return ids
      .map((id) => departments.find((d) => d.$id === id)?.name)
      .filter(Boolean) as string[];
  };

  const filteredMembers = members.filter((m) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const profile = m.profile;
    return (
      profile?.urn?.toLowerCase().includes(q) ||
      profile?.branch?.toLowerCase().includes(q) ||
      m.membership?.membershipNumber?.toLowerCase().includes(q) ||
      m.application.userId.toLowerCase().includes(q)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Loading approved members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              onPress={() => router.push("/admin/membership")}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Approved Members
            </h1>
          </div>
          <p className="text-default-500 text-sm md:text-base ml-11">
            {members.length} member{members.length !== 1 ? "s" : ""} approved
          </p>
        </div>
        <div className="w-full md:w-72 ml-11 md:ml-0">
          <Input
            placeholder="Search by name, branch, or membership #..."
            value={searchQuery}
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Members</p>
                <p className="text-2xl font-bold">{members.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">With Departments</p>
                <p className="text-2xl font-bold">
                  {members.filter((m) => m.membership?.department).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2Icon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Active</p>
                <p className="text-2xl font-bold">
                  {members.filter((m) => m.membership?.status === "active").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <CheckCircleIcon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Members Table */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="Approved members table" className="min-w-full">
              <TableHeader>
                <TableColumn>MEMBER</TableColumn>
                <TableColumn className="hidden md:table-cell">MEMBERSHIP #</TableColumn>
                <TableColumn className="hidden lg:table-cell">DEPARTMENT</TableColumn>
                <TableColumn className="hidden sm:table-cell">APPROVED</TableColumn>
                <TableColumn>STATUS</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredMembers.length === 0 ? (
                  <TableRow key="empty">
                    <TableCell>
                      <div className="text-center py-12">
                        <CheckCircleIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                        <p className="text-default-500 text-lg font-medium">
                          {searchQuery ? "No matching members" : "No approved members yet"}
                        </p>
                        <p className="text-default-400 text-sm mt-1">
                          {searchQuery
                            ? "Try a different search term"
                            : "Approved members will appear here"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMembers.map((member) => {
                    if (!member.membership) {
                      return (
                        <TableRow key={member.application.$id}>
                          <TableCell>
                            <span className="text-sm text-default-400">
                              Membership missing for application {member.application.$id}
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    }
                    const membership = member.membership;
                    const deptName = membership.department
                      ? departments.find((d) => d.$id === membership.department)?.name
                      : null;
                    const preferredDepts = getDepartmentNames(
                      member.application.preferredDepartments
                    );

                    return (
                      <TableRow key={member.application.$id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={
                                member.profile?.avatar ||
                                `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                  member.profile?.urn || member.application.userId
                                )}&background=16a34a&color=fff`
                              }
                              alt={member.profile?.urn || "Member"}
                              className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                            />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">
                                {member.profile?.urn || member.application.userId.slice(0, 12)}
                              </p>
                              <p className="text-xs text-default-400 truncate">
                                {member.profile?.branch || member.profile?.program || "N/A"}
                              </p>
                              {/* Mobile-only membership # */}
                              <p className="text-xs text-default-400 md:hidden flex items-center gap-1">
                                <HashIcon className="w-3 h-3" />
                                {membership.membershipNumber || "N/A"}
                              </p>
                            </div>
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1">
                            <HashIcon className="w-3 h-3 text-default-400" />
                            <span className="text-sm font-mono">
                              {membership.membershipNumber || "N/A"}
                            </span>
                          </div>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {deptName ? (
                              <Chip size="sm" variant="soft" color="success">
                                {deptName}
                              </Chip>
                            ) : preferredDepts.length > 0 ? (
                              preferredDepts.map((name) => (
                                <Chip key={name} size="sm" variant="soft" color="accent">
                                  {name}
                                </Chip>
                              ))
                            ) : (
                              <span className="text-xs text-default-400">Unassigned</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-1 text-sm text-default-500">
                            <CalendarIcon className="w-3 h-3" />
                            {membership.approvedAt
                              ? new Date(membership.approvedAt).toLocaleDateString()
                              : member.application.reviewedAt
                                ? new Date(member.application.reviewedAt).toLocaleDateString()
                                : "N/A"}
                          </div>
                        </TableCell>

                        <TableCell>
                          <Chip
                            color={
                              membership.status === "active"
                                ? "success"
                                : membership.status === "banned"
                                  ? "danger"
                                  : "default"
                            }
                            variant="soft"
                            size="sm"
                          >
                            {membership.status}
                          </Chip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
