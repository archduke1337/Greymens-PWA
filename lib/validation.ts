/**
 * Input validation helpers for API routes.
 *
 * Route handlers receive untrusted JSON, so every field must be checked for
 * type and length before it is used or forwarded. Keeping the checks here means
 * a limit can only be relaxed in one place.
 */

export const TEXT_LIMITS = {
  name: 120,
  email: 254,
  subject: 200,
  message: 5000,
  title: 255,
  description: 2000,
  shortText: 255,
} as const;

/** Reads a bounded, trimmed string from untrusted input, or null if invalid. */
export function readString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > maxLength) return null;
  return trimmed;
}

/**
 * Reads an optional bounded string.
 *
 * Three outcomes, kept distinct on purpose:
 * - `undefined` — absent or empty (the caller may apply a default);
 * - `string` — present and within bounds;
 * - `null` — present but invalid (overlong or wrong type).
 *
 * Collapsing invalid into `undefined` would let oversized input silently pass
 * as "not provided", so callers must handle `null` as a 400, never as absent.
 */
export function readOptionalString(value: unknown, maxLength: number): string | null | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (trimmed.length > maxLength) return null;
  return trimmed;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Accept only absolute http(s) URLs.
 *
 * Anything stored here is rendered into an `<img src>`/anchor, so `javascript:`
 * and `data:` must be rejected at the boundary rather than trusted.
 */
export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

export function isEmailAddress(value: string): boolean {
  return value.length <= TEXT_LIMITS.email && EMAIL_PATTERN.test(value);
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Keeps error logs useful without dumping personal data into application logs. */
export function redactEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "[redacted]";
  return `${local.slice(0, 1)}***@${domain}`;
}
