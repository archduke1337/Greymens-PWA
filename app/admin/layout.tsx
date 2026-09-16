"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UserCog,
  Building2,
  Award,
  KeyRound,
  Landmark,
  FileText,
  FolderOpen,
  Image,
  Rocket,
  Handshake,
  Bell,
  ShieldCheck,
  ScrollText,
  ClipboardList,
  ArrowLeft,
} from "lucide-react";

import { usePermissions } from "@/context/PermissionContext";
import { useAuth } from "@/context/AuthContext";

/**
 * Every admin area that exists as a route, gated by capability (presentation only).
 *
 * Server enforces via requireCapability() — admin passes every check via "*"
 * wildcard, so admin sees all sections. Non-admin office holders see only
 * sections their offices grant. Hiding is not access control: each page fails
 * closed on its first API request.
 */
const ADMIN_SECTIONS = [
  {
    label: "Dashboard",
    href: "/admin",
    Icon: LayoutDashboard,
    cap: "governance.manage",
  },
  {
    label: "Membership",
    href: "/admin/membership",
    Icon: Users,
    cap: "membership.view_applications",
  },
  {
    label: "Events",
    href: "/admin/events",
    Icon: CalendarDays,
    cap: "events.manage",
  },
  { label: "Users", href: "/admin/users", Icon: UserCog, cap: "users.view" },
  {
    label: "Departments",
    href: "/admin/departments",
    Icon: Building2,
    cap: "departments.manage",
  },
  {
    label: "Designations",
    href: "/admin/designations",
    Icon: Award,
    cap: "designations.assign",
  },
  {
    label: "Powers",
    href: "/admin/powers",
    Icon: KeyRound,
    cap: "powers.manage",
  },
  {
    label: "Offices",
    href: "/admin/offices",
    Icon: Landmark,
    cap: "governance.manage_offices",
  },
  { label: "Blogs", href: "/admin/blog", Icon: FileText, cap: "blog.review" },
  {
    label: "Resources",
    href: "/admin/resources",
    Icon: FolderOpen,
    cap: "resources.manage",
  },
  {
    label: "Gallery",
    href: "/admin/gallery",
    Icon: Image,
    cap: "gallery.manage",
  },
  {
    label: "Projects",
    href: "/admin/projects",
    Icon: Rocket,
    cap: "projects.manage",
  },
  {
    label: "Sponsors",
    href: "/admin/sponsors",
    Icon: Handshake,
    cap: "sponsors.manage",
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    Icon: Bell,
    cap: "notifications.send",
  },
  {
    label: "Access",
    href: "/admin/access",
    Icon: ShieldCheck,
    cap: "access.assign_roles",
  },
  {
    label: "Governance",
    href: "/admin/governance",
    Icon: ScrollText,
    cap: "governance.manage",
  },
  {
    label: "Audit Log",
    href: "/admin/audit",
    Icon: ClipboardList,
    cap: "audit.view",
  },
];

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const { status, hasPermission, loading: permLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [admitted, setAdmitted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!loading && !permLoading) {
      if (!user) {
        router.push("/login");

        return;
      }

      // Option B admission: any capability granting at least one section, or
      // admin tier (admin has "*" so hasPermission passes everything).
      // Fall back to server admin-check for bootstrap ADMIN_EMAILS.
      const visible = ADMIN_SECTIONS.some((s) => hasPermission(s.cap));

      if (status === "admin" || status === "dev" || visible) {
        setAdmitted(true);

        return;
      }

      // Fall back to the server check for email-allowlisted administrators.
      // The server resolves the identity from the session, not from this body.
      fetch("/api/admin-check", {
        method: "POST",
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.isAdmin) {
            router.push("/unauthorized");
          } else {
            setAdmitted(true);
          }
        })
        .catch(() => {
          router.push("/unauthorized");
        });
    }
  }, [user, loading, permLoading, router, status, hasPermission]);

  if (loading || permLoading || admitted === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center space-y-4">
          <div
            aria-label="Verifying access"
            className="inline-block h-10 w-10 animate-spin rounded-full border-4 border-muted border-t-primary"
            role="status"
          />
          <p className="text-default-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  const visibleSections = ADMIN_SECTIONS.filter((s) => hasPermission(s.cap));

  return (
    <div className="flex min-h-screen">
      {/* Admin Sidebar */}
      <aside className="w-64 bg-card border-r border-border p-4 hidden lg:block">
        <div className="mb-6">
          <h2 className="text-lg font-bold">Admin Panel</h2>
          <p className="text-sm text-muted-foreground">Club Management</p>
        </div>
        <nav className="space-y-1">
          {visibleSections.map((section) => (
            <Link
              key={section.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === section.href
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
              href={section.href}
            >
              <section.Icon aria-hidden className="w-4 h-4 shrink-0" />
              <span>{section.label}</span>
            </Link>
          ))}
        </nav>
        <div className="mt-6 pt-6 border-t border-border">
          <Link
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            href="/dashboard"
          >
            <ArrowLeft aria-hidden className="w-4 h-4 shrink-0" />
            <span>Back to Dashboard</span>
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  );
}
