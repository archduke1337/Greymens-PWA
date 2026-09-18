"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import ApplicantDashboard from "@/components/dashboards/ApplicantDashboard";
import MemberDashboard from "@/components/dashboards/MemberDashboard";
import LeadDashboard from "@/components/dashboards/LeadDashboard";
import HeadDashboard from "@/components/dashboards/HeadDashboard";
import AdminDashboard from "@/components/dashboards/AdminDashboard";

/**
 * Dashboard selection.
 *
 * Which view a member gets used to follow the `lead` / `head` status tier, and
 * that tier was derived from designation levels — so a badge picked a dashboard.
 * The tier lift is gone (see `resolveMembershipStatus`), which would have left
 * the lead and head views unreachable, so selection is now capability-based and
 * mirrors `/api/dashboard`.
 *
 * The server decides which view-models to build from the *same* three-capability
 * groups below. Keeping the two in step is the whole point: if they disagree, the
 * client renders a dashboard whose payload was never sent.
 */
export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { status, loading: permLoading, hasCapability } = usePermissions();
  const router = useRouter();

  const canLead =
    hasCapability("events.create") ||
    hasCapability("membership.view_applications") ||
    hasCapability("departments.view");
  const canGovern =
    hasCapability("governance.manage") ||
    hasCapability("audit.view") ||
    hasCapability("users.view");

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
  }, [user, authLoading, router]);

  if (authLoading || permLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div className="text-center space-y-4">
          <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Restricted accounts get a 403 from the dashboard API — never render the
  // applicant funnel for them.
  if (status === "banned" || status === "suspended" || status === "deactivated") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Account Restricted</h1>
        <p className="text-muted">
          Your account is currently {status}. Access to the dashboard is
          unavailable. If you believe this is a mistake, please contact support.
        </p>
      </div>
    );
  }

  if (status === "admin" || status === "dev") return <AdminDashboard />;

  // No membership yet: the applicant funnel, and no capabilities to route on.
  if (
    status === "applicant" ||
    status === "account" ||
    status === "no_account"
  ) {
    return <ApplicantDashboard />;
  }

  if (canGovern) return <HeadDashboard />;
  if (canLead) return <LeadDashboard />;

  return <MemberDashboard />;
}
