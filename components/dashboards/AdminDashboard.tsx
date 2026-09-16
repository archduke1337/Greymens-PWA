"use client";

import type { Application, Department } from "@/lib/types";
import { useEffect, useState } from "react";
import Link from "next/link";
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
  FileText,
} from "lucide-react";


export default function AdminDashboard() {
  type AdminDashboardPayload = {
    admin?: {
      stats: {
        activeMembers: number;
        inactiveMembers: number;
        bannedMembers: number;
        pendingApplications: number;
        approvedApplications: number;
        rejectedApplications: number;
      };
      departments: Department[];
      events: Array<Record<string, unknown>>;
      pendingApplications: Application[];
    };
  };

  const [data, setData] = useState<AdminDashboardPayload["admin"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      try {
        const response = await fetch("/api/dashboard", { credentials: "include" });
        const payload = (await response.json()) as AdminDashboardPayload & { error?: string };
        if (!response.ok || !payload.admin) throw new Error(payload.error || "Unable to load dashboard");
        if (!cancelled) setData(payload.admin);
      } catch (loadError) {
        if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Unable to load dashboard");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();
    return () => {
      cancelled = true;
    };
  }, []);

  const membershipStats = {
    active: data?.stats.activeMembers ?? 0,
    inactive: data?.stats.inactiveMembers ?? 0,
    banned: data?.stats.bannedMembers ?? 0,
  };
  const applicationStats = {
    pending: data?.stats.pendingApplications ?? 0,
    approved: data?.stats.approvedApplications ?? 0,
    rejected: data?.stats.rejectedApplications ?? 0,
  };
  const departments = data?.departments ?? [];
  const events = data?.events ?? [];
  const pendingApplications = data?.pendingApplications ?? [];
  const totalUsers = membershipStats.active + membershipStats.inactive + membershipStats.banned;
  const totalEvents = events.length;
  const activeEvents = events.filter((event) => ["approved", "published", "active"].includes(String(event.status)));
  const draftEvents = events.filter((event) => event.status === "draft");
  const reviewEvents = events.filter((event) => event.status === "review");

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      color: "text-primary",
      sub: `${membershipStats.active} active members`,
    },
    {
      label: "Total Events",
      value: totalEvents,
      icon: Calendar,
      color: "text-blue-400",
      sub: `${activeEvents.length} active`,
    },
    {
      label: "Pending Applications",
      value: applicationStats.pending,
      icon: ClipboardCheck,
      color: "text-amber-400",
      sub: "Awaiting review",
    },
    {
      label: "Active Members",
      value: membershipStats.active,
      icon: Ticket,
      color: "text-emerald-400",
      sub: "Active memberships",
    },
  ];

  const adminSections = [
    {
      label: "User Management",
      href: "/admin/users",
      icon: Users,
      description: "Manage all users and roles",
    },
    {
      label: "Event Management",
      href: "/admin/events",
      icon: Calendar,
      description: "Oversee all events",
    },
    {
      label: "Membership Queue",
      href: "/admin/membership",
      icon: ClipboardCheck,
      description: "Review applications",
    },
    {
      label: "Department Settings",
      href: "/admin/departments",
      icon: Settings,
      description: "Configure departments",
    },
    {
      label: "Designation Management",
      href: "/admin/designations",
      icon: Shield,
      description: "Manage designations",
    },
    {
      label: "Audit Logs",
      href: "/admin/audit",
      icon: FileText,
      description: "View system audit trail",
    },
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
            <div
              key={i}
              className="h-28 bg-zinc-800 rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center">
        <h1 className="text-2xl font-semibold">Admin dashboard unavailable</h1>
        <p className="text-zinc-500 mt-2">{error || "The server did not return an admin view."}</p>
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
            <div
              key={stat.label}
              className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
            >
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
            <Link
              className="text-sm text-primary hover:opacity-90 flex items-center gap-1"
              href="/admin/membership"
            >
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
              <p className="text-2xl font-bold mt-1">
                {applicationStats.pending}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="text-sm text-emerald-400">Approved</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {applicationStats.approved}
              </p>
            </div>
            <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400">Rejected</span>
              </div>
              <p className="text-2xl font-bold mt-1">
                {applicationStats.rejected}
              </p>
            </div>
          </div>

          {/* Pending Applications List */}
          {pendingApplications.length > 0 ? (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-zinc-400 mb-2">
                Recent Applications
              </h3>
              {pendingApplications.slice(0, 5).map((app) => (
                <div
                  key={app.$id}
                  className="flex items-center gap-4 p-3 rounded-lg bg-amber-500/5 border border-amber-500/10"
                >
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                    <ClipboardCheck className="w-4 h-4 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-medium text-sm">
                      Application #{app.$id?.slice(-6)}
                    </h4>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 mt-0.5">
                      <span>
                        Submitted{" "}
                        {new Date(app.submittedAt).toLocaleDateString()}
                      </span>
                      {app.preferredDepartments &&
                        app.preferredDepartments.length > 0 && (
                          <>
                            <span>•</span>
                            <span>{app.preferredDepartments.join(", ")}</span>
                          </>
                        )}
                    </div>
                  </div>
                  <Link
                    className="text-amber-400 hover:text-amber-300"
                    href="/admin/membership"
                  >
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
            <Link
              className="text-sm text-primary hover:opacity-90 flex items-center gap-1"
              href="/admin/events"
            >
              View All <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-3">
            {[
              {
                label: "Drafts",
                count: draftEvents.length,
                color: "bg-zinc-500",
                href: "/admin/events?status=draft",
              },
              {
                label: "Pending Review",
                count: reviewEvents.length,
                color: "bg-amber-500",
                href: "/admin/events?status=review",
              },
              {
                label: "Active",
                count: activeEvents.length,
                color: "bg-emerald-500",
                href: "/admin/events?status=active",
              },
            ].map((stage) => (
              <Link
                key={stage.label}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                href={stage.href}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                  <span className="text-sm group-hover:text-white transition-colors">
                    {stage.label}
                  </span>
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
            <h3 className="text-sm font-medium text-zinc-400 mb-3">
              Departments
            </h3>
            <div className="space-y-2">
              {departments.slice(0, 4).map((dept) => (
                <Link
                  key={dept.$id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-zinc-800/50 transition-colors group"
                  href={`/admin/departments/${dept.slug}`}
                >
                  <div
                    className="w-6 h-6 rounded flex items-center justify-center"
                    style={{ backgroundColor: `${dept.color || "#8b5cf6"}20` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full"
                      style={{ backgroundColor: dept.color || "#8b5cf6" }}
                    />
                  </div>
                  <span className="text-sm truncate group-hover:text-white transition-colors">
                    {dept.name}
                  </span>
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
                className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-5 hover:border-zinc-700 hover:bg-zinc-900 transition-all duration-200"
                href={section.href}
              >
                <div className="flex items-start justify-between">
                  <Icon className="w-5 h-5 text-primary" />
                  <ArrowUpRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-400 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <h3 className="font-medium mt-3 group-hover:text-white transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-zinc-500 mt-1">
                  {section.description}
                </p>
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
            {
              label: "Active Members",
              value: membershipStats.active,
              total: totalUsers,
              color: "bg-primary",
            },
            {
              label: "Active Events",
              value: activeEvents.length,
              total: totalEvents,
              color: "bg-emerald-500",
            },
            {
              label: "Departments",
              value: departments.length,
              total: departments.length,
              color: "bg-blue-500",
            },
            {
              label: "Application Rate",
              value: applicationStats.approved,
              total: applicationStats.approved + applicationStats.rejected,
              color: "bg-amber-500",
            },
          ].map((item) => (
            <div key={item.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-zinc-400">{item.label}</span>
                <span className="font-medium">
                  {item.value}/{item.total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full ${item.color} transition-all`}
                  style={{
                    width: `${item.total > 0 ? (item.value / item.total) * 100 : 0}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
