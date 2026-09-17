"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errorHandler";
import { toast } from "sonner";
import type { Application, Profile, Department } from "@/lib/types";
import {
  UsersIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  MailIcon,
  CalendarIcon,
  Building2Icon,
  ShieldCheckIcon,
  XIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
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
  Tabs,
  Tab,
  TabListContainer,
  TabList,
  TabIndicator,
  TabPanel,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import { ApplicantDetails } from "@/components/admin/ApplicantDetails";

type TabKey = "pending" | "approved" | "rejected";

export default function AdminMembershipPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [accountNames, setAccountNames] = useState<Record<string, string>>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [actionTarget, setActionTarget] = useState<Application | null>(null);
  const [actionType, setActionType] = useState<"approve" | "reject">("approve");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const { isOpen, open, close } = useOverlayState();
  const [detailsApp, setDetailsApp] = useState<Application | null>(null);
  const {
    isOpen: isDetailsOpen,
    open: openDetails,
    close: closeDetails,
  } = useOverlayState();

  /**
   * One request returns the applications, their applicants' profiles, the
   * department catalogue and the queue counts.
   *
   * This previously read the applications table with the browser SDK and then
   * issued one profile query per applicant.
   */
  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/membership", { cache: "no-store" });
      const payload = await response.json().catch(() => null) as {
        applications?: Application[];
        profiles?: Profile[];
        departments?: Department[];
        counts?: { pending: number; approved: number; rejected: number };
        accountNames?: Record<string, string>;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to load membership data");

      setApplications(payload?.applications ?? []);
      setDepartments(payload?.departments ?? []);
      setAccountNames(payload?.accountNames ?? {});
      setCounts(payload?.counts ?? { pending: 0, approved: 0, rejected: 0 });

      const profileMap: Record<string, Profile> = {};
      for (const profile of payload?.profiles ?? []) profileMap[profile.userId] = profile;
      setProfiles(profileMap);
    } catch (error) {
      console.error("Error loading membership data:", error);
      toast.error(getErrorMessage(error) || "Failed to load membership data");
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

  const getFilteredApps = () => {
    return applications.filter((a) => a.status === activeTab);
  };

  const getDepartmentNames = (ids?: string[]) => {
    if (!ids || ids.length === 0) return [];
    return ids
      .map((id) => departments.find((d) => d.$id === id)?.name)
      .filter(Boolean) as string[];
  };

  const handleOpenAction = (app: Application, type: "approve" | "reject") => {
    setActionTarget(app);
    setActionType(type);
    setRejectReason("");
    open();
  };

  /**
   * Approving is the action that grants membership, so every part of it — the
   * application transition, the membership record, the department assignments,
   * the applicant's notification, and the audit entry — happens server-side in
   * one call. The message shown reflects what the server actually did.
   */
  const handleConfirmAction = async () => {
    if (!actionTarget?.$id) return;

    if (actionType === "reject" && !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch("/api/admin/membership", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          actionType === "approve"
            ? { action: "approve", applicationId: actionTarget.$id }
            : { action: "reject", applicationId: actionTarget.$id, reason: rejectReason.trim() }
        ),
      });
      const payload = await response.json().catch(() => null) as {
        assignedDepartments?: number;
        membershipCreated?: boolean;
        error?: string;
      } | null;
      if (!response.ok) throw new Error(payload?.error || "Action failed. Please try again.");

      if (actionType === "approve") {
        const assigned = payload?.assignedDepartments ?? 0;
        toast.success("Application approved.", {
          description: [
            payload?.membershipCreated ? "Membership created" : "Existing membership reactivated",
            assigned > 0 ? `${assigned} department ${assigned === 1 ? "assignment" : "assignments"} added` : null,
            "Applicant notified",
          ].filter(Boolean).join(" \u00b7 "),
        });
      } else {
        toast.success("Application rejected.", { description: "The applicant has been notified." });
      }

      close();
      setActionTarget(null);
      await loadData();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Action failed:", message);
      toast.error(message || "Action failed. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Loading membership queue...</p>
        </div>
      </div>
    );
  }

  const filteredApps = getFilteredApps();

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Membership Queue
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Review and manage membership applications
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Pending</p>
                <p className="text-2xl font-bold text-amber-600">{counts.pending}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Approved</p>
                <p className="text-2xl font-bold text-green-600">{counts.approved}</p>
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
                <p className="text-sm text-default-500">Rejected</p>
                <p className="text-2xl font-bold text-red-600">{counts.rejected}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <XCircleIcon className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <Tabs
            selectedKey={activeTab}
            onSelectionChange={(key) => setActiveTab(key as TabKey)}
            aria-label="Membership application status"
          >
            <TabListContainer>
              <TabList>
                <Tab id="pending">
                  <div className="flex items-center gap-2">
                    <ClockIcon className="w-4 h-4" />
                    <span>Pending</span>
                    {counts.pending > 0 && (
                      <Chip size="sm" color="warning" variant="soft">
                        {counts.pending}
                      </Chip>
                    )}
                  </div>
                  <TabIndicator />
                </Tab>
                <Tab id="approved">
                  <div className="flex items-center gap-2">
                    <CheckCircleIcon className="w-4 h-4" />
                    <span>Approved</span>
                  </div>
                  <TabIndicator />
                </Tab>
                <Tab id="rejected">
                  <div className="flex items-center gap-2">
                    <XCircleIcon className="w-4 h-4" />
                    <span>Rejected</span>
                  </div>
                  <TabIndicator />
                </Tab>
              </TabList>
            </TabListContainer>

            <TabPanel id="pending">
              <div className="p-4">
                {filteredApps.length === 0 ? (
                  <div className="text-center py-12">
                    <ClockIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                    <p className="text-default-500 text-lg font-medium">No pending applications</p>
                    <p className="text-default-400 text-sm mt-1">
                      All applications have been reviewed
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableScrollContainer>
                        <TableContent aria-label="Pending applications table">
                      <TableHeader>
                        <TableColumn>APPLICANT</TableColumn>
                        <TableColumn className="hidden md:table-cell">SUBMITTED</TableColumn>
                        <TableColumn className="hidden lg:table-cell">DEPARTMENTS</TableColumn>
                        <TableColumn>ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {filteredApps.map((app) => {
                          const profile = profiles[app.userId];
                          const deptNames = getDepartmentNames(app.preferredDepartments);
                          const isExpanded = expandedId === app.$id;

                          return (
                            <TableRow key={app.$id}>
                              <TableCell>
                                <div className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    <img
                                      src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(accountNames[app.userId] || profile?.urn || app.userId)}&background=7c3aed&color=fff`}
                                      alt={accountNames[app.userId] || profile?.urn || "Applicant"}
                                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm truncate">
                                        {accountNames[app.userId] || profile?.urn || app.userId.slice(0, 8)}
                                      </p>
                                      <p className="text-xs text-default-400 truncate">
                                        {profile?.branch || profile?.program || "No program info"}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Mobile-only details */}
                                  <div className="md:hidden space-y-1">
                                    <p className="text-xs text-default-400 flex items-center gap-1">
                                      <CalendarIcon className="w-3 h-3" />
                                      {new Date(app.submittedAt).toLocaleDateString()}
                                    </p>
                                    {deptNames.length > 0 && (
                                      <div className="flex flex-wrap gap-1">
                                        {deptNames.map((name) => (
                                          <Chip key={name} size="sm" variant="soft" color="accent" className="text-xs">
                                            {name}
                                          </Chip>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="p-0 h-auto text-xs text-default-400 md:hidden"
                                    onPress={() => setExpandedId(isExpanded ? null : app.$id!)}
                                  >
                                    {isExpanded ? "Less" : "More"} details
                                    {isExpanded ? (
                                      <ChevronUpIcon className="w-3 h-3 ml-1" />
                                    ) : (
                                      <ChevronDownIcon className="w-3 h-3 ml-1" />
                                    )}
                                  </Button>

                                  {isExpanded && (
                                    <div className="md:hidden p-3 bg-default-50 dark:bg-default-100/10 rounded-lg text-xs space-y-1">
                                      <p className="flex items-center gap-1">
                                        <MailIcon className="w-3 h-3" />
                                        {accountNames[app.userId] || app.userId}
                                      </p>
                                      <p className="flex items-center gap-1">
                                        <Building2Icon className="w-3 h-3" />
                                        {profile?.branch || "N/A"} - Year {profile?.year || "N/A"}
                                      </p>
                                      <p className="flex items-center gap-1">
                                        <ShieldCheckIcon className="w-3 h-3" />
                                        Oath: {app.oathAccepted ? "Accepted" : "Not accepted"}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell className="hidden md:table-cell">
                                <div className="space-y-1">
                                  <p className="text-sm">
                                    {new Date(app.submittedAt).toLocaleDateString()}
                                  </p>
                                  <p className="text-xs text-default-400">
                                    {new Date(app.submittedAt).toLocaleTimeString()}
                                  </p>
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
                                    <span className="text-xs text-default-400">No preference</span>
                                  )}
                                </div>
                              </TableCell>

                              <TableCell>
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onPress={() => {
                                      setDetailsApp(app);
                                      openDetails();
                                    }}
                                  >
                                    Details
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onPress={() => handleOpenAction(app, "approve")}
                                    isDisabled={processing}
                                  >
                                    <CheckCircleIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">Approve</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onPress={() => handleOpenAction(app, "reject")}
                                    isDisabled={processing}
                                  >
                                    <XIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">Reject</span>
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                        </TableContent>
                      </TableScrollContainer>
                    </Table>
                  </div>
                )}
              </div>
            </TabPanel>

            <TabPanel id="approved">
              <div className="p-4 text-center py-12">
                <CheckCircleIcon className="w-12 h-12 text-green-400 mx-auto mb-4" />
                <p className="text-default-500 text-lg font-medium">
                  {counts.approved} approved members
                </p>
                <p className="text-default-400 text-sm mt-1">
                  <a href="/admin/membership/approved" className="text-primary hover:underline">
                    View all approved members
                  </a>
                </p>
              </div>
            </TabPanel>

            <TabPanel id="rejected">
              <div className="p-4 text-center py-12">
                <XCircleIcon className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-default-500 text-lg font-medium">
                  {counts.rejected} rejected applications
                </p>
                <p className="text-default-400 text-sm mt-1">
                  <a href="/admin/membership/rejected" className="text-primary hover:underline">
                    View all rejected applications
                  </a>
                </p>
              </div>
            </TabPanel>
          </Tabs>
        </CardContent>
      </Card>

      {/* Approve/Reject Confirmation Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              close();
              setActionTarget(null);
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2
                      className={`text-xl font-bold ${
                        actionType === "approve"
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {actionType === "approve"
                        ? "Approve Application"
                        : "Reject Application"}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      {actionType === "approve"
                        ? "This will create a membership and send a welcome notification."
                        : "Please provide a reason for rejection."}
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6">
                    {actionTarget && (
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-default-50 dark:bg-default-100/10 rounded-lg">
                          <img
                            src={
                              profiles[actionTarget.userId]?.avatar ||
                              `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                profiles[actionTarget.userId]?.urn || actionTarget.userId
                              )}&background=7c3aed&color=fff`
                            }
                            alt="Applicant"
                            className="w-12 h-12 rounded-full object-cover"
                          />
                          <div>
                            <p className="font-semibold">
                              {profiles[actionTarget.userId]?.urn || actionTarget.userId.slice(0, 12)}
                            </p>
                            <p className="text-sm text-default-400">
                              {profiles[actionTarget.userId]?.branch ||
                                profiles[actionTarget.userId]?.program ||
                                "No program info"}
                            </p>
                          </div>
                        </div>

                        {actionTarget.preferredDepartments &&
                          actionTarget.preferredDepartments.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">
                                Preferred Departments:
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {getDepartmentNames(actionTarget.preferredDepartments).map(
                                  (name) => (
                                    <Chip key={name} variant="soft" color="accent">
                                      {name}
                                    </Chip>
                                  )
                                )}
                              </div>
                            </div>
                          )}

                        {actionType === "reject" && (
                          <div>
                            <label className="block text-sm font-medium mb-2">
                              Rejection Reason *
                            </label>
                            <TextArea
                              placeholder="Explain why this application is being rejected..."
                              value={rejectReason}
                              onChange={(e: any) => setRejectReason(e.target.value)}
                              rows={3}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="ghost"
                      onPress={() => {
                        dialogClose();
                        close();
                        setActionTarget(null);
                      }}
                      isDisabled={processing}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant={actionType === "approve" ? "primary" : "danger"}
                      onPress={handleConfirmAction}
                      isPending={processing}
                    >
                      {actionType === "approve" ? "Confirm Approval" : "Confirm Rejection"}
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

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
                  {detailsApp ? accountNames[detailsApp.userId] || "Applicant details" : "Applicant details"}
                </h2>
                <p className="text-sm text-default-500 font-normal">
                  Everything the applicant submitted
                </p>
              </ModalHeader>
              <ModalBody className="py-6 max-h-[70vh] overflow-y-auto">
                {detailsApp && (
                  <ApplicantDetails
                    profile={profiles[detailsApp.userId] ?? null}
                    application={detailsApp}
                    accountName={accountNames[detailsApp.userId]}
                    departmentNames={getDepartmentNames(detailsApp.preferredDepartments)}
                  />
                )}
              </ModalBody>
              <ModalFooter className="border-t pt-4">
                <Button
                  variant="ghost"
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

