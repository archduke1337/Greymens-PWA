"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { eventService, type Event } from "@/lib/database";
import { departmentService, type UserDepartment } from "@/lib/departments";
import { applicationService, type Application } from "@/lib/applications";
import {
  LayoutDashboard,
  Calendar,
  Users,
  ClipboardCheck,
  ChevronRight,
  FileText,
  Clock,
  AlertCircle,
  CheckCircle,
  Plus,
  ArrowUpRight,
  FolderOpen,
} from "lucide-react";

export default function LeadDashboard() {
  const { user } = useAuth();
  const { userDepartments, userDesignations, allDepartments, hasPermission } = usePermissions();

  const [events, setEvents] = useState<Event[]>([]);
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [departmentMembers, setDepartmentMembers] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const leadDepartments = userDepartments.filter((ud) => ud.role === "lead");
  const leadDepartmentIds = leadDepartments.map((ud) => ud.departmentId);

  const loadData = useCallback(async () => {
    try {
      const [allEvents, pendingApps] = await Promise.all([
        eventService.getAllEvents(),
        applicationService.getPending(),
      ]);

      setEvents(allEvents);
      setPendingApplications(pendingApps);

      // Load member counts for lead departments
      const memberCounts: Record<string, number> = {};
      for (const deptId of leadDepartmentIds) {
        try {
          const members = await departmentService.getDepartmentMembers(deptId);
          memberCounts[deptId] = members.length;
        } catch {
          memberCounts[deptId] = 0;
        }
      }
      setDepartmentMembers(memberCounts);
    } catch (err) {
      console.error("Error loading lead dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, [leadDepartmentIds]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const myEvents = events.filter((e) => leadDepartmentIds.some(() => e.ownerId === user?.$id));
  const draftEvents = events.filter((e) => e.status === "draft" && e.ownerId === user?.$id);
  const reviewEvents = events.filter((e) => e.status === "review");
  const publishedEvents = events.filter((e) => ["approved", "published", "active"].includes(e.status));

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
          <div className="h-9 w-64 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-zinc-800 rounded-2xl animate-pulse" />
          <div className="h-64 bg-zinc-800 rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight">
            Lead Dashboard
          </h1>
          <p className="text-zinc-400">
            Manage your departments and oversee event pipeline.
          </p>
        </div>
        {hasPermission("draft_events") && (
          <Link
            href="/events/new"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-medium transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Event
          </Link>
        )}
      </div>

      {/* Department Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {leadDepartments.map((ud) => {
          const dept = allDepartments.find((d) => d.$id === ud.departmentId);
          if (!dept) return null;
          return (
            <div
              key={ud.$id}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-5"
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
                    <p className="text-xs text-zinc-500 capitalize">{dept.category}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 text-xs rounded-full bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  Lead
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <p className="text-2xl font-bold">{departmentMembers[ud.departmentId] || 0}</p>
                  <p className="text-xs text-zinc-500">Members</p>
                </div>
                <div>
                  <p className="text-2xl font-bold">
                    {events.filter((e) => e.ownerId === user?.$id).length}
                  </p>
                  <p className="text-xs text-zinc-500">Events</p>
                </div>
              </div>
              <Link
                href={`/admin/departments/${dept.slug}`}
                className="mt-4 flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300 transition-colors"
              >
                Manage Department <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Pipeline */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Event Pipeline</h2>
            <Link href="/events" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Pipeline Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-3 rounded-lg bg-zinc-800/50">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-zinc-400" />
                <span className="text-sm text-zinc-400">Drafts</span>
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
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Your Drafts</h3>
              {draftEvents.slice(0, 5).map((event) => (
                <div
                  key={event.$id}
                  className="flex items-center gap-4 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <FileText className="w-4 h-4 text-zinc-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{event.title}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      {new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })} • {event.venue}
                    </p>
                  </div>
                  <Link href={`/events/${event.$id}/edit`} className="text-zinc-500 hover:text-zinc-300">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {/* Pending Approvals */}
          {reviewEvents.length > 0 && (
            <div className="space-y-2 mt-6">
              <h3 className="text-sm font-medium text-amber-400 mb-2">Pending Approvals</h3>
              {reviewEvents.slice(0, 5).map((event) => (
                <div
                  key={event.$id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{event.title}</h4>
                    <p className="text-xs text-zinc-500 mt-0.5">
                      Submitted by {event.organizerName}
                    </p>
                  </div>
                  <Link href={`/events/${event.$id}`} className="text-amber-400 hover:text-amber-300">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {draftEvents.length === 0 && reviewEvents.length === 0 && (
            <div className="text-center py-8">
              <FolderOpen className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No events in pipeline</p>
            </div>
          )}
        </div>

        {/* Team & Applications Sidebar */}
        <div className="space-y-6">
          {/* Pending Applications */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Applications</h2>
              {hasPermission("manage_department_team") && (
                <Link href="/admin/applications" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
                  Review <ChevronRight className="w-4 h-4" />
                </Link>
              )}
            </div>
            {pendingApplications.length > 0 ? (
              <div className="space-y-3">
                {pendingApplications.slice(0, 5).map((app) => (
                  <div key={app.$id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <Users className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">New Application</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">All caught up!</p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
            <div className="space-y-2">
              {[
                { label: "Create Event", href: "/events/new", icon: Plus, show: hasPermission("draft_events") },
                { label: "Manage Team", href: "/admin/team", icon: Users, show: hasPermission("manage_department_team") },
                { label: "Department Resources", href: "/resources", icon: FolderOpen, show: true },
                { label: "View Reports", href: "/admin/reports", icon: LayoutDashboard, show: hasPermission("view_reports") },
              ]
                .filter((a) => a.show)
                .map((action) => {
                  const Icon = action.icon;
                  return (
                    <Link
                      key={action.href}
                      href={action.href}
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                    >
                      <Icon className="w-4 h-4 text-zinc-500 group-hover:text-purple-400 transition-colors" />
                      <span className="text-sm group-hover:text-white transition-colors">{action.label}</span>
                      <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500 ml-auto transition-colors" />
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
