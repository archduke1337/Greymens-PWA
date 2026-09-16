import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";

/**
 * Liveness/readiness probe.
 *
 * Deliberately minimal: this endpoint is unauthenticated, so it must not
 * disclose runtime versions, hostnames, project identifiers, or raw error
 * text. It reports only whether the service is up and whether the backend
 * dependency answers. Anything more is reconnaissance for an attacker.
 */
export async function GET(request: NextRequest) {
  const limit = consumeRateLimit(`health:${getClientAddress(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!endpoint || !projectId) {
    return fail("DEGRADED", "Service degraded", 503);
  }

  try {
    const response = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    const healthy = response.status < 500;
    if (!healthy) return fail("DEGRADED", "Service degraded", 503);
    return ok({ status: "operational" });
  } catch {
    return fail("DEGRADED", "Service degraded", 503);
  }
}
