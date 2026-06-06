"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { Query } from "appwrite";
import { applicationService } from "@/lib/applications";
import { membershipService } from "@/lib/memberships";
import { profileService } from "@/lib/profiles";
import { departmentService } from "@/lib/departments";
import { notificationService } from "@/lib/notifications";
import { auditService } from "@/lib/audit";
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
  TableHeader,
  TableRow,
  Tabs,
<<<<<<< Updated upstream
=======
  Tab,
>>>>>>> Stashed changes
  TabListContainer,
  TabList,
  TabIndicator,
  TabPanel,
  Textarea,
  useOverlayState,
} from "@heroui/react";

type TabKey = "pending" | "approved" | "rejected";

export default function AdminMembershipPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [applications, setApplications] = useState<Application[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
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

  const loadData = useCallback(async () => {
    try {
      const [pendingApps, approvedApps, rejectedApps, deptData] = await Promise.all([
        applicationService.getPending(),
        applicationService.getAll([Query.equal("status", "approved")]),
        applicationService.getAll([Query.equal("status", "rejected")]),
        departmentService.getAll(),
      ]);

      setDepartments(deptData);
      setCounts({
        pending: pendingApps.length,
        approved: approvedApps.length,
        rejected: rejectedApps.length,
      });

      const allApps = [...pendingApps, ...approvedApps, ...rejectedApps];
      setApplications(allApps);

      const userIds = [...new Set(allApps.map((a) => a.userId))];
      const profilePromises = userIds.map((id) => profileService.getByUserId(id));
      const profileResults = await Promise.all(profilePromises);
      const profileMap: Record<string, Profile> = {};
      profileResults.forEach((p) => {
        if (p) profileMap[p.userId] = p;
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error("Error loading membership data:", error);
      toast.error("Failed to load membership data");
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

  const handleConfirmAction = async () => {
    if (!actionTarget || !user) return;

    if (actionType === "reject" && !rejectReason.trim()) {
      toast.error("Please provide a rejection reason");
      return;
    }

    setProcessing(true);
    try {
      if (actionType === "approve") {
        await applicationService.approve(actionTarget.$id!, user.$id);

        await membershipService.create({
          userId: actionTarget.userId,
          applicationId: actionTarget.$id!,
          approvedBy: user.$id,
          department: actionTarget.preferredDepartments?.[0],
        });

        if (actionTarget.preferredDepartments?.length) {
          for (const deptId of actionTarget.preferredDepartments) {
            await departmentService.assignUser(
              actionTarget.userId,
              deptId,
              "member",
              user.$id
            );
          }
        }

        const profile = profiles[actionTarget.userId];
        const name = profile?.urn || user.name || "Member";
        const welcomeLetter = notificationService.welcomeLetter({
          name,
          membershipId: `Generated on approval`,
          department: actionTarget.preferredDepartments?.[0]
            ? getDepartmentNames([actionTarget.preferredDepartments[0]])[0]
            : undefined,
        });

        await notificationService.create({
          userId: actionTarget.userId,
          type: "membership_approved",
          title: "Application Approved!",
          body: `Congratulations! Your membership application has been approved. Welcome to MindMesh Club!`,
          letter: welcomeLetter,
        });

        await auditService.log({
          actorId: user.$id,
          actorName: user.name || "Admin",
          actorRole: "admin",
          action: "approve_application",
          entityType: "application",
          entityId: actionTarget.$id!,
          details: {
            applicantId: actionTarget.userId,
            departments: actionTarget.preferredDepartments,
          },
        });

        toast.success("Application approved successfully!");
      } else {
        await applicationService.reject(
          actionTarget.$id!,
          user.$id,
          rejectReason.trim()
        );

        await notificationService.create({
          userId: actionTarget.userId,
          type: "membership_rejected",
          title: "Application Not Approved",
          body: `Your membership application was not approved at this time. Reason: ${rejectReason.trim()}`,
        });

        await auditService.log({
          actorId: user.$id,
          actorName: user.name || "Admin",
          actorRole: "admin",
          action: "reject_application",
          entityType: "application",
          entityId: actionTarget.$id!,
          details: {
            applicantId: actionTarget.userId,
            reason: rejectReason.trim(),
          },
        });

        toast.success("Application rejected.");
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
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
<<<<<<< Updated upstream
                      <Chip size="sm" color="warning" variant="flat">
=======
                      <Chip size="sm" color="warning" variant="soft">
>>>>>>> Stashed changes
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
                    <Table aria-label="Pending applications table">
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
                                      src={profile?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile?.urn || app.userId)}&background=7c3aed&color=fff`}
                                      alt={profile?.urn || "Applicant"}
                                      className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                    />
                                    <div className="min-w-0">
                                      <p className="font-semibold text-sm truncate">
                                        {profile?.urn || app.userId.slice(0, 8)}
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
<<<<<<< Updated upstream
                                          <Chip key={name} size="sm" variant="flat" color="primary" className="text-xs">
=======
                                          <Chip key={name} size="sm" variant="soft" color="default" className="text-xs">
>>>>>>> Stashed changes
                                            {name}
                                          </Chip>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <Button
                                    size="sm"
<<<<<<< Updated upstream
                                    variant="light"
=======
                                    variant="ghost"
>>>>>>> Stashed changes
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
                                        {app.userId}
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
<<<<<<< Updated upstream
                                      <Chip key={name} size="sm" variant="flat" color="primary">
=======
                                      <Chip key={name} size="sm" variant="soft" color="default">
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                                    color="success"
                                    variant="flat"
=======
                                    variant="primary"
>>>>>>> Stashed changes
                                    onPress={() => handleOpenAction(app, "approve")}
                                    isDisabled={processing}
                                  >
                                    <CheckCircleIcon className="w-4 h-4" />
                                    <span className="hidden sm:inline ml-1">Approve</span>
                                  </Button>
                                  <Button
                                    size="sm"
<<<<<<< Updated upstream
                                    color="danger"
                                    variant="flat"
=======
                                    variant="danger"
>>>>>>> Stashed changes
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
                  <a href="/admin/membership/approved" className="text-purple-600 hover:underline">
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
                  <a href="/admin/membership/rejected" className="text-purple-600 hover:underline">
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
<<<<<<< Updated upstream
                                    <Chip key={name} variant="flat" color="primary">
=======
                                    <Chip key={name} variant="soft" color="default">
>>>>>>> Stashed changes
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
                            <Textarea
                              placeholder="Explain why this application is being rejected..."
                              value={rejectReason}
                              onValueChange={setRejectReason}
                              minRows={3}
                              className="w-full"
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
<<<<<<< Updated upstream
                      variant="flat"
=======
                      variant="secondary"
>>>>>>> Stashed changes
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
<<<<<<< Updated upstream
                      color={actionType === "approve" ? "success" : "danger"}
=======
                      variant={actionType === "approve" ? "primary" : "danger"}
>>>>>>> Stashed changes
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
    </div>
  );
}
<<<<<<< Updated upstream


=======
>>>>>>> Stashed changes
