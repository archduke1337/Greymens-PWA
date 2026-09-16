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

export function ok<T extends Record<string, unknown>>(data: T, status = 200): NextResponse {
  return NextResponse.json({ success: true, data, ...data }, { status });
}

export function fail(code: string, message: string, status: number, extra?: Record<string, unknown>): NextResponse {
  return NextResponse.json({ success: false, error: { code, message }, ...extra }, { status });
}

export const ApiError = {
  unauthorized: () => fail("UNAUTHENTICATED", "Unauthorized", 401),
  forbidden: () => fail("FORBIDDEN", "Forbidden", 403),
  notFound: (message = "Not found") => fail("NOT_FOUND", message, 404),
  conflict: (message: string) => fail("CONFLICT", message, 409),
  validation: (message: string) => fail("VALIDATION", message, 422),
};
