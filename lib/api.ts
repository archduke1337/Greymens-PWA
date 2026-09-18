import { NextResponse } from "next/server";

/**
 * Canonical API envelope (Blueprint §16) — adopted incrementally.
 * New/updated routes return `{ success: true, data }` or
 * `{ success: false, error: { code, message } }` with legacy fields spread
 * alongside for backward compatibility during migration.
 *
 * Status semantics: 401 unauthenticated, 403 forbidden, 404 no-existence-oracle,
 * 409 conflict, 422 validation, 429 rate-limit, 500 unexpected.
 */

const RESERVED_ENVELOPE_KEYS = new Set(["success", "error"]);

/**
 * Strips envelope-reserved keys from caller payloads so response content can
 * never overwrite `success`/`error`. Without this, `ok({ success: false })`
 * would serialize a 200 with `success: false`.
 *
 * Note `data` is deliberately NOT stripped: payloads such as
 * `ok({ data: record })` use it as an ordinary field name, and the envelope
 * already carries the same object under `data`, so the spread is a no-op.
 */
function stripReserved<T extends Record<string, unknown>>(obj: T): T {
  const out: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (!RESERVED_ENVELOPE_KEYS.has(key)) out[key] = value;
  }

  return out as T;
}

export function ok<T extends Record<string, unknown>>(
  data: T,
  status = 200,
  headers?: Record<string, string>,
): NextResponse {
  const safe = stripReserved(data);

  return NextResponse.json(
    { success: true, data: safe, ...safe },
    { status, headers },
  );
}

export function fail(
  code: string,
  message: string,
  status: number,
  extra?: Record<string, unknown>,
  headers?: Record<string, string>,
): NextResponse {
  const safe = extra ? stripReserved(extra) : {};

  return NextResponse.json(
    { success: false, error: { code, message }, ...safe },
    { status, headers },
  );
}

export const ApiError = {
  unauthorized: () => fail("UNAUTHENTICATED", "Unauthorized", 401),
  forbidden: () => fail("FORBIDDEN", "Forbidden", 403),
  notFound: (message = "Not found") => fail("NOT_FOUND", message, 404),
  conflict: (message: string) => fail("CONFLICT", message, 409),
  validation: (message: string) => fail("VALIDATION", message, 422),
  rateLimited: (message = "Too many requests") =>
    fail("RATE_LIMITED", message, 429),
  internal: (message = "Something went wrong") =>
    fail("INTERNAL", message, 500),
};

/**
 * Detect an Appwrite unique-constraint violation (HTTP 409) for
 * check-then-create races: two concurrent requests can both pass the
 * pre-check, and the loser's create throws. Callers catch this and fall back
 * to reading/updating the winner's row instead of 500ing.
 */
export function isConflict(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === 409
  );
}
