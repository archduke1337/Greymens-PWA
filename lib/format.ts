/**
 * Shared formatting utilities — single source for dates, relative time, and
 * event helpers. Replaces 3x `timeAgo` copies (NotificationBell,
 * notifications/page, profile/page) and 3x event helpers (events/page,
 * events/[id]/page, FeaturedSection).
 */

export function timeAgo(date: string): string {
  const then = new Date(date).getTime();

  if (Number.isNaN(then)) return "";
  const diff = Date.now() - then;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 30) return `${days}d ago`;

  return new Date(date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDate(dateString: string): string {
  const d = new Date(dateString);

  if (Number.isNaN(d.getTime())) return "";

  return d.toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function getSpotsLeft(
  capacity?: number,
  registered?: number,
): number | null {
  if (typeof capacity !== "number" || capacity <= 0) return null;

  return Math.max(0, capacity - (registered ?? 0));
}

export function getRegistrationPercentage(
  capacity?: number,
  registered?: number,
): number {
  if (typeof capacity !== "number" || capacity <= 0) return 0;

  return Math.min(100, Math.round(((registered ?? 0) / capacity) * 100));
}

export function getAvatarUrl(avatar?: string | null, name?: string): string {
  if (avatar) return avatar;
  const initial = encodeURIComponent(
    (name ?? "M").trim().charAt(0).toUpperCase() || "M",
  );

  return `https://ui-avatars.com/api/?name=${initial}&background=random`;
}
