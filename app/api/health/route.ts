import { NextRequest } from "next/server";
import { Query } from "node-appwrite";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { createServerTablesClient } from "@/lib/appwrite-server";
import { ok, fail } from "@/lib/api";

/**
 * Liveness/readiness probe.
 *
 * Deliberately minimal: this endpoint is unauthenticated, so it must not
 * disclose runtime versions, hostnames, project identifiers, secrets, or raw
 * error text. It reports only booleans — which checks pass — so a failing
 * deployment (missing API key, wrong database id, unscoped key) can be told
 * apart from a backend outage without leaking anything an attacker could use.
 * Presence of a variable is inferable from behavior anyway; values never are.
 */
export async function GET(request: NextRequest) {
  const limit = consumeRateLimit(`health:${getClientAddress(request)}`, 60, 60_000);
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const hasEndpoint = Boolean(endpoint);
  const hasProject = Boolean(projectId);
  const checks = {
    endpoint: hasEndpoint,
    project: hasProject,
    databaseId: Boolean(process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID),
    apiKey: Boolean(process.env.APPWRITE_API_KEY),
    backendReachable: false,
    databaseReadable: false,
  };

  if (!hasEndpoint || !hasProject) {
    return fail("DEGRADED", "Service degraded", 503);
  }

  try {
    const response = await fetch(endpoint as string, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(5000),
      cache: "no-store",
    });
    checks.backendReachable = response.status < 500;
  } catch {
    checks.backendReachable = false;
  }

  // Authenticated read of one row: proves the API key exists, belongs to
  // this project, carries table scope, and that the database id resolves.
  // Any of those missing is exactly what turns every data route (events,
  // departments, dashboard, …) into a 500 while this probe still answers.
  if (checks.apiKey && checks.databaseId) {
    try {
      const { tables, databaseId } = createServerTablesClient();
      await tables.listRows({
        databaseId,
        tableId: "departments",
        queries: [Query.limit(1)],
      });
      checks.databaseReadable = true;
    } catch {
      checks.databaseReadable = false;
    }
  }

  if (!checks.backendReachable || !checks.databaseReadable) {
    return fail("DEGRADED", "Service degraded", 503, { checks });
  }
  return ok({ status: "operational", checks });
}
