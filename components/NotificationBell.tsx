"use client";

import type { Notification } from "@/lib/types";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { useAuth } from "@/context/AuthContext";
import { notificationService } from "@/lib/notifications";
import { timeAgo } from "@/lib/format";
import { markdownToPlainText } from "@/lib/markdown";

function getNotificationIcon(type: string) {
  switch (type) {
    case "welcome":
      return (
        <svg
          className="w-4 h-4 text-success"
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
          className="w-4 h-4 text-warning"
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
    case "designation":
      return (
        <svg
          className="w-4 h-4 text-secondary"
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
          className="w-4 h-4 text-primary"
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
          className="w-4 h-4 text-default-400"
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
}

export function NotificationBell() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);

  const loadNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [recent, count] = await Promise.all([
        notificationService.getUserNotifications(10),
        notificationService.getUnreadCount(),
      ]);

      setNotifications(recent);
      setUnreadCount(count);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      loadNotifications();
      const interval = setInterval(loadNotifications, 30000);

      return () => clearInterval(interval);
    }
  }, [user, loadNotifications]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;

      if (!target.closest("[data-notification-bell]")) {
        setIsOpen(false);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsOpen(false);
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleMarkAsRead = async (notification: Notification) => {
    if (notification.read || !notification.$id) return;
    try {
      await notificationService.markAsRead(notification.$id);
      setNotifications((prev) =>
        prev.map((n) =>
          n.$id === notification.$id ? { ...n, read: true } : n,
        ),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Failed to mark as read");
    }
  };

  if (!user) return null;

  return (
    <div data-notification-bell className="relative">
      {/* Bell Button */}
      <button
        aria-expanded={isOpen}
        aria-haspopup="menu"
        aria-label="Notifications"
        className="relative p-2 rounded-lg hover:bg-default-100 transition-colors"
        onClick={() => setIsOpen(!isOpen)}
      >
        <svg
          className="w-5 h-5 text-default-600"
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
        {unreadCount > 0 && (
          <span
            aria-label={`${unreadCount} unread notifications`}
            aria-live="polite"
            className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-danger rounded-full"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          aria-label="Notifications"
          className="absolute right-0 top-full mt-2 w-[min(20rem,calc(100vw-2rem))] bg-background border border-default-200 rounded-xl shadow-xl z-50 overflow-hidden"
          role="menu"
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-default-200">
            <h3 className="text-sm font-semibold">Notifications</h3>
            {unreadCount > 0 && (
              <span className="text-xs text-primary font-medium">
                {unreadCount} unread
              </span>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div
                  aria-hidden="true"
                  className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"
                />
                <span className="sr-only">Loading notifications</span>
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 gap-2">
                <svg
                  className="w-8 h-8 text-default-300"
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
                <p className="text-xs text-default-400">No notifications</p>
              </div>
            ) : (
              <div className="divide-y divide-default-100">
                {notifications.map((notification) => (
                  <button
                    key={notification.$id}
                    className={`w-full text-left px-4 py-3 hover:bg-default-50 transition-colors ${
                      !notification.read ? "bg-primary-50/30" : ""
                    }`}
                    role="menuitem"
                    onClick={() => handleMarkAsRead(notification)}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="flex-shrink-0 mt-0.5">
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-semibold truncate">
                            {notification.title}
                          </p>
                          {!notification.read && (
                            <>
                              <span
                                aria-hidden="true"
                                className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-primary"
                              />
                              <span className="sr-only">Unread</span>
                            </>
                          )}
                        </div>
                        <p className="text-xs text-default-500 line-clamp-2">
                          {markdownToPlainText(notification.body)}
                        </p>
                        <p className="text-[10px] text-default-400">
                          {notification.$createdAt
                            ? timeAgo(notification.$createdAt)
                            : ""}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="border-t border-default-200 px-4 py-2.5">
            <Link
              className="block text-center text-xs font-medium text-primary hover:text-primary-600 transition-colors"
              href="/notifications"
              onClick={() => setIsOpen(false)}
            >
              View all notifications
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
