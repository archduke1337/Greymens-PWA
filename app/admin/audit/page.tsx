"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { auditService, type AuditLogFilters } from "@/lib/audit";
import MemberAvatar from "@/components/MemberAvatar";
import { toast } from "sonner";
import {
  SearchIcon,
  ClockIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XIcon,
  UserIcon,
  ActivityIcon,
  FileTextIcon,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  ListBox,
  Select,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader, TableContent, TableScrollContainer,
  TableRow,
} from "@heroui/react";
import type { AuditLog } from "@/lib/types/index";

const PAGE_SIZE = 25;

// Mirror the Chip color union so an invalid color is a compile error.
type ChipColor = "default" | "success" | "warning" | "danger" | "accent";

// Must mirror the action strings written via recordAudit — the API filters by
// exact match, so a value that matches nothing silently returns zero rows.
// Legacy snake_case values are kept because old rows still carry them.
const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "event.create", label: "Event — Create" },
  { value: "event.update", label: "Event — Update" },
  { value: "event.delete", label: "Event — Delete" },
  { value: "event.approve", label: "Event — Approve" },
  { value: "event.publish", label: "Event — Publish" },
  { value: "event.reject", label: "Event — Reject" },
  { value: "event.register", label: "Event — Register" },
  { value: "event.cancel_registration", label: "Event — Cancel registration" },
  { value: "event.promote_waitlist", label: "Event — Promote waitlist" },
  { value: "registration.approve", label: "Registration — Approve" },
  { value: "registration.reject", label: "Registration — Reject" },
  { value: "approve_application", label: "Membership — Approve (legacy)" },
  { value: "reject_application", label: "Membership — Reject (legacy)" },
  { value: "set_membership_status", label: "Membership — Status change (legacy)" },
  { value: "profile.update", label: "Profile — Update" },
  { value: "update_user_profile", label: "Profile — Update (legacy)" },
  { value: "department.create", label: "Department — Create" },
  { value: "department.update", label: "Department — Update" },
  { value: "department.delete", label: "Department — Deactivate" },
  { value: "department_member.assign", label: "Department — Assign member" },
  { value: "department_member.remove", label: "Department — Remove member" },
  { value: "designation.create", label: "Designation — Create" },
  { value: "designation.update", label: "Designation — Update" },
  { value: "designation.assign", label: "Designation — Assign" },
  { value: "designation.revoke", label: "Designation — Revoke" },
  { value: "designation.deactivate", label: "Designation — Deactivate" },
  { value: "power.grant", label: "Power — Grant" },
  { value: "power.revoke", label: "Power — Revoke" },
  { value: "access.role_created", label: "Access — Role created" },
  { value: "access.role_assigned", label: "Access — Role assigned" },
  { value: "access.role_capabilities_updated", label: "Access — Capabilities updated" },
  { value: "office.assign", label: "Office — Assign" },
  { value: "office.end", label: "Office — End assignment" },
  { value: "governance.create", label: "Governance — Create" },
  { value: "governance.update", label: "Governance — Update" },
  { value: "ticket_check_in", label: "Ticket — Check in" },
  { value: "ticket_invalidate", label: "Ticket — Invalidate" },
  { value: "incident.report", label: "Incident — Report" },
  { value: "incident.decide", label: "Incident — Decide" },
  { value: "activity.request", label: "Activity — Request" },
  { value: "activity.decide", label: "Activity — Decide" },
  { value: "notification.send", label: "Notification — Send" },
  { value: "blog.delete", label: "Blog — Delete" },
  { value: "blog_delete", label: "Blog — Delete (legacy)" },
  { value: "gallery.delete", label: "Gallery — Delete" },
  { value: "resource.create", label: "Resource — Create" },
  { value: "resource.update", label: "Resource — Update" },
  { value: "resource.delete", label: "Resource — Delete" },
  { value: "sponsor.create", label: "Sponsor — Create" },
  { value: "sponsor.update", label: "Sponsor — Update" },
  { value: "sponsor.delete", label: "Sponsor — Delete" },
  { value: "project.create", label: "Project — Create" },
  { value: "project.update", label: "Project — Update" },
  { value: "project.delete", label: "Project — Delete" },
  { value: "event_type.create", label: "Event type — Create" },
  { value: "event_type.update", label: "Event type — Update" },
  { value: "event_type.delete", label: "Event type — Delete" },
];

const ENTITY_TYPES = [
  { value: "", label: "All Entities" },
  { value: "event", label: "Event" },
  { value: "registration", label: "Registration" },
  { value: "membership", label: "Membership" },
  { value: "application", label: "Application" },
  { value: "profile", label: "Profile" },
  { value: "department", label: "Department" },
  { value: "user_department", label: "Department membership" },
  { value: "designation", label: "Designation" },
  { value: "user_designations", label: "Designation grant" },
  { value: "power", label: "Power" },
  { value: "user_power", label: "Power grant" },
  { value: "role_template", label: "Role template" },
  { value: "role_assignment", label: "Role assignment" },
  { value: "user_roles", label: "User role" },
  { value: "office_assignment", label: "Office assignment" },
  { value: "governance_record", label: "Governance record" },
  { value: "event_type", label: "Event type" },
  { value: "ticket", label: "Ticket" },
  { value: "incident", label: "Incident" },
  { value: "authorized_activity", label: "Authorized activity" },
  { value: "project", label: "Project" },
  { value: "resource", label: "Resource" },
  { value: "sponsor", label: "Sponsor" },
  { value: "blog", label: "Blog post" },
  { value: "gallery_image", label: "Gallery image" },
  { value: "notification", label: "Notification" },
];

export default function AdminAuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actorAvatars, setActorAvatars] = useState<Record<string, string>>({});
  const [totalLogs, setTotalLogs] = useState(0);
  const [last24h, setLast24h] = useState(0);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [page, setPage] = useState(0);

  const [actionFilter, setActionFilter] = useState("");
  const [entityFilter, setEntityFilter] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const filters: AuditLogFilters = { page, limit: PAGE_SIZE };
      if (actionFilter) filters.action = actionFilter;
      if (entityFilter) filters.entityType = entityFilter;
      // The date inputs are local days; the stored timestamp is UTC ISO-8601.
      if (dateFrom) filters.from = new Date(`${dateFrom}T00:00:00.000`).toISOString();
      if (dateTo) filters.to = new Date(`${dateTo}T23:59:59.999`).toISOString();

      const result = await auditService.getLogs(filters);
      setLogs(result.logs);
      setActorAvatars(result.actorAvatars ?? {});
      setTotalLogs(result.total);
      setLast24h(result.stats.last24h);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error(error instanceof Error ? error.message : "Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [actionFilter, entityFilter, dateFrom, dateTo, page]);

  useEffect(() => {
    if (!authLoading && user) {
      loadLogs();
    }
  }, [authLoading, user, loadLogs]);

  // Action, entity and date filters are applied by the API, so they search the
  // whole log rather than the loaded page. Free-text search narrows only the
  // page that is on screen, which the summary states explicitly.
  const filteredLogs = useMemo(() => {
    if (!userSearch.trim()) return logs;
    const q = userSearch.toLowerCase().trim();
    return logs.filter(
      (log) =>
        log.actorName?.toLowerCase().includes(q) ||
        log.actorId?.toLowerCase().includes(q) ||
        log.entityId?.toLowerCase().includes(q)
    );
  }, [logs, userSearch]);

  const totalPages = Math.ceil(totalLogs / PAGE_SIZE);

  const toggleExpand = (id: string) => {
    setExpandedRow((prev) => (prev === id ? null : id));
  };

  const formatTimestamp = (ts: string) => {
    try {
      return new Date(ts).toLocaleString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
    } catch {
      return ts;
    }
  };

  const getActionColor = (action: string): ChipColor => {
    if (action.includes("create") || action.includes("approve") || action.includes("reactivate"))
      return "success";
    if (action.includes("delete") || action.includes("ban") || action.includes("reject") || action.includes("deactivate"))
      return "danger";
    if (action.includes("update") || action.includes("promote") || action.includes("assign"))
      return "warning";
    if (action.includes("grant") || action.includes("revoke"))
      return "accent";
    return "default";
  };

  const getActionLabel = (action: string) => {
    return action
      .replace(/\./g, " · ")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
  };

  const clearFilters = () => {
    setActionFilter("");
    setEntityFilter("");
    setUserSearch("");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const hasServerFilters = Boolean(actionFilter || entityFilter || dateFrom || dateTo);
  const hasActiveFilters = Boolean(userSearch || hasServerFilters);

  const stats = useMemo(
    () => ({
      total: totalLogs,
      recent24h: last24h,
      uniqueActors: new Set(logs.map((log) => log.actorId)).size,
      uniqueActions: new Set(logs.map((log) => log.action)).size,
    }),
    [logs, totalLogs, last24h]
  );

  if (authLoading || loadingLogs) {
    return (
      <div role="status" aria-label="Loading audit log" className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
        <span className="sr-only">Loading audit log...</span>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Audit Log
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Track all actions and changes across the system
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Logs</p>
                <p className="text-2xl font-bold tabular-nums">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <FileTextIcon className="w-6 h-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Last 24h</p>
                <p className="text-2xl font-bold tabular-nums">{stats.recent24h}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-success/10 flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-success" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Actors on page</p>
                <p className="text-2xl font-bold tabular-nums">{stats.uniqueActors}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-accent" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Action types on page</p>
                <p className="text-2xl font-bold tabular-nums">{stats.uniqueActions}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center">
                <ActivityIcon className="w-6 h-6 text-warning" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <SearchIcon className="w-4 h-4 text-default-400" />
                  <div className="flex-1">
                    <Input
                      placeholder="Search by actor, user ID, or entity ID..."
                      aria-label="Search audit log by actor, user ID, or entity ID"
                      value={userSearch}
                      onChange={(e) => {
                        setUserSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <Select
                  className="min-w-[160px]"
                  aria-label="Filter by action"
                  value={actionFilter === "" ? "all" : actionFilter}
                  onChange={(value) => {
                    setActionFilter(value === "all" ? "" : String(value ?? ""));
                    setPage(0);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {ACTION_TYPES.map((a) => (
                        <ListBox.Item key={a.value === "" ? "all" : a.value} id={a.value === "" ? "all" : a.value} textValue={a.label}>
                          {a.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
                <Select
                  className="min-w-[140px]"
                  aria-label="Filter by entity type"
                  value={entityFilter === "" ? "all" : entityFilter}
                  onChange={(value) => {
                    setEntityFilter(value === "all" ? "" : String(value ?? ""));
                    setPage(0);
                  }}
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {ENTITY_TYPES.map((e) => (
                        <ListBox.Item key={e.value === "" ? "all" : e.value} id={e.value === "" ? "all" : e.value} textValue={e.label}>
                          {e.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-3">
                <div className="flex-1">
                  <label htmlFor="audit-date-from" className="text-xs text-default-500 mb-1 block">From</label>
                  <Input
                    id="audit-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="audit-date-to" className="text-xs text-default-500 mb-1 block">To</label>
                  <Input
                    id="audit-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="secondary"
                    size="sm"
                    onPress={clearFilters}
                  >
                    <XIcon className="w-4 h-4 mr-1" />
                    Clear Filters
                  </Button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-3 text-sm tabular-nums text-default-500">
            Showing {filteredLogs.length} of {totalLogs} logs
            {hasServerFilters && " · filters applied to the whole log"}
            {userSearch.trim() && " · text search applies to this page"}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableScrollContainer>
                <TableContent aria-label="Audit log table" className="min-w-full">
              <TableHeader>
                <TableColumn>Timestamp</TableColumn>
                <TableColumn>Actor</TableColumn>
                <TableColumn>Action</TableColumn>
                <TableColumn className="hidden md:table-cell">Entity</TableColumn>
                <TableColumn className="hidden lg:table-cell">Details</TableColumn>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5}>
                      <div className="text-center py-12">
                        <FileTextIcon className="w-12 h-12 text-default-300 mx-auto mb-4" />
                        <p className="text-default-500">
                          {hasActiveFilters
                            ? "No logs match your filters"
                            : "No audit logs found"}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.$id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <ClockIcon className="w-3 h-3 text-default-400 hidden sm:block" />
                          <span className="text-xs tabular-nums sm:text-sm whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <MemberAvatar
                            src={log.actorId ? actorAvatars[log.actorId] : undefined}
                            name={log.actorName}
                            className="w-7 h-7 text-xs font-bold flex-shrink-0 bg-primary text-primary-foreground"
                          />
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate max-w-[120px]">
                              {log.actorName}
                            </p>
                            <p className="text-xs text-default-400 truncate max-w-[100px]">
                              {log.actorRole}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Chip
                          color={getActionColor(log.action)}
                          variant="primary"
                          size="sm"
                          className="text-xs"
                        >
                          {getActionLabel(log.action)}
                        </Chip>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div className="text-sm">
                          <span className="text-default-500">{log.entityType}</span>
                          <span className="text-default-300 mx-1">/</span>
                          <span className="font-mono text-xs truncate max-w-[100px] inline-block align-middle">
                            {log.entityId?.slice(0, 8)}...
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {log.details ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            onPress={() => toggleExpand(log.$id!)}
                            className="text-xs h-7"
                          >
                            {expandedRow === log.$id ? (
                              <>
                                <ChevronUpIcon className="w-3 h-3 mr-1" />
                                Hide
                              </>
                            ) : (
                              <>
                                <ChevronDownIcon className="w-3 h-3 mr-1" />
                                View
                              </>
                            )}
                          </Button>
                        ) : (
                          <span className="text-xs text-default-300">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
                </TableContent>
              </TableScrollContainer>
            </Table>
          </div>

          {filteredLogs.length > 0 && filteredLogs.some((log) => expandedRow === log.$id) && (
            <div className="border-t">
              {filteredLogs
                .filter((log) => expandedRow === log.$id)
                .map((log) => {
                  let detailsStr = "";
                  try {
                    const details =
                      typeof log.details === "string"
                        ? JSON.parse(log.details)
                        : log.details;
                    detailsStr = JSON.stringify(details, null, 2);
                  } catch {
                    detailsStr = String(log.details);
                  }
                  return (
                    <div key={log.$id} className="p-4 bg-surface-secondary">
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-semibold text-default-500 uppercase tracking-wider">
                          Details — {log.entityType}/{log.entityId}
                        </p>
                        <Button
                          size="sm"
                          variant="ghost"
                          isIconOnly
                          onPress={() => setExpandedRow(null)}
                        >
                          <XIcon className="w-3 h-3" />
                        </Button>
                      </div>
                      <pre className="text-xs font-mono bg-surface border border-border rounded-xl p-3 overflow-x-auto max-h-60 overflow-y-auto">
                        {detailsStr}
                      </pre>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-6">
          <p className="text-sm tabular-nums text-default-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              isDisabled={page === 0}
              onPress={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="secondary"
              isDisabled={page >= totalPages - 1}
              onPress={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
            >
              Next
              <ChevronRightIcon className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
