"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import {getErrorMessage, readApiError} from "@/lib/errorHandler";
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
  Avatar,
  AvatarImage,
  AvatarFallback,
  Spinner,
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
  TableHeader, TableContent, TableScrollContainer,
  TableRow,
  Input,
  useOverlayState,
} from "@heroui/react";
import { ApplicantDetails } from "@/components/admin/ApplicantDetails";

interface RejectedApp {
  application: Application;
  profile: Profile | null;
}

export default function AdminMembershipRejectedPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<RejectedApp[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detailsApp, setDetailsApp] = useState<RejectedApp | null>(null);
  const {
    isOpen: isDetailsOpen,
    open: openDetails,
    close: closeDetails,
  } = useOverlayState();

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/membership?status=rejected", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        applications?: Application[];
        profiles?: Profile[];
        departments?: Department[];
        accountNames?: Record<string, string>;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to load rejected applications"));

      setDepartments(payload?.departments ?? []);
      setAccountNames(payload?.accountNames ?? {});

      setDepartments(payload?.departments ?? []);

      const profileMap: Record<string, Profile> = {};
      for (const profile of payload?.profiles ?? []) profileMap[profile.userId] = profile;

      setApplications((payload?.applications ?? []).map((application) => ({
        application,
        profile: profileMap[application.userId] ?? null,
      })));
    } catch (error) {
      console.error("Error loading rejected applications:", error);
      toast.error(getErrorMessage(error) || "Failed to load rejected applications");
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

  const filteredApps = applications.filter((a) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      accountNames[a.application.userId]?.toLowerCase().includes(q) ||
      a.profile?.urn?.toLowerCase().includes(q) ||
      a.profile?.branch?.toLowerCase().includes(q) ||
      a.application.userId.toLowerCase().includes(q) ||
      a.application.rejectionReason?.toLowerCase().includes(q)
    );
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4" role="status" aria-label="Loading rejected applications">
          <Spinner size="lg" />
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
              variant="secondary"
              onPress={() => router.push("/admin/membership")}
            >
              <ArrowLeftIcon className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
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
            onChange={(e: any) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6 md:mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Rejected</p>
                <p className="text-2xl font-bold tabular-nums text-danger">{applications.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-danger/10 flex items-center justify-center">
                <XCircleIcon className="w-6 h-6 text-danger" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">With Reason Provided</p>
                <p className="text-2xl font-bold tabular-nums">
                  {applications.filter((a) => a.application.rejectionReason).length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <MessageSquareIcon className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Rejected Applications Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableScrollContainer>
                <TableContent aria-label="Rejected applications table" className="min-w-full">
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
                              <Avatar className="h-10 w-10 shrink-0">
                                <AvatarImage
                                  src={
                                    item.profile?.avatar ||
                                    `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                      accountNames[item.application.userId] || item.profile?.urn || item.application.userId
                                    )}&background=dc2626&color=fff`
                                  }
                                  alt={accountNames[item.application.userId] || item.profile?.urn || "Applicant"}
                                />
                                <AvatarFallback>
                                  {(accountNames[item.application.userId] || item.profile?.urn || "A").charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <div className="min-w-0">
                                <p className="font-semibold text-sm truncate">
                                  {accountNames[item.application.userId] || item.profile?.urn || item.application.userId.slice(0, 12)}
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
                              <div className="lg:hidden p-3 bg-surface-secondary rounded-lg text-xs space-y-2">
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
                                  <p className="text-danger">
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
                              <p className="text-sm text-danger line-clamp-2">
                                {item.application.rejectionReason}
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 text-xs text-default-400">
                              <AlertTriangleIcon className="w-3 h-3" />
                              No reason provided
                            </div>
                          )}
                          <Button
                            size="sm"
                            variant="secondary"
                            className="mt-1"
                            onPress={() => {
                              setDetailsApp(item);
                              openDetails();
                            }}
                          >
                            Details
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
                </TableContent>
              </TableScrollContainer>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Full applicant details */}
      <Modal>
        <ModalBackdrop
          isOpen={isDetailsOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              closeDetails();
              setDetailsApp(null);
            }
          }}
        >
          <ModalContainer>
            <ModalDialog className="sm:max-w-2xl">
              <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                <h2 className="text-xl font-bold">
                  {detailsApp
                    ? accountNames[detailsApp.application.userId] || "Applicant details"
                    : "Applicant details"}
                </h2>
                <p className="text-sm text-default-500 font-normal">
                  Everything the applicant submitted
                </p>
              </ModalHeader>
              <ModalBody className="py-6 max-h-[70vh] overflow-y-auto">
                {detailsApp && (
                  <ApplicantDetails
                    profile={detailsApp.profile}
                    application={detailsApp.application}
                    accountName={accountNames[detailsApp.application.userId]}
                    departmentNames={getDepartmentNames(
                      detailsApp.application.preferredDepartments
                    )}
                  />
                )}
              </ModalBody>
              <ModalFooter className="border-t pt-4">
                <Button
                  variant="secondary"
                  onPress={() => {
                    closeDetails();
                    setDetailsApp(null);
                  }}
                >
                  Close
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
