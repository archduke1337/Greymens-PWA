"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { applicationService } from "@/lib/applications";
import { profileService } from "@/lib/profiles";
import { departmentService } from "@/lib/departments";
import { getErrorMessage } from "@/lib/errorHandler";
import { toast } from "sonner";
import type { Application, Profile, Department } from "@/lib/types";
import {
  XCircleIcon,
  UsersIcon,
  SearchIcon,
  ArrowLeftIcon,
  CalendarIcon,
  AlertTriangleIcon,
  MessageSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
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

interface RejectedApp {
  application: Application;
  profile: Profile | null;
}

export default function AdminMembershipRejectedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<RejectedApp[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [rejectedApps, deptData] = await Promise.all([
        applicationService.getAll([Query.equal("status", "rejected")]),
        departmentService.getAll(),
      ]);

      setDepartments(deptData);

      const appData: RejectedApp[] = rejectedApps.map((app) => ({
        application: app,
        profile: null,
      }));

      const userIds = [...new Set(rejectedApps.map((a) => a.userId))];
      const profilePromises = userIds.map((id) => profileService.getByUserId(id));
      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, Profile> = {};
      profileResults.forEach((p) => {
        if (p) profileMap[p.userId] = p;
      });

      appData.forEach((a) => {
        a.profile = profileMap[a.application.userId] || null;
      });

      setApplications(appData);
    } catch (error) {
      console.error("Error loading rejected applications:", error);
      toast.error("Failed to load rejected applications");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const getDepartmentNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return ids
      .map((id) => departments.find((d) => d.$id === id)?.name)
      .filter(Boolean) as string[];
  };

  const filteredApps = applications.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      a.profile?.urn?.toLowerCase().includes(q) ||
      a.profile?.branch?.toLowerCase().includes(q) ||
      a.application.userId.toLowerCase().includes(q) ||
      a.application.rejectionReason?.toLowerCase().includes(q)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Loading rejected applications...</p>
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
            <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">
              Rejected Applications
            </h1>
          </div>
          <p className="text-default-500 text-sm md:text-base ml-11">
            {applications.length} application{applications.length !== 1 ? "s" : ""} rejected
          </p>
        </div>
        <div className="w-full md:w-72 ml-11 md:ml-0">
          <Input
            placeholder="Search by name, branch, or reason..."
            value={searchQuery}
            onValueChange={setSearchQuery}
            startContent={<SearchIcon className="w-4 h-4 text-default-400" />}
            isClearable
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Rejected</p>
                <p className="text-2xl font-bold text-red-600">{applications.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">With Reason Provided</p>
                <p className="text-2xl font-bold">
                  {applications.filter((a) => a.application.rejectionReason).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <MessageSquareIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejected Applications Table */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="Rejected applications table" className="min-w-full">
              <TableHeader>
                <TableColumn>APPLICANT</TableColumn>
                <TableColumn className="hidden md:table-cell">REJECTED ON</TableColumn>
                <TableColumn className="hidden lg:table-cell">DEPARTMENTS APPLIED</TableColumn>
                <TableColumn>REASON</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredApps.length === 0 ? (
                  <TableRow key="empty">
                    <TableCell>
                      <div className="text-center py-12">
                        <XCircleIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                        <p className="text-default-500 text-lg font-medium">
                          {searchQuery ? "No matching applications" : "No rejected applications"}
                        </p>
                        <p className="text-default-400 text-sm mt-1">
                          {searchQuery
                            ? "Try a different search term"
                            : "Rejected applications will appear here"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredApps.map((item) => {
                    const deptNames = getDepartmentNames(
                      item.application.preferredDepartments
                    );
                    const isExpanded = expandedId === item.application.$id;

                    return (
                      <TableRow key={item.application.$id}>
                        <TableCell>
                          <div className="space-y-2">
                            <div className="flex items-center gap-3">
                              <img
                                src={
                                  item.profile?.avatar ||
                                  `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                    item.profile?.urn || item.application.userId
                                  )}&background=dc2626&color=fff`
                                }
                                alt={item.profile?.urn || "Applicant"}
                                className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                              />
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {item.profile?.urn || item.application.userId.slice(0, 12)}
                                </p>
                                <p className="text-xs text-default-400 truncate">
                                  {item.profile?.branch || item.profile?.program || "N/A"}
                                </p>
                              </div>
                            </div>

                            {/* Mobile-only expandable */}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="p-0 h-auto text-xs text-default-400 lg:hidden"
                              onPress={() =>
                                setExpandedId(isExpanded ? null : item.application.$id!)
                              }
                            >
                              {isExpanded ? "Less" : "More"} details
                              {isExpanded ? (
                                <ChevronUpIcon className="w-3 h-3 ml-1" />
                              ) : (
                                <ChevronDownIcon className="w-3 h-3 ml-1" />
                              )}
                            </Button>

                            {isExpanded && (
                              <div className="lg:hidden p-3 bg-default-50 dark:bg-default-100/10 rounded-lg text-xs space-y-2">
                                <p className="flex items-center gap-1">
                                  <CalendarIcon className="w-3 h-3" />
                                  Rejected:{" "}
                                  {item.application.reviewedAt
                                    ? new Date(item.application.reviewedAt).toLocaleDateString()
                                    : "N/A"}
                                </p>
                                {deptNames.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {deptNames.map((name) => (
                                      <Chip key={name} size="sm" variant="soft" color="accent">
                                        {name}
                                      </Chip>
                                    ))}
                                  </div>
                                )}
                                {item.application.rejectionReason && (
                                  <p className="text-red-600 dark:text-red-400">
                                    {item.application.rejectionReason}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="hidden md:table-cell">
                          <div className="flex items-center gap-1 text-sm text-default-500">
                            <CalendarIcon className="w-3 h-3" />
                            {item.application.reviewedAt
                              ? new Date(item.application.reviewedAt).toLocaleDateString()
                              : "N/A"}
                          </div>
                        </TableCell>

                        <TableCell className="hidden lg:table-cell">
                          <div className="flex flex-wrap gap-1">
                            {deptNames.length > 0 ? (
                              deptNames.map((name) => (
                                <Chip key={name} size="sm" variant="soft" color="accent">
                                  {name}
                                </Chip>
                              ))
                            ) : (
                              <span className="text-xs text-default-400">None specified</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell>
                          {item.application.rejectionReason ? (
                            <div className="max-w-xs">
                              <p className="text-sm text-red-600 dark:text-red-400 line-clamp-2">
                                {item.application.rejectionReason}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-default-400">
                              <AlertTriangleIcon className="w-3 h-3" />
                              No reason provided
                            </div>
                          )}
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
