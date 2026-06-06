"use client";
import { useEffect, useState, useMemo, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { auditService } from "@/lib/audit";
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
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
} from "@heroui/react";
import type { AuditLog } from "@/lib/types/index";

const PAGE_SIZE = 25;

const ACTION_TYPES = [
  { value: "", label: "All Actions" },
  { value: "create_event", label: "Create Event" },
  { value: "update_event", label: "Update Event" },
  { value: "delete_event", label: "Delete Event" },
  { value: "approve_event", label: "Approve Event" },
  { value: "ban_user", label: "Ban User" },
  { value: "deactivate_user", label: "Deactivate User" },
  { value: "reactivate_user", label: "Reactivate User" },
  { value: "promote_user", label: "Promote User" },
  { value: "update_profile", label: "Update Profile" },
  { value: "approve_membership", label: "Approve Membership" },
  { value: "reject_membership", label: "Reject Membership" },
  { value: "grant_power", label: "Grant Power" },
  { value: "revoke_power", label: "Revoke Power" },
  { value: "assign_department", label: "Assign Department" },
  { value: "create_registration", label: "Create Registration" },
  { value: "cancel_registration", label: "Cancel Registration" },
];

const ENTITY_TYPES = [
  { value: "", label: "All Entities" },
  { value: "event", label: "Event" },
  { value: "membership", label: "Membership" },
  { value: "profile", label: "Profile" },
  { value: "registration", label: "Registration" },
  { value: "department", label: "Department" },
  { value: "designation", label: "Designation" },
  { value: "power", label: "Power" },
  { value: "ticket", label: "Ticket" },
  { value: "application", label: "Application" },
];

export default function AdminAuditPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [totalLogs, setTotalLogs] = useState(0);
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
      const result = await auditService.getLogs({
        action: actionFilter || undefined,
        limit: PAGE_SIZE,
        offset: page * PAGE_SIZE,
      });
      setLogs(result.logs);
      setTotalLogs(result.total);
    } catch (error) {
      console.error("Error loading audit logs:", error);
      toast.error("Failed to load audit logs");
    } finally {
      setLoadingLogs(false);
    }
  }, [actionFilter, page]);

  useEffect(() => {
    if (!authLoading && user) {
      loadLogs();
    }
  }, [authLoading, user, loadLogs]);

  const filteredLogs = useMemo(() => {
    let result = logs;

    if (entityFilter) {
      result = result.filter((log) => log.entityType === entityFilter);
    }

    if (userSearch.trim()) {
      const q = userSearch.toLowerCase().trim();
      result = result.filter(
        (log) =>
          log.actorName.toLowerCase().includes(q) ||
          log.actorId.toLowerCase().includes(q) ||
          log.entityId.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      result = result.filter((log) => new Date(log.timestamp) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((log) => new Date(log.timestamp) <= to);
    }

    return result;
  }, [logs, entityFilter, userSearch, dateFrom, dateTo]);

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

  const getActionColor = (action: string) => {
    if (action.includes("create") || action.includes("approve") || action.includes("reactivate"))
      return "success";
    if (action.includes("delete") || action.includes("ban") || action.includes("reject") || action.includes("deactivate"))
      return "danger";
    if (action.includes("update") || action.includes("promote") || action.includes("assign"))
      return "warning";
    if (action.includes("grant") || action.includes("revoke"))
      return "primary";
    return "default";
  };

  const getActionLabel = (action: string) => {
    return action
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

  const hasActiveFilters = actionFilter || entityFilter || userSearch || dateFrom || dateTo;

  const stats = useMemo(() => {
    const total = totalLogs;
    const recent24h = logs.filter(
      (log) =>
        new Date(log.timestamp) >=
        new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).length;
    const uniqueActors = new Set(logs.map((l) => l.actorId)).size;
    const uniqueActions = new Set(logs.map((l) => l.action)).size;
    return { total, recent24h, uniqueActors, uniqueActions };
  }, [logs, totalLogs]);

  if (authLoading || loadingLogs) {
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
            Audit Log
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Track all actions and changes across the system
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 md:mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Logs</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                <FileTextIcon className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Last 24h</p>
                <p className="text-2xl font-bold">{stats.recent24h}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <ClockIcon className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Unique Actors</p>
                <p className="text-2xl font-bold">{stats.uniqueActors}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Action Types</p>
                <p className="text-2xl font-bold">{stats.uniqueActions}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                <ActivityIcon className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-4">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <SearchIcon className="w-4 h-4 text-default-400" />
                  <div className="flex-1">
                    <Input
                      placeholder="Search by actor, user ID, or entity ID..."
                      value={userSearch}
                      onChange={(e: any) => {
                        setUserSearch(e.target.value);
                        setPage(0);
                      }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={actionFilter}
                  onChange={(e) => {
                    setActionFilter(e.target.value);
                    setPage(0);
                  }}
                  className="px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none min-w-[160px]"
                >
                  {ACTION_TYPES.map((a) => (
                    <option key={a.value} value={a.value}>
                      {a.label}
                    </option>
                  ))}
                </select>
                <select
                  value={entityFilter}
                  onChange={(e) => {
                    setEntityFilter(e.target.value);
                    setPage(0);
                  }}
                  className="px-3 py-2 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none min-w-[140px]"
                >
                  {ENTITY_TYPES.map((e) => (
                    <option key={e.value} value={e.value}>
                      {e.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <div className="flex-1 flex gap-3">
                <div className="flex-1">
                  <label className="text-xs text-default-500 mb-1 block">From</label>
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e: any) => {
                      setDateFrom(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
                <div className="flex-1">
                  <label className="text-xs text-default-500 mb-1 block">To</label>
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e: any) => {
                      setDateTo(e.target.value);
                      setPage(0);
                    }}
                  />
                </div>
              </div>
              {hasActiveFilters && (
                <div className="flex items-end">
                  <Button
                    variant="ghost"
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

          <div className="mt-3 text-sm text-default-500">
            Showing {filteredLogs.length} of {totalLogs} logs
            {hasActiveFilters && " (filtered)"}
          </div>
        </CardContent>
      </Card>

      <Card className="border-none shadow-lg">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table aria-label="Audit log table" className="min-w-full">
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
                          <span className="text-xs sm:text-sm whitespace-nowrap">
                            {formatTimestamp(log.timestamp)}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {log.actorName?.charAt(0)?.toUpperCase() || "?"}
                          </div>
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
                          color={getActionColor(log.action) as any}
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
                            variant="ghost"
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
                    <div key={log.$id} className="p-4 bg-default-50 dark:bg-default-100/5">
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
                      <pre className="text-xs font-mono bg-white dark:bg-gray-900 border border-default-200 rounded-lg p-3 overflow-x-auto max-h-60 overflow-y-auto">
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
          <p className="text-sm text-default-500">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="ghost"
              isDisabled={page === 0}
              onPress={() => setPage((p) => Math.max(0, p - 1))}
            >
              <ChevronLeftIcon className="w-4 h-4 mr-1" />
              Previous
            </Button>
            <Button
              size="sm"
              variant="ghost"
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
