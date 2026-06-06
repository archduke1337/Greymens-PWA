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
          <div className="inline-block w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
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
    case "account":
    default:
      // Users with just an account but no application yet
      return <ApplicantDashboard />;
  }
}
