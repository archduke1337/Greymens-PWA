import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

/**
 * Route-guard matrix: every app/api route.ts must either self-guard or
 * appear on the intentional-public allowlist.
 *
 * proxy.ts never gates /api/*, so a forgotten guard is world-open. This test
 * is the safety net that fails the build when a new handler is added without
 * an auth/capability check and without being deliberately public.
 */

const API_ROOT = join(process.cwd(), "app", "api");

/** Handlers that are intentionally unauthenticated (with rate limits). */
const PUBLIC_ALLOWLIST = new Set([
  "health", // liveness booleans only
  "stats", // homepage proof-strip counts
  "departments", // public catalogue display fields
  "feedback", // public contact (rate-limited)
  "send-email", // public contact (rate-limited)
  "blogs/views", // view counter (rate-limited by IP)
]);

const GUARD_PATTERNS = [
  /requireAuthenticatedUser/,
  /requireMember/,
  /requireAdmin/,
  /isAdminUser/,
  /requireCapability/,
  /requireAnyCapability/,
  /hasServerCapability/,
  /getAuthenticatedUser/,
  /getMembershipStatus/,
  /resolveSessionSecret/,
];

function collectRouteFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      collectRouteFiles(full, out);
    } else if (entry === "route.ts" || entry === "route.tsx") {
      out.push(full);
    }
  }
  return out;
}

function routeKey(file: string): string {
  const rel = file.slice(API_ROOT.length + 1).replace(/\\/g, "/");
  return rel.replace(/\/route\.tsx?$/, "");
}

describe("API route guard matrix", () => {
  const files = collectRouteFiles(API_ROOT);

  it("finds route handlers", () => {
    expect(files.length).toBeGreaterThan(40);
  });

  it.each(files.map((f) => [routeKey(f), f] as const))(
    "%s is guarded or allowlisted",
    (key, file) => {
      if (PUBLIC_ALLOWLIST.has(key)) return;

      const source = readFileSync(file, "utf8");
      const guarded = GUARD_PATTERNS.some((re) => re.test(source));

      expect(
        guarded,
        `${key} has no auth/capability guard and is not on PUBLIC_ALLOWLIST — add a guard or document it as public`,
      ).toBe(true);
    },
  );

  it("allowlist only contains real route keys", () => {
    const keys = new Set(files.map(routeKey));
    for (const key of PUBLIC_ALLOWLIST) {
      expect(keys.has(key), `allowlisted route missing: ${key}`).toBe(true);
    }
  });
});
