"use client";

import type { Application, Event } from "@/lib/types";
import MyPowersCard from "@/components/dashboards/MyPowersCard";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  ChevronRight,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";

import { usePermissions } from "@/context/PermissionContext";

export default function LeadDashboard() {
  const { userDepartments, userDesignations, allDepartments, hasPermission } =
    usePermissions();

  type LeadDashboardPayload = {
    lead?: {
      events: Event[];
      pendingApplications: Application[];
      departmentMemberCounts: Record<string, number>;
    };
  };

  const [data, setData] = useState<LeadDashboardPayload["lead"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const leadDepartments = userDepartments.filter((ud) => ud.role === "lead");
  const leadDepartmentIds = leadDepartments.map((ud) => ud.departmentId);

  // `draft_events` and `manage_department_team` are department-scoped
  // capabilities: the grant is stored as `capability:department:<id>` and only
  // applies inside the department it was issued for. They must therefore be
  // asked with a scope, and the answer is "any of my departments", not "my
  // first department" — a lead may hold the role in one department and not in
  // another. Asking without a scope resolves to false, which is why these
  // checks previously appeared always-on and now need the loop.
  const canDraftEvents = leadDepartmentIds.some((id) =>
    hasPermission("draft_events", `department:${id}`),
  );
  const canManageTeam = leadDepartmentIds.some((id) =>
    hasPermission("manage_department_team", `department:${id}`),
  );

  useEffect(() => {
    let cancelled = false;
    const loadData = async () => {
      try {
        const response = await fetch("/api/dashboard", { credentials: "include" });
        const payload = (await response.json()) as LeadDashboardPayload & { error?: string };
        if (!response.ok || !payload.lead) throw new Error(payload.error || "Unable to load dashboard");
        if (!cancelled) setData(payload.lead);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadData();
    return () => { cancelled = true; };
  }, []);

  const events = data?.events ?? [];
  const pendingApplications = data?.pendingApplications ?? [];
  const departmentMembers = data?.departmentMemberCounts ?? {};
  // The server already restricts this payload to the lead's own event pipeline.
  const myEvents = events;
  const draftEvents = events.filter((event) => event.status === "draft");
  const reviewEvents = events.filter((event) => event.status === "review");
  const publishedEvents = events.filter((event) =>
    ["approved", "published", "active"].includes(event.status),
  );

  const getDepartmentName = (deptId: string) => {
    return allDepartments.find((d) => d.$id === deptId)?.name || "Unknown";
  };

  const getDepartmentColor = (deptId: string) => {
    return allDepartments.find((d) => d.$id === deptId)?.color || "#8b5cf6";
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-surface-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-surface-secondary rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-surface-secondary rounded-2xl animate-pulse" />
          <div className="h-64 bg-surface-secondary rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Lead dashboard unavailable</h1>
        <p className="text-muted mt-2">{error || "The server did not return a lead view."}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">Lead Dashboard</h1>
          <p className="text-muted">
            Manage your departments and oversee event pipeline.
          </p>
        </div>
        {canDraftEvents && (
          <Link
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-primary-foreground text-sm font-medium transition-opacity"
            href="/admin/events/create"
          >
            <Plus className="w-4 h-4" />
            New Event
          </Link>
        )}
      </div>

      {/* Department Overview */}
      <MyPowersCard />
      {leadDepartments.length === 0 ? (
        <div className="rounded-2xl border border-border bg-surface p-8 text-center">
          <Users className="w-10 h-10 text-muted mx-auto mb-3" />
          <p className="text-sm text-muted">No department leadership assigned yet.</p>
          <p className="text-xs text-muted mt-1">Your event pipeline below is still available.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leadDepartments.map((ud) => {
          const dept = allDepartments.find((d) => d.$id === ud.departmentId);

          if (!dept) return null;

          return (
            <div
              key={ud.$id}
              className="rounded-2xl border border-border bg-surface p-5"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                    style={{ backgroundColor: `${dept.color || "#8b5cf6"}20` }}
                  >
                    <LayoutDashboard
                      className="w-5 h-5"
                      style={{ color: dept.color || "#8b5cf6" }}
                    />
                  </div>
                  <div>
                    <h3 className="font-semibold">{dept.name}</h3>
                    <p className="text-xs text-muted capitalize">
                      {dept.category}
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-xs rounded-full bg-muted text-primary border border-border">
                  Lead
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-2xl font-bold">
                    {departmentMembers[ud.departmentId] || 0}
                  </p>
                  <p className="text-xs text-muted">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.length}
                  </p>
                  <p className="text-xs text-muted">Pipeline events</p>
                </div>
              </div>
              <Link
                className="mt-4 flex items-center gap-1 text-sm text-primary hover:opacity-90 transition-colors"
                href="/admin/departments"
              >
                Manage Department <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Pipeline */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Event Pipeline</h2>
            <Link
              className="text-sm text-primary hover:opacity-90 flex items-center gap-1"
              href="/events"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Pipeline Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-surface-secondary">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted" />
                <span className="text-sm text-muted">Drafts</span>
              </div>
              <p className="text-xl font-bold mt-1">{draftEvents.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/10">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">Pending Review</span>
              </div>
              <p className="text-xl font-bold mt-1">{reviewEvents.length}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Published</span>
              </div>
              <p className="text-xl font-bold mt-1">{publishedEvents.length}</p>
            </div>
          </div>

          {/* Draft Events */}
          {draftEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted mb-2">
                Your Drafts
              </h3>
              {draftEvents.slice(0, 5).map((event) => (
                <div
                  key={event.$id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-surface-secondary transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-surface-secondary flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-muted" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {event.title}
                    </h4>
                    <p className="text-xs text-muted mt-0.5">
                      {new Date(event.date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      • {event.venue}
                    </p>
                  </div>
                  <Link
                    className="text-muted hover:text-muted"
                    href="/admin/events"
                    aria-label={`Manage ${event.title} in the event console`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Pending Approvals */}
          {reviewEvents.length > 0 && (
            <div className="space-y-2 mt-6">
              <h3 className="text-sm font-medium text-amber-400 mb-2">
                Pending Approvals
              </h3>
              {reviewEvents.slice(0, 5).map((event) => (
                <div
                  key={event.$id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">
                      {event.title}
                    </h4>
                    <p className="text-xs text-muted mt-0.5">
                      Submitted by {event.organizerName}
                    </p>
                  </div>
                  <Link
                    className="text-amber-400 hover:text-amber-300"
                    href={`/events/${event.$id}`}
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {draftEvents.length === 0 && reviewEvents.length === 0 && (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 text-muted mx-auto mb-3" />
              <p className="text-sm text-muted">No events in pipeline</p>
            </div>
          )}
        </div>

        {/* Team & Applications Sidebar */}
        <div className="space-y-6">
          {/* Pending Applications */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Applications</h2>
              {canManageTeam && (
                <Link
                  className="text-sm text-primary hover:opacity-90 flex items-center gap-1"
                  href="/admin/membership"
                >
                  Review <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            {pendingApplications.length > 0 ? (
              <div className="space-y-3">
                {pendingApplications.slice(0, 5).map((app) => (
                  <div
                    key={app.$id}
                    className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                  >
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        New Application
                      </p>
                      <p className="text-xs text-muted">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm text-muted">All caught up!</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-border bg-surface p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                {
                  label: "Create Event",
                  href: "/admin/events/create",
                  icon: Plus,
                  show: canDraftEvents,
                },
                {
                  label: "Manage Team",
                  href: "/admin/departments",
                  icon: Users,
                  show: canManageTeam,
                },
                {
                  label: "Department Resources",
                  href: "/resources",
                  icon: FolderOpen,
                  show: true,
                },
              ]
                .filter((a) => a.show)
                .map((action) => {
                  const Icon = action.icon;

                  return (
                    <Link
                      key={action.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-surface-secondary transition-colors group"
                      href={action.href}
                    >
                      <Icon className="w-4 h-4 text-muted group-hover:text-primary transition-colors" />
                      <span className="text-sm group-hover:text-foreground transition-colors">
                        {action.label}
                      </span>
                      <ChevronRight className="w-4 h-4 text-muted group-hover:text-muted ml-auto transition-colors" />
                    </Link>
                  );
                })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
