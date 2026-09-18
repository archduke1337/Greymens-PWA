import type { Notification, LetterData } from "./types";

import { welcomeLetter, promotionLetter, designationLetter } from "./letters";

export type { Notification, LetterData };

// Letter templates live in a dependency-free module so server routes can use
// them without importing this browser-oriented one. Re-exported here for the
// existing call sites.
export { welcomeLetter, promotionLetter, designationLetter };

/**
 * Notifications are read and written through `/api/notifications`.
 *
 * The browser cannot touch the `notifications` table directly: it holds one row
 * per recipient, so a client-readable table would expose every member's inbox.
 * The endpoint stamps the recipient from the session for member-facing reads and
 * requires an authenticated administrator to send to somebody else.
 */

interface NotificationPage {
  notifications: Notification[];
  total: number;
  unreadCount: number;
}

async function requestNotifications(query = ""): Promise<NotificationPage> {
  const response = await fetch(`/api/notifications${query}`, {
    credentials: "include",
  });
  const payload = (await response.json().catch(() => null)) as
    (Partial<NotificationPage> & { error?: string }) | null;

  if (!response.ok) {
    throw new Error(payload?.error || "Failed to load notifications");
  }

  return {
    notifications: payload?.notifications ?? [],
    total: payload?.total ?? 0,
    unreadCount: payload?.unreadCount ?? 0,
  };
}

export const notificationService = {
  /** Sends a notification to another account. Administrator only. */
  async create(data: {
    userId: string;
    type: string;
    title: string;
    body: string;
    letter?: LetterData;
    data?: Record<string, unknown>;
  }): Promise<Notification> {
    const response = await fetch("/api/notifications", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const payload = (await response.json().catch(() => null)) as {
      notification?: Notification;
      error?: string;
    } | null;

    if (!response.ok || !payload?.notification) {
      throw new Error(payload?.error || "Failed to send notification");
    }

    return payload.notification;
  },

  /** Full feed, for the administrator console. */
  async getAll(limit = 200): Promise<Notification[]> {
    const { notifications } = await requestNotifications(
      `?all=true&limit=${limit}`,
    );

    return notifications;
  },

  /** The signed-in account's own notifications. */
  async getUserNotifications(limit = 50): Promise<Notification[]> {
    const { notifications } = await requestNotifications(`?limit=${limit}`);

    return notifications;
  },

  async getUnreadCount(): Promise<number> {
    const { unreadCount } = await requestNotifications("?limit=1");

    return unreadCount;
  },

  async markAsRead(notificationId: string): Promise<void> {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: notificationId }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error || "Failed to mark notification as read");
    }
  },

  async markAllAsRead(): Promise<void> {
    const response = await fetch("/api/notifications", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ all: true }),
    });

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error || "Failed to mark notifications as read");
    }
  },

  async delete(notificationId: string): Promise<void> {
    const response = await fetch(
      `/api/notifications?id=${encodeURIComponent(notificationId)}`,
      {
        method: "DELETE",
        credentials: "include",
      },
    );

    if (!response.ok) {
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      throw new Error(payload?.error || "Failed to delete notification");
    }
  },

  // Letter templates. Re-exported from lib/letters.ts so the server can render
  // the same letters without importing this module.
  welcomeLetter,
  promotionLetter,
  designationLetter,
};
