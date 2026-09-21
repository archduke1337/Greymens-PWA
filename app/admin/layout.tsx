"use client";
import { useRouter, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  UserCog,
  Building2,
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
  Inbox,
} from "lucide-react";
import { Button, Header, Label, ListBox, Spinner } from "@heroui/react";

import { usePermissions } from "@/context/PermissionContext";
import { useAuth } from "@/context/AuthContext";
import { REVIEW_QUEUES } from "@/lib/capabilities";

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

export const ADMIN_SECTIONS = [
  {
    label: "Dashboard",
    href: "/admin",
    Icon: LayoutDashboard,
    cap: "governance.manage",
  },
  {
    // One screen for "what needs me now?". The capability list is derived from
    // REVIEW_QUEUES so admitting a reviewer here can never disagree with the
    // queue the overview actually shows them.
    label: "Awaiting review",
    href: "/admin/pending",
    Icon: Inbox,
    cap: REVIEW_QUEUES.flatMap((queue) => queue.capabilities),
  },
  {
    label: "Membership",
    href: "/admin/membership",
    Icon: Users,
    cap: "membership.view_applications",
  },
  {
    // Narrow approvers (president/VP approve, cto publishes, coordinators
    // update) hold API rights without the blanket grant — the section must
    // admit them too, or the capability their charter names opens no door.
    label: "Events",
    href: "/admin/events",
    Icon: CalendarDays,
    cap: ["events.manage", "events.approve", "events.publish", "events.update"],
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
    // Titles only. Offices moved to the Access console because an office
    // grants capabilities; a designation grants none, so it is not access
    // administration and does not belong next to it.
    label: "Designations",
    href: "/admin/positions",
    Icon: Landmark,
    cap: "designations.assign",
  },
  {
    label: "Blogs",
    href: "/admin/blog",
    Icon: FileText,
    cap: ["blog.review", "blog.approve", "blog.publish", "blog.feature"],
  },
  {
    label: "Resources",
    href: "/admin/resources",
    Icon: FolderOpen,
    cap: ["resources.manage", "resources.approve"],
  },
  {
    label: "Gallery",
    href: "/admin/gallery",
    Icon: Image,
    cap: ["gallery.manage", "gallery.approve"],
  },
  {
    label: "Projects",
    href: "/admin/projects",
    Icon: Rocket,
    cap: ["projects.manage", "projects.approve"],
  },
  {
    label: "Sponsors",
    href: "/admin/sponsors",
    Icon: Handshake,
    cap: ["sponsors.manage", "sponsors.approve"],
  },
  {
    label: "Notifications",
    href: "/admin/notifications",
    Icon: Bell,
    cap: "notifications.send",
  },
  {
    // Everything that grants authority: roles, charter offices (an office is a
    // role plus a term) and operational powers. Visible when the caller holds
    // any of the three capabilities; each tab is filtered again inside.
    label: "Access & Powers",
    href: "/admin/access",
    Icon: ShieldCheck,
    cap: ["access.assign_roles", "powers.manage", "governance.manage_offices"],
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

/**
 * Sidebar grouping: sixteen flat entries are unscannable, so sections roll
 * up under five headings. Groups render only when at least one of their
 * sections is visible to the caller — office holders get a short sidebar,
 * admins the full console.
 */
const SECTION_GROUPS: Array<{ label: string; hrefs: string[] }> = [
  { label: "Overview", hrefs: ["/admin", "/admin/pending"] },
  {
    label: "People",
    hrefs: ["/admin/membership", "/admin/users", "/admin/positions"],
  },
  {
    label: "Content",
    hrefs: [
      "/admin/events",
      "/admin/event-types",
      "/admin/blog",
      "/admin/resources",
      "/admin/gallery",
      "/admin/projects",
      "/admin/sponsors",
    ],
  },
  { label: "Engage", hrefs: ["/admin/notifications", "/admin/notifications/compose"] },
  {
    label: "Govern",
    hrefs: [
      "/admin/access",
      "/admin/departments",
      "/admin/governance",
      "/admin/audit",
    ],
  },
];

/**
 * Active-section match. Exact equality breaks on every nested route
 * (/admin/events/abc, /admin/membership/approved), leaving the sidebar with
 * nothing highlighted on most console screens. Prefix match instead — except
 * /admin itself, which prefixes everything and must stay exact.
 */
export function isActiveSection(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";

  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const {
    status,
    hasCapability,
    loading: permLoading,
    error: permError,
    refresh: refreshPermissions,
  } = usePermissions();
  const router = useRouter();
  const pathname = usePathname();
  const [admitted, setAdmitted] = useState<boolean | null>(null);
  const [bootstrapOnly, setBootstrapOnly] = useState(false);
  const [verifyFailed, setVerifyFailed] = useState(false);
  // Badge per review queue for the sidebar. Keyed by REVIEW_QUEUES key.
  const [queueCounts, setQueueCounts] = useState<Record<string, number>>({});
  // The bootstrap admin-check fires at most once per sign-in: without the
  // guard, every permission refresh would re-fire it and bounce the shell.
  const adminCheckDoneRef = useRef<string | null>(null);

  useEffect(() => {
    if (!loading && !permLoading) {
      if (!user) {
        router.push("/login");

        return;
      }

      // Option B admission: any server-resolved capability granting at least
      // one section, or admin tier ("*" covers everything). hasCapability is
      // the only authority check left — the legacy resolver that used to sit
      // beside it resolved a different vocabulary in the browser, and office
      // holders kept being bounced here because it knew none of these names.
      // Fall back to server admin-check for bootstrap ADMIN_EMAILS.
      const visible = ADMIN_SECTIONS.some((s) =>
        sectionMatches(hasCapability, s.cap),
      );

      // Event proposers hold events.create without any section capability
      // (community/technical/security leads). They are admitted for the event
      // creation flow only; the sidebar renders whatever sections they hold,
      // possibly none — the dashboard and create page degrade accordingly.
      const canProposeEvents = hasCapability("events.create");

      if (
        status === "admin" ||
        status === "dev" ||
        visible ||
        canProposeEvents
      ) {
        setAdmitted(true);
        setVerifyFailed(false);

        return;
      }

      // A failed permissions fetch is UNKNOWN, not denied: bouncing to
      // /unauthorized on a 500/network blip locks out legitimate managers
      // with no explanation and no recovery. Show the retry panel instead.
      if (permError) {
        setVerifyFailed(true);

        return;
      }

      if (adminCheckDoneRef.current === user.$id) return;
      adminCheckDoneRef.current = user.$id;

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
            router.push(`/unauthorized?from=${encodeURIComponent(pathname)}`);
          } else {
            setBootstrapOnly(true);
            setAdmitted(true);
          }
        })
        .catch(() => {
          router.push(`/unauthorized?from=${encodeURIComponent(pathname)}`);
        });
    }
  }, [
    user,
    loading,
    permLoading,
    permError,
    router,
    pathname,
    status,
    hasCapability,
    admitted,
  ]);

  // Queue sizes for the sidebar badges, refetched on every console route so
  // the number reflects a decision just made. Failures stay silent: a missing
  // badge is not worth an error banner over the whole console.
  useEffect(() => {
    if (admitted !== true || permLoading) return;
    const controller = new AbortController();

    fetch("/api/admin/queues", {
      credentials: "include",
      signal: controller.signal,
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: { queues?: Record<string, number> } | null) => {
        if (payload?.queues) setQueueCounts(payload.queues);
      })
      .catch(() => null);

    return () => controller.abort();
  }, [admitted, permLoading, pathname]);

  if (loading || permLoading || (admitted === null && !verifyFailed)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Verifying access"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (verifyFailed && admitted !== true) {
    return (
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="text-center space-y-4 max-w-md">
          <h1 className="text-xl font-bold">Couldn&apos;t verify access</h1>
          <p className="text-default-500 text-sm">
            {permError || "The permissions check failed."} Nothing was denied —
            the console simply couldn&apos;t confirm your access. Retrying is
            safe.
          </p>
          <div className="flex gap-3 justify-center flex-wrap">
            <Button
              variant="secondary"
              onPress={() => router.push("/dashboard")}
            >
              Back to Dashboard
            </Button>
            <Button
              variant="primary"
              onPress={() => {
                setVerifyFailed(false);
                void refreshPermissions();
              }}
            >
              Check again
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const visibleSections = ADMIN_SECTIONS.filter((s) =>
    sectionMatches(hasCapability, s.cap),
  );
  const queueByHref = new Map(REVIEW_QUEUES.map((q) => [q.href, q.key]));
  // The overview badge is the sum of every queue the caller can decide — its
  // own count, not a seventh number to drift from the six.
  const pendingTotal = Object.values(queueCounts).reduce(
    (sum, count) => sum + count,
    0,
  );
  const byHref = new Map(visibleSections.map((s) => [s.href, s]));
  const visibleGroups = SECTION_GROUPS.map((group) => ({
    ...group,
    sections: group.hrefs
      .map((href) => byHref.get(href))
      .filter((s): s is (typeof visibleSections)[number] => s !== undefined),
  })).filter((group) => group.sections.length > 0);
  // Deepest match wins: /admin/events/abc highlights Events, not Dashboard.
  const currentSection = [...visibleSections]
    .sort((a, b) => b.href.length - a.href.length)
    .find((s) => isActiveSection(pathname, s.href));

  return (
    <div className="flex min-h-screen gap-4 p-4 lg:gap-5 lg:p-5">
      {/* Admin Sidebar: floating rounded panel with grouped keyboard-
          navigable sections. A ListBox (not raw links) gives arrow-key
          movement, typeahead, and visible focus rings for free; Enter or
          click routes via onAction. */}
      <aside className="hidden w-72 shrink-0 rounded-3xl border border-default-200/70 bg-surface lg:sticky lg:top-5 lg:block lg:h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
        <div className="p-5 pb-3">
          <h2 className="text-lg font-bold tracking-tight">Console</h2>
          <p className="text-xs text-muted">Club Management</p>
        </div>
        <ListBox
          aria-label="Console sections"
          className="px-3 pb-2"
          selectionMode="none"
          onAction={(key) => router.push(String(key))}
        >
          {visibleGroups.map((group) => (
            <ListBox.Section key={group.label}>
              <Header className="px-3 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {group.label}
              </Header>
              {group.sections.map((section) => {
                const active = isActiveSection(pathname, section.href);
                const queueKey = queueByHref.get(section.href);
                const waiting =
                  section.href === "/admin/pending"
                    ? pendingTotal
                    : queueKey
                      ? (queueCounts[queueKey] ?? 0)
                      : 0;

                return (
                  <ListBox.Item
                    key={section.href}
                    className={`rounded-xl ${active ? "bg-accent/15 font-medium text-accent" : ""}`}
                    id={section.href}
                    textValue={section.label}
                  >
                    <section.Icon aria-hidden className="size-4 shrink-0" />
                    <Label>{section.label}</Label>
                    {waiting > 0 && (
                      <span
                        aria-label={`${waiting} awaiting review`}
                        className="ml-auto rounded-full bg-accent/20 px-1.5 text-[11px] font-semibold tabular-nums text-accent"
                      >
                        {waiting > 99 ? "99+" : waiting}
                      </span>
                    )}
                  </ListBox.Item>
                );
              })}
            </ListBox.Section>
          ))}
        </ListBox>
        <div className="border-t border-separator p-3">
          <ListBox
            aria-label="Console exit"
            selectionMode="none"
            onAction={(key) => router.push(String(key))}
          >
            <ListBox.Item
              key="/dashboard"
              className="rounded-xl"
              id="/dashboard"
              textValue="Back to Dashboard"
            >
              <ArrowLeft aria-hidden className="size-4 shrink-0" />
              <Label>Back to Dashboard</Label>
            </ListBox.Item>
          </ListBox>
          {user?.email && (
            <p className="truncate px-3 pb-1 pt-2 text-xs text-muted">
              Signed in as {user.email}
            </p>
          )}
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 overflow-auto">
        {/* Compact section nav for viewports without the sidebar: the current
            section up front, everything else a swipe away. */}
        <div className="sticky top-4 z-10 rounded-2xl border border-default-200/70 bg-surface lg:hidden">
          <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-muted">
            Console{currentSection ? ` · ${currentSection.label}` : ""}
          </p>
          <nav
            aria-label="Admin sections"
            className="flex gap-2 overflow-x-auto px-3 pb-3"
          >
            {visibleSections.map((section) => {
              const active = isActiveSection(pathname, section.href);

              return (
                <Button
                  key={section.href}
                  aria-current={active ? "page" : undefined}
                  className="shrink-0 rounded-full"
                  size="sm"
                  variant={active ? "primary" : "secondary"}
                  onPress={() => router.push(section.href)}
                >
                  <section.Icon aria-hidden className="size-3.5 shrink-0" />
                  {section.label}
                </Button>
              );
            })}
          </nav>
        </div>
        {/* Bootstrap escape hatch: ADMIN_EMAILS admits to the shell, but
            capability APIs need a real user_roles row. Say so plainly instead
            of rendering an empty console whose every screen 403s. */}
        {bootstrapOnly && visibleSections.length === 0 && (
          <div className="m-4 md:m-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
            <h2 className="font-semibold text-amber-200">
              Finish the admin setup
            </h2>
            <p className="mt-1 text-sm text-muted">
              Your account is recognised as a bootstrap administrator, but it
              has no governance role yet, so the admin APIs will refuse it.
              Create one with the bootstrap script, then reload:
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
