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

export default function DashboardPage() {
  const { user, loading: authLoading } = useAuth();
  const { status, loading: permLoading } = usePermissions();
  const router = useRouter();

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
          <p className="text-zinc-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Route to the appropriate dashboard based on user status
  switch (status) {
    case "admin":
    case "dev":
      return <AdminDashboard />;
    case "head":
      return <HeadDashboard />;
    case "lead":
    case "core_member":
      return <LeadDashboard />;
    case "member":
      return <MemberDashboard />;
    case "applicant":
      return <ApplicantDashboard />;
    case "banned":
    case "suspended":
    case "deactivated":
      // Restricted accounts get a 403 from the dashboard API — never render
      // the applicant funnel for them.
      return (
        <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
          <h1 className="text-2xl font-bold tracking-tight">Account Restricted</h1>
          <p className="text-zinc-400">
            Your account is currently {status}. Access to the dashboard is
            unavailable. If you believe this is a mistake, please contact support.
          </p>
        </div>
      );
    case "account":
    default:
      // Users with just an account but no application yet
      return <ApplicantDashboard />;
  }
}
