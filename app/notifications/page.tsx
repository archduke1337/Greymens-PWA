"use client";

import type { Notification, LetterData } from "@/lib/types";

import { useEffect, useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button, Card, CardContent, Chip } from "@heroui/react";

import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/lib/notifications";
import { officeTitle } from "@/lib/governance";
import { timeAgo } from "@/lib/format";
import Markdown from "@/components/Markdown";
import PushToggle from "@/components/PushToggle";

function parseLetterContent(raw: unknown): LetterData | null {
  if (!raw) return null;
  if (typeof raw !== "string") return raw as LetterData;
  try {
    return JSON.parse(raw) as LetterData;
  } catch {
    return null;
  }
}

/**
 * Chip labels for the type filter. The vocabulary is small and mostly
 * self-describing; these are the ones a member would otherwise have to guess
 * at. Unknown types fall back to their raw name — a new backend type must not
 * render as an empty chip.
 */
const TYPE_LABELS: Record<string, string> = {
  membership_approved: "Membership",
  membership_rejected: "Membership",
  submission_update: "My submissions",
  event_update: "Events",
  event_reminder: "Events",
  promotion: "Promotions",
  designation: "Titles",
  admin_announcement: "Announcements",
  system_update: "System",
  welcome: "Welcome",
  general: "General",
};

function typeLabel(type: string): string {
  return TYPE_LABELS[type] ?? type.replace(/_/g, " ");
}

function SafeLetter({ letter }: { letter: unknown }) {
  const parsed = parseLetterContent(letter);

  if (!parsed) {
    return (
      <p className="mt-3 text-xs text-default-400">
        Letter content could not be displayed.
      </p>
    );
  }

  return <LetterContent letter={parsed} />;
}

function LetterContent({ letter }: { letter: LetterData }) {
  return (
    <div className="mt-3 p-4 bg-default-50 rounded-lg border border-default-200 space-y-2">
      <div className="flex items-center gap-2">
        <svg
          className="w-4 h-4 text-primary"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          viewBox="0 0 24 24"
        >
          <path
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <p className="text-sm font-semibold">{letter.subject}</p>
      </div>
      <pre className="text-xs text-default-600 whitespace-pre-wrap font-sans leading-relaxed">
        {letter.body}
      </pre>
      {letter.metadata && Object.keys(letter.metadata).length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-default-200">
          {Object.entries(letter.metadata).map(([key, value]) => (
            <Chip key={key} size="sm" variant="soft">
              {key}: {String(value)}
            </Chip>
          ))}
        </div>
      )}
    </div>
  );
}

export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);
  // "all" shows everything; a type narrows to one family.
  const [typeFilter, setTypeFilter] = useState<string>("all");

  /**
   * The filter chips are derived from what the caller was actually sent, not
   * a hardcoded list: a fixed menu decays as types come and go, and an empty
   * filter that matches nothing is worse than none.
   */
  const filterOptions = useMemo(() => {
    const counts = new Map<string, number>();

    for (const notification of notifications) {
      counts.set(notification.type, (counts.get(notification.type) ?? 0) + 1);
    }

    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([value, count]) => ({ value, count }));
  }, [notifications]);

  const filtered = useMemo(
    () =>
      notifications.filter(
        (n) =>
          (!unreadOnly || !n.read) &&
          (typeFilter === "all" || n.type === typeFilter),
      ),
    [notifications, unreadOnly, typeFilter],
  );

  // Newest first, grouped into Today / Earlier. Rows arrive ordered from the
  // API, but grouping must not depend on that: it sorts its own copy.
  const grouped = useMemo(() => {
    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.$createdAt ?? 0).getTime() -
        new Date(a.$createdAt ?? 0).getTime(),
    );
    const startOfToday = new Date();

    startOfToday.setHours(0, 0, 0, 0);

    return {
      today: sorted.filter((n) => new Date(n.$createdAt ?? 0) >= startOfToday),
      earlier: sorted.filter((n) => new Date(n.$createdAt ?? 0) < startOfToday),
    };
  }, [filtered]);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      setLoadError(null);
      const data = await notificationService.getUserNotifications(100);

      setNotifications(data);
    } catch {
      setLoadError("Failed to load notifications.");
      toast.error("Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    if (user) {
      loadNotifications();
    }
  }, [user, authLoading, router, loadNotifications]);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.read || !notification.$id) return;
    try {
      await notificationService.markAsRead(notification.$id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.$id === notification.$id ? { ...n, read: true } : n,
        ),
      );
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    const unreadCount = notifications.filter((n) => !n.read).length;

    if (unreadCount === 0) return;

    setMarkingAll(true);
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      toast.success(
        `Marked ${unreadCount} notification${unreadCount > 1 ? "s" : ""} as read`,
      );
    } catch {
      toast.error("Failed to mark all as read");
    } finally {
      setMarkingAll(false);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "welcome":
        return (
          <svg
            className="w-5 h-5 text-success"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "promotion":
        return (
          <svg
            className="w-5 h-5 text-warning"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "submission_update":
        // Review verdicts on content submissions (project, gallery, resource,
        // sponsor, blog) — one type for all five queues.
        return (
          <svg
            className="w-5 h-5 text-accent"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "designation":
        return (
          <svg
            className="w-5 h-5 text-secondary"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      case "event":
        return (
          <svg
            className="w-5 h-5 text-primary"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
      default:
        return (
          <svg
            className="w-5 h-5 text-default-400"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            viewBox="0 0 24 24"
          >
            <path
              d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        );
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div
          aria-label="Loading notifications"
          className="text-center"
          role="status"
        >
          <div
            aria-hidden="true"
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
          />
          <p className="mt-4 text-default-500">Loading notifications...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-200px)]">
        <div
          aria-label="Redirecting to login"
          className="text-center"
          role="status"
        >
          <div
            aria-hidden="true"
            className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"
          />
          <p className="mt-4 text-default-500">
            Sign in required — taking you to login...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-5 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-sm text-muted">
            {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {notifications.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-muted">
              <input
                checked={unreadOnly}
                className="h-4 w-4"
                type="checkbox"
                onChange={(e) => setUnreadOnly(e.target.checked)}
              />
              Unread only
            </label>
          )}
          {unreadCount > 0 && (
            <Button
              isPending={markingAll}
              size="sm"
              variant="ghost"
              onPress={handleMarkAllAsRead}
            >
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {loadError && (
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-4">
            <p className="text-sm text-danger" role="alert">
              {loadError}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onPress={() => void loadNotifications()}
            >
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      <PushToggle />

      {/* Type chips, derived from what was actually received. */}
      {filterOptions.length > 1 && (
        <div
          aria-label="Filter by type"
          className="flex flex-wrap gap-2"
          role="group"
        >
          <button
            aria-pressed={typeFilter === "all"}
            className={`inline-flex min-h-10 items-center rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
              typeFilter === "all"
                ? "border-foreground bg-foreground text-background"
                : "border-default-300 text-default-600 hover:border-default-400"
            }`}
            type="button"
            onClick={() => setTypeFilter("all")}
          >
            All
          </button>
          {filterOptions.map(({ value, count }) => (
            <button
              key={value}
              aria-pressed={typeFilter === value}
              className={`inline-flex min-h-10 items-center rounded-full border px-3.5 py-1 text-xs font-medium transition-colors ${
                typeFilter === value
                  ? "border-foreground bg-foreground text-background"
                  : "border-default-300 text-default-600 hover:border-default-400"
              }`}
              type="button"
              onClick={() => setTypeFilter(value)}
            >
              {typeLabel(value)}
              <span className="ml-1.5 tabular-nums opacity-60">{count}</span>
            </button>
          ))}
        </div>
      )}

      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <svg
              aria-hidden="true"
              className="w-16 h-16 text-default-300"
              fill="none"
              stroke="currentColor"
              strokeWidth={1}
              viewBox="0 0 24 24"
            >
              <path
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <p className="text-default-400">
              {notifications.length === 0
                ? "No notifications yet"
                : "Nothing matches these filters"}
            </p>
            <p className="text-sm text-default-500">
              {notifications.length === 0
                ? "Membership updates and event reminders will appear here."
                : 'Try a different type, or switch off "Unread only".'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(
            [
              ...(grouped.today.length > 0
                ? [{ heading: "Today", rows: grouped.today }]
                : []),
              ...(grouped.earlier.length > 0
                ? [{ heading: "Earlier", rows: grouped.earlier }]
                : []),
            ] as Array<{ heading: string; rows: Notification[] }>
          ).map(({ heading, rows }) => (
            <section key={heading} className="space-y-3">
              <h2 className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted">
                {heading}
              </h2>
              {rows.map((notification) => (
                <button
                  key={notification.$id}
                  aria-label={
                    notification.read
                      ? `Notification: ${notification.title}`
                      : `Unread notification: ${notification.title}. Mark as read`
                  }
                  className="block w-full cursor-pointer text-left"
                  type="button"
                  onClick={() => handleMarkAsRead(notification)}
                >
                  <Card
                    className={`transition-all ${
                      !notification.read ? "border-foreground/40" : "opacity-60"
                    }`}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 mt-0.5">
                          {getNotificationIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold truncate">
                              {notification.title}
                            </p>
                            {!notification.read && (
                              <span
                                aria-hidden="true"
                                className="flex-shrink-0 w-2 h-2 rounded-full bg-foreground"
                              />
                            )}
                          </div>
                          {notification.fromOffice && (
                            <p className="text-xs font-medium text-accent">
                              From the Office of{" "}
                              {officeTitle(notification.fromOffice) ??
                                notification.fromOffice}
                            </p>
                          )}
                          <Markdown>{notification.body}</Markdown>
                          <p className="text-xs text-default-400">
                            {notification.$createdAt
                              ? timeAgo(notification.$createdAt)
                              : ""}
                          </p>

                          {/* Letter Content */}
                          {notification.letter && (
                            <SafeLetter letter={notification.letter} />
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
