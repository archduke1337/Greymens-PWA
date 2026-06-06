"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { eventService, type Event } from "@/lib/database";
import { membershipService } from "@/lib/memberships";
import { applicationService, type Application } from "@/lib/applications";
import { departmentService, type Department } from "@/lib/departments";
import { ticketService } from "@/lib/tickets";
import {
  Users,
  Calendar,
  Ticket,
  Activity,
  ChevronRight,
  ClipboardCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowUpRight,
  Settings,
  Shield,
  Database,
  BarChart3,
  FileText,
} from "lucide-react";

export default function AdminDashboard() {
  const { user } = useAuth();

  const [membershipStats, setMembershipStats] = useState({ active: 0, inactive: 0, banned: 0 });
  const [applicationStats, setApplicationStats] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [events, setEvents] = useState<Event[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [pendingApplications, setPendingApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      const [memStats, appStats, allEvents, allDepts, pendingApps] = await Promise.all([
        membershipService.getCount(),
        applicationService.getCount(),
        eventService.getAllEvents(),
        departmentService.getAll(),
        applicationService.getPending(),
      ]);

      setMembershipStats(memStats);
      setApplicationStats(appStats);
      setEvents(allEvents);
      setDepartments(allDepts);
      setPendingApplications(pendingApps);
    } catch (err) {
      console.error("Error loading admin dashboard:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const totalUsers = membershipStats.active + membershipStats.inactive + membershipStats.banned;
  const totalEvents = events.length;
  const activeEvents = events.filter((e) => ["approved", "published", "active"].includes(e.status));
  const draftEvents = events.filter((e) => e.status === "draft");
  const reviewEvents = events.filter((e) => e.status === "review");

  const stats = [
    { label: "Total Users", value: totalUsers, icon: Users, color: "text-purple-400", sub: `${membershipStats.active} active members` },
    { label: "Total Events", value: totalEvents, icon: Calendar, color: "text-blue-400", sub: `${activeEvents.length} active` },
    { label: "Pending Applications", value: applicationStats.pending, icon: ClipboardCheck, color: "text-amber-400", sub: "Awaiting review" },
    { label: "Active Tickets", value: membershipStats.active, icon: Ticket, color: "text-emerald-400", sub: "Issued tickets" },
  ];

  const adminSections = [
    { label: "User Management", href: "/admin/users", icon: Users, description: "Manage all users and roles" },
    { label: "Event Management", href: "/admin/events", icon: Calendar, description: "Oversee all events" },
    { label: "Membership Queue", href: "/admin/applications", icon: ClipboardCheck, description: "Review applications" },
    { label: "Department Settings", href: "/admin/departments", icon: Settings, description: "Configure departments" },
    { label: "Designation Management", href: "/admin/designations", icon: Shield, description: "Manage designations" },
    { label: "Audit Logs", href: "/admin/audit", icon: FileText, description: "View system audit trail" },
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
          <div className="flex items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight">
              Admin Dashboard
            </h1>
            <span className="px-2 py-0.5 text-xs rounded-full bg-red-500/10 text-red-400 border border-red-500/20">
              Admin
            </span>
          </div>
          <p className="text-zinc-400">
            System overview and administrative controls.
          </p>
        </div>
      </div>

      {/* System Overview Stats */}
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
              <p className="text-xs text-zinc-500 mt-1">{stat.sub}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Membership Queue Quick View */}
        <div className="lg:col-span-2 rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Membership Queue</h2>
            <Link href="/admin/applications" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              Manage All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Application Stats */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <div className="p-4 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span className="text-sm text-amber-400">Pending</span>
              </div>
              <p className="text-2xl font-bold mt-1">{applicationStats.pending}</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Approved</span>
              </div>
              <p className="text-2xl font-bold mt-1">{applicationStats.approved}</p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">Rejected</span>
              </div>
              <p className="text-2xl font-bold mt-1">{applicationStats.rejected}</p>
            </div>
          </div>

          {/* Pending Applications List */}
          {pendingApplications.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">Recent Applications</h3>
              {pendingApplications.slice(0, 5).map((app) => (
                <div
                  key={app.$id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">Application #{app.$id?.slice(-6)}</h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>Submitted {new Date(app.submittedAt).toLocaleDateString()}</span>
                      {app.preferredDepartments && app.preferredDepartments.length > 0 && (
                        <>
                          <span>•</span>
                          <span>{app.preferredDepartments.join(", ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <Link href={`/admin/applications?highlight=${app.$id}`} className="text-amber-400 hover:text-amber-300">
                    <ArrowUpRight className="w-4 h-4" />
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <CheckCircle className="w-10 h-10 text-emerald-500/50 mx-auto mb-3" />
              <p className="text-sm text-zinc-500">No pending applications</p>
            </div>
          )}
        </div>

        {/* Event Pipeline */}
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Event Pipeline</h2>
            <Link href="/admin/events" className="text-sm text-purple-400 hover:text-purple-300 flex items-center gap-1">
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {[
              { label: "Drafts", count: draftEvents.length, color: "bg-zinc-500", href: "/admin/events?status=draft" },
              { label: "Pending Review", count: reviewEvents.length, color: "bg-amber-500", href: "/admin/events?status=review" },
              { label: "Active", count: activeEvents.length, color: "bg-emerald-500", href: "/admin/events?status=active" },
            ].map((stage) => (
              <Link
                key={stage.label}
                href={stage.href}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-sm group-hover:text-white transition-colors">{stage.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold">{stage.count}</span>
                  <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-zinc-500" />
                </div>
              </Link>
            ))}
          </div>

          {/* Department Overview */}
          <div className="mt-6 pt-6 border-t border-zinc-800">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Departments</h3>
            <div className="space-y-2">
              {departments.slice(0, 4).map((dept) => (
                <Link
                  key={dept.$id}
                  href={`/admin/departments/${dept.slug}`}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${dept.color || "#8b5cf6"}20` }}
                  >
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: dept.color || "#8b5cf6" }} />
                  </div>
                  <span className="text-sm truncate group-hover:text-white transition-colors">{dept.name}</span>
                  <ChevronRight className="w-3 h-3 text-zinc-700 ml-auto" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Links to Admin Sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Admin Sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.href}
                href={section.href}
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200"
              >
                <div className="flex items-start justify-between">
                  <Icon className="w-5 h-5 text-purple-400" />
                  <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <h3 className="font-medium mt-3 group-hover:text-white transition-colors">{section.label}</h3>
                <p className="text-xs text-zinc-500 mt-1">{section.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Health */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/50 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-emerald-400" />
          <h2 className="text-lg font-semibold">System Health</h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Active Members", value: membershipStats.active, total: totalUsers, color: "from-purple-500 to-pink-500" },
            { label: "Active Events", value: activeEvents.length, total: totalEvents, color: "from-emerald-500 to-teal-500" },
            { label: "Departments", value: departments.length, total: departments.length, color: "from-blue-500 to-cyan-500" },
            { label: "Application Rate", value: applicationStats.approved, total: applicationStats.approved + applicationStats.rejected, color: "from-amber-500 to-orange-500" },
          ].map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">{item.label}</span>
                <span className="font-medium">{item.value}/{item.total}</span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-gradient-to-r ${item.color} transition-all`}
                  style={{ width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
