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
  Shapes,
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
 *
 * Exported for the navbar so the console link uses the same section list
 * instead of a second, drifting copy of "who counts as admin".
 */
/**
 * Section visibility against the new-vocabulary capability check. Most
 * sections need one capability; merged consoles (Positions) need any of
 * several — a single-cap check would hide them from half their managers.
 */
export function sectionMatches(
  hasCapability: (capability: string) => boolean,
  cap: string | string[],
): boolean {
  return Array.isArray(cap)
    ? cap.some((entry) => hasCapability(entry))
    : hasCapability(cap);
}

export const ADMIN_SECTIONS = [  {
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
  {
    label: "Event Types",
    href: "/admin/event-types",
    Icon: Shapes,
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
    // Offices and designations merged into one console: visible when the
    // caller holds either capability. A single cap here would hide the page
    // from half its entitled managers.
    label: "Positions",
    href: "/admin/positions",
    Icon: Landmark,
    cap: ["governance.manage_offices", "designations.assign"],
  },
  {
    label: "Powers",
    href: "/admin/powers",
    Icon: KeyRound,
    cap: "powers.manage",
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
  const { status, hasCapability, loading: permLoading } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [admitted, setAdmitted] = useState<boolean | null>(null);
  const [bootstrapOnly, setBootstrapOnly] = useState(false);

  useEffect(() => {
    // Settle once: recomputing on every permission-context refresh would
    // re-fire the admin-check fallback and bounce the shell.
    if (admitted !== null) return;
    if (!loading && !permLoading) {
      if (!user) {
        router.push("/login");

        return;
      }

      // Option B admission: any server-resolved capability granting at least
      // one section, or admin tier ("*" covers everything). This must use
      // hasCapability (new vocabulary), not hasPermission (legacy): office
      // holders kept valid grants but were bounced here because the legacy
      // check knew none of the section capabilities.
      // Fall back to server admin-check for bootstrap ADMIN_EMAILS.
      const visible = ADMIN_SECTIONS.some((s) => sectionMatches(hasCapability, s.cap));

      if (status === "admin" || status === "dev" || visible) {
        setAdmitted(true);

        return;
      }

      // Fall back to the server check for email-allowlisted administrators.
      // The server resolves the identity from the session, not from this body.
      // Note the limit of this path: ADMIN_EMAILS only satisfies isAdminUser /
      // requireAdmin. Capability routes (requireCapability) need a real
      // user_roles row — see the bootstrap notice below.
      fetch("/api/admin-check", {
        method: "POST",
        credentials: "include",
      })
        .then((res) => res.json())
        .then((data) => {
          if (!data.isAdmin) {
            router.push("/unauthorized");
          } else {
            setBootstrapOnly(true);
            setAdmitted(true);
          }
        })
        .catch(() => {
          router.push("/unauthorized");
        });
    }
  }, [user, loading, permLoading, router, status, hasCapability, admitted]);

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

  const visibleSections = ADMIN_SECTIONS.filter((s) => sectionMatches(hasCapability, s.cap));

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
      <main className="flex-1 overflow-auto">
        {/* Compact section nav for viewports without the sidebar. */}
        <nav aria-label="Admin sections" className="lg:hidden flex gap-2 overflow-x-auto p-3 border-b border-border bg-card sticky top-0 z-10">
          {visibleSections.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs whitespace-nowrap border transition-colors ${
                pathname === section.href
                  ? "bg-primary/10 text-primary border-primary/30 font-medium"
                  : "text-muted-foreground border-border hover:text-foreground"
              }`}
            >
              <section.Icon aria-hidden className="w-3.5 h-3.5 shrink-0" />
              <span>{section.label}</span>
            </Link>
          ))}
        </nav>
        {/* Bootstrap escape hatch: ADMIN_EMAILS admits to the shell, but
            capability APIs need a real user_roles row. Say so plainly instead
            of rendering an empty console whose every screen 403s. */}
        {bootstrapOnly && visibleSections.length === 0 && (
          <div className="m-4 md:m-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="font-semibold text-amber-200">Finish the admin setup</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Your account is recognised as a bootstrap administrator, but it has
              no governance role yet, so the admin APIs will refuse it. Create one
              with the bootstrap script, then reload:
            </p>
            <code className="block mt-3 text-xs font-mono bg-black/30 rounded-lg p-3 overflow-x-auto">
              npm run grant-admin -- you@example.com --role admin
            </code>
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
