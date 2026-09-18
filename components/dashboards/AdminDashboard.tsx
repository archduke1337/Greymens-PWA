"use client";

import type { Application, Department } from "@/lib/types";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card, CardContent, Chip, ProgressBar } from "@heroui/react";
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

import { readApiError } from "@/lib/errorHandler";

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
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/dashboard", {
          credentials: "include",
        });
        const payload = (await response.json()) as AdminDashboardPayload & {
          error?: string;
        };

        if (!response.ok || !payload.admin)
          throw new Error(readApiError(payload, "Unable to load dashboard"));
        if (!cancelled) setData(payload.admin);
      } catch (loadError) {
        if (!cancelled)
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Unable to load dashboard",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadData();

    return () => {
      cancelled = true;
    };
  }, [retryKey]);

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
  const totalUsers =
    membershipStats.active + membershipStats.inactive + membershipStats.banned;
  const totalEvents = events.length;
  const activeEvents = events.filter((event) =>
    ["approved", "published", "active"].includes(String(event.status)),
  );
  const draftEvents = events.filter((event) => event.status === "draft");
  const reviewEvents = events.filter((event) => event.status === "review");

  const stats = [
    {
      label: "Total Users",
      value: totalUsers,
      icon: Users,
      tile: "bg-accent/10 text-accent",
      sub: `${membershipStats.active} active members`,
    },
    {
      label: "Total Events",
      value: totalEvents,
      icon: Calendar,
      tile: "bg-default/10 text-foreground",
      sub: `${activeEvents.length} active`,
    },
    {
      label: "Pending Applications",
      value: applicationStats.pending,
      icon: ClipboardCheck,
      tile: "bg-warning/10 text-warning",
      sub: "Awaiting review",
    },
    {
      label: "Active Members",
      value: membershipStats.active,
      icon: Ticket,
      tile: "bg-success/10 text-success",
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
      label: "Position Management",
      href: "/admin/positions",
      icon: Shield,
      description: "Manage offices and designations",
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
          <div className="h-9 w-64 bg-surface-secondary rounded-lg animate-pulse" />
          <div className="h-4 w-80 bg-surface-secondary rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-surface-secondary rounded-xl animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-12 text-center space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard unavailable</h1>
        <p className="text-muted mt-2">
          {error || "The server did not return a management view."}
        </p>
        <p className="text-muted text-sm">
          If this keeps happening, sign out and back in — a stale session is the
          most common cause.
        </p>
        <div>
          <Button
            variant="secondary"
            onPress={() => setRetryKey((key) => key + 1)}
          >
            Try again
          </Button>
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
            <Chip color="danger" size="sm" variant="soft">
              Admin
            </Chip>
          </div>
          <p className="text-muted">
            System overview and administrative controls.
          </p>
        </div>
      </div>

      {/* System Overview Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;

          return (
            <Card key={stat.label}>
              <CardContent className="space-y-3 p-5">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`flex h-9 w-9 items-center justify-center rounded-xl ${stat.tile}`}
                  >
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <span className="text-2xl font-bold tabular-nums">
                    {stat.value}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium">{stat.label}</p>
                  <p className="mt-0.5 text-xs text-muted">{stat.sub}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Membership Queue Quick View */}
        <Card className="lg:col-span-2">
          <CardContent className="p-6">
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
              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4">
                <div className="flex items-center gap-2">
                  <Clock aria-hidden="true" className="size-4 text-warning" />
                  <span className="text-sm text-warning">Pending</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {applicationStats.pending}
                </p>
              </div>
              <div className="rounded-xl border border-success/20 bg-success/5 p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle
                    aria-hidden="true"
                    className="size-4 text-success"
                  />
                  <span className="text-sm text-success">Approved</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {applicationStats.approved}
                </p>
              </div>
              <div className="rounded-xl border border-danger/20 bg-danger/5 p-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    aria-hidden="true"
                    className="size-4 text-danger"
                  />
                  <span className="text-sm text-danger">Rejected</span>
                </div>
                <p className="mt-1 text-2xl font-bold tabular-nums">
                  {applicationStats.rejected}
                </p>
              </div>
            </div>

            {/* Pending Applications List */}
            {pendingApplications.length > 0 ? (
              <div className="space-y-2">
                <h3 className="text-sm font-medium text-muted mb-2">
                  Recent Applications
                </h3>
                {pendingApplications.slice(0, 5).map((app) => (
                  <div
                    key={app.$id}
                    className="flex items-center gap-4 p-3 rounded-xl border border-warning/10 bg-warning/5"
                  >
                    <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center flex-shrink-0">
                      <ClipboardCheck
                        aria-hidden="true"
                        className="size-4 text-warning"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm">
                        Application #{app.$id?.slice(-6)}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-muted mt-0.5">
                        <span>
                          Submitted{" "}
                          {new Date(app.submittedAt).toLocaleDateString()}
                        </span>
                        {app.preferredDepartments &&
                          app.preferredDepartments.length > 0 && (
                            <>
                              <span>•</span>
                              <span className="truncate">
                                {app.preferredDepartments.join(", ")}
                              </span>
                            </>
                          )}
                      </div>
                    </div>
                    <Link
                      aria-label={`Review application ${app.$id?.slice(-6)}`}
                      className="text-warning hover:opacity-80 shrink-0"
                      href="/admin/membership"
                    >
                      <ArrowUpRight className="w-4 h-4" />
                    </Link>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CheckCircle
                  aria-hidden="true"
                  className="w-10 h-10 text-success/50 mx-auto mb-3"
                />
                <p className="text-sm text-muted">No pending applications</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Event Pipeline */}
        <Card>
          <CardContent className="p-6">
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
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-surface-secondary transition-colors group"
                  href={stage.href}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                    <span className="text-sm group-hover:text-foreground transition-colors">
                      {stage.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{stage.count}</span>
                    <ChevronRight className="w-4 h-4 text-muted group-hover:text-muted" />
                  </div>
                </Link>
              ))}
            </div>

            {/* Department Overview */}
            <div className="mt-6 pt-6 border-t border-border">
              <h3 className="text-sm font-medium text-muted mb-3">
                Departments
              </h3>
              <div className="space-y-2">
                {departments.slice(0, 4).map((dept) => (
                  <Link
                    key={dept.$id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-secondary transition-colors group"
                    href={`/admin/departments/${dept.slug}`}
                  >
                    <div
                      className="w-6 h-6 rounded flex items-center justify-center"
                      style={{
                        backgroundColor: `${dept.color || "#8b5cf6"}20`,
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: dept.color || "#8b5cf6" }}
                      />
                    </div>
                    <span className="text-sm truncate group-hover:text-foreground transition-colors">
                      {dept.name}
                    </span>
                    <ChevronRight className="w-3 h-3 text-muted ml-auto" />
                  </Link>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick links to the console sections */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Console sections</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {adminSections.map((section) => {
            const Icon = section.icon;

            return (
              <Link
                key={section.href}
                className="group rounded-2xl border border-border bg-surface p-5 transition-all duration-200 hover:border-primary/40 hover:bg-surface-secondary"
                href={section.href}
              >
                <div className="flex items-start justify-between">
                  <Icon className="w-5 h-5 text-primary" />
                  <ArrowUpRight className="w-4 h-4 text-muted group-hover:text-muted group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                </div>
                <h3 className="font-medium mt-3 group-hover:text-foreground transition-colors">
                  {section.label}
                </h3>
                <p className="text-xs text-muted mt-1">{section.description}</p>
              </Link>
            );
          })}
        </div>
      </div>

      {/* System Health */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity aria-hidden="true" className="size-5 text-success" />
            <h2 className="text-lg font-semibold">System Health</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              {
                label: "Active Members",
                value: membershipStats.active,
                total: totalUsers,
              },
              {
                label: "Active Events",
                value: activeEvents.length,
                total: totalEvents,
              },
              {
                label: "Departments",
                value: departments.length,
                total: departments.length,
              },
              {
                label: "Application Rate",
                value: applicationStats.approved,
                total: applicationStats.approved + applicationStats.rejected,
              },
            ].map((item) => {
              const percent =
                item.total > 0
                  ? Math.round((item.value / item.total) * 100)
                  : 0;

              return (
                <div key={item.label} className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted">{item.label}</span>
                    <span className="font-medium tabular-nums">
                      {item.value}/{item.total}
                    </span>
                  </div>
                  <ProgressBar
                    aria-label={`${item.label}: ${percent} percent`}
                    value={percent}
                  >
                    <ProgressBar.Track>
                      <ProgressBar.Fill />
                    </ProgressBar.Track>
                  </ProgressBar>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
