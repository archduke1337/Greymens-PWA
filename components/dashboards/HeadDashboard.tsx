"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { eventService, type Event } from "@/lib/database";
import type { Department, UserDepartment } from "@/lib/types";;
import type { Application } from "@/lib/types";;
import { membershipService } from "@/lib/memberships";
import {
  BarChart3,
  Calendar,
  Users,
  ClipboardCheck,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Building2,
  UserPlus,
} from "lucide-react";

export default function HeadDashboard() {
  const { user } = useAuth();
  const { allDepartments, hasPermission } = usePermissions();

  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [membershipStats, setMembershipStats] = useState({ active: 0, inactive: 0, banned: 0 });
  const [departmentMemberCounts, setDepartmentMemberCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [allEvents, allDepts, pendingApps, memStats] = await Promise.all([
        eventService.getAllEvents(),
        departmentService.getAll(),
        applicationService.getPending(),
        membershipService.getCount(),
      ]);

      setEvents(allEvents);
      setDepartments(allDepts);
      setPendingApplications(pendingApps);
      setMembershipStats(memStats);

      // Load member counts for all departments
      const counts: Record<string, number> = {};
      for (const dept of allDepts) {
        try {
          const members = await departmentService.getDepartmentMembers(dept.$id!);
          counts[dept.$id!] = members.length;
        } catch {
          counts[dept.$id!] = 0;
        }
      }
      setDepartmentMemberCounts(counts);
    } catch (err) {
      console.error("Error loading head dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const draftEvents = events.filter((e) => e.status === "draft");
  const reviewEvents = events.filter((e) => e.status === "review");
  const activeEvents = events.filter((e) => ["approved", "published", "active"].includes(e.status));
  const completedEvents = events.filter((e) => e.status === "completed");

  const totalMembers = membershipStats.active + membershipStats.inactive;

  const stats = [
    { label: "Total Members", value: membershipStats.active, icon: Users, color: "text-purple-400", change: `+${membershipStats.active} active` },
    { label: "Pending Applications", value: pendingApplications.length, icon: ClipboardCheck, color: "text-amber-400", change: "Awaiting review" },
    { label: "Active Events", value: activeEvents.length, icon: Calendar, color: "text-emerald-400", change: `${reviewEvents.length} pending` },
    { label: "Departments", value: departments.length, icon: Building2, color: "text-blue-400", change: "All active" },
  ];

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">
        <div className="space-y-2">
          <div className="h-9 w-64 bg-zinc-800 rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-zinc-800 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 bg-zinc-800 rounded-xl animate-pulse" />
          ))}
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
            Operations Overview
          </h1>
          <p className="text-zinc-400">
            Multi-department management and organizational health.
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/admin"
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800 text-sm font-medium transition-colors"
          >
            <BarChart3 className="w-4 h-4" />
            Admin Panel
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
              <div className="flex items-center justify-between">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-2xl font-bold">{stat.value}</span>
              </div>
              <p className="text-sm text-zinc-400 mt-2">{stat.label}</p>
              <p className="text-xs text-zinc-500 mt-1">{stat.change}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Approvals Queue */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Event Approvals Queue</h2>
            <Link href="/admin/events" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Pipeline Overview */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {[
              { label: "Drafts", count: draftEvents.length, color: "bg-zinc-500" },
              { label: "Review", count: reviewEvents.length, color: "bg-amber-500" },
              { label: "Active", count: activeEvents.length, color: "bg-emerald-500" },
              { label: "Completed", count: completedEvents.length, color: "bg-blue-500" },
            ].map((stage) => (
              <div key={stage.label} className="text-center p-3 rounded-lg bg-zinc-800/50">
                <div className={`w-2 h-2 rounded-full ${stage.color} mx-auto mb-2`} />
                <p className="text-lg font-bold">{stage.count}</p>
                <p className="text-xs text-zinc-500">{stage.label}</p>
              </div>
            ))}
          </div>

          {/* Pending Review Events */}
          {reviewEvents.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-amber-400 mb-2">Awaiting Your Approval</h3>
              {reviewEvents.slice(0, 5).map((event) => (
                <div
                  key={event.$id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm truncate">{event.title}</h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>{event.organizerName}</span>
                      <span>•</span>
                      <span>{new Date(event.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                    </div>
                  </div>
                  <Link href={`/events/${event.$id}`} className="text-amber-400 hover:text-amber-300">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          )}

          {reviewEvents.length === 0 && (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">All events reviewed</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Membership Queue */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Membership Queue</h2>
              <Link href="/admin/applications" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
                Review <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            {pendingApplications.length > 0 ? (
              <div className="space-y-3">
                {pendingApplications.slice(0, 5).map((app) => (
                  <div key={app.$id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10">
                    <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                      <UserPlus className="w-4 h-4 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">New Application</p>
                      <p className="text-xs text-zinc-500">
                        Submitted {new Date(app.submittedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-4">
                <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                <p className="text-sm text-zinc-500">No pending applications</p>
              </div>
            )}
          </div>

          {/* Department Health */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Department Health</h2>
            <div className="space-y-3">
              {departments.slice(0, 6).map((dept) => {
                const count = departmentMemberCounts[dept.$id!] || 0;
                const health = count > 5 ? "healthy" : count > 2 ? "moderate" : "needs-attention";
                const healthColors = {
                  healthy: "text-emerald-400",
                  moderate: "text-amber-400",
                  "needs-attention": "text-red-400",
                };
                return (
                  <div key={dept.$id} className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${dept.color || "#8b5cf6"}20` }}
                    >
                      <Building2
                        className="w-4 h-4"
                        style={{ color: dept.color || "#8b5cf6" }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{dept.name}</span>
                        <span className={`text-xs ${healthColors[health]}`}>
                          {count} members
                        </span>
                      </div>
                      <div className="mt-1 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                          style={{ width: `${Math.min((count / 20) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Stats */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
            <h2 className="text-lg font-semibold mb-4">Membership Stats</h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Active Members</span>
                <span className="font-semibold text-emerald-400">{membershipStats.active}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Inactive</span>
                <span className="font-semibold text-zinc-400">{membershipStats.inactive}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-zinc-400">Banned</span>
                <span className="font-semibold text-red-400">{membershipStats.banned}</span>
              </div>
              <div className="pt-3 border-t border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Total</span>
                  <span className="font-bold">{totalMembers}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
