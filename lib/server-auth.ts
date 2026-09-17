import { Account, Client, Query, type Models } from "appwrite";
import { NextRequest, NextResponse } from "next/server";

import { SESSION_COOKIE_NAME } from "@/lib/appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { fail } from "@/lib/api";

type AppwriteUser = Models.User<Models.Preferences>;

export type AuthResult =
  | { user: AppwriteUser; response?: undefined }
  | { user: null; response: NextResponse };

export interface RequestCookie {
  name: string;
  value: string;
}

/**
 * Resolve the Appwrite session secret from request cookies.
 *
 * Pure and unit-tested. Precedence:
 * 1. `gm_session` — the first-party mirror the browser writes from the SDK's
 *    localStorage fallback (see lib/appwrite.ts). This is the only session
 *    the server sees on cross-domain deployments.
 * 2. `a_session_*` — native Appwrite cookie (same-origin / self-hosted).
 * 3. `a_session_legacy` — older SDK cookie name; honored so legacy holders
 *    are not stranded by the proxy/server mismatch.
 */
export function resolveSessionSecret(
  cookies: Array<RequestCookie>,
): string | null {
  const mirror = cookies.find(({ name }) => name === SESSION_COOKIE_NAME);
  if (mirror?.value) {
    try {
      return decodeURIComponent(mirror.value) || null;
    } catch {
      return mirror.value || null;
    }
  }
  const legacy = cookies.find(({ name }) => name === "a_session_legacy");
  if (legacy?.value) return legacy.value;
  const sessionCookie = cookies.find(
    ({ name }) => name.startsWith("a_session_") && name !== "a_session_",
  );
  return sessionCookie?.value || null;
}

function getSessionValue(request: NextRequest): string | null {
  return resolveSessionSecret(request.cookies.getAll());
}

export async function getAuthenticatedUser(
  request: NextRequest,
): Promise<AppwriteUser | null> {
  const session = getSessionValue(request);
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;

  if (!session || !endpoint || !projectId) return null;

  try {
    const client = new Client()
      .setEndpoint(endpoint)
      .setProject(projectId)
      .setSession(session);

    return await new Account(client).get();
  } catch {
    return null;
  }
}

export async function requireAuthenticatedUser(
  request: NextRequest,
): Promise<AuthResult> {
  const user = await getAuthenticatedUser(request);

  if (!user) {
    return {
      user: null,
      response: fail("UNAUTHENTICATED", "Unauthorized", 401),
    };
  }

  return { user };
}

const ADMIN_STATUSES = new Set(["admin", "dev"]);
export const RESTRICTED_STATUSES = new Set([
  "banned",
  "suspended",
  "deactivated",
]);

/**
 * `ADMIN_EMAILS` is a bootstrap escape hatch so the first administrator can
 * exist before any governance record does. It is checked before any database
 * lookup so that a misconfigured or unavailable database cannot lock every
 * administrator out of the console.
 *
 * Exported so the capability pipeline (`requireCapability`) honors the same
 * escape hatch: without it a bootstrap administrator would see the console
 * shell (status resolves via `getMembershipStatus`) while every data API
 * underneath 403s via the DB-only `resolveMembershipStatus`.
 */
export function isBootstrapAdmin(email: string): boolean {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean)
    .includes(email.toLowerCase());
}

/**
 * Resolve an account's governance status from the data that actually owns it.
 *
 * The membership model does not live in a single column: an account becomes a
 * member when its membership row is active (or its application is approved) and
 * gains seniority through designations. Previously this function simply read
 * `profiles.status`, a column that was never provisioned, so every caller saw
 * "account" — which meant the client (which derives status properly) and the
 * server disagreed about who the user was. That divergence is a security bug:
 * UI gating is not authorisation, and any server check keyed on membership was
 * unreachable.
 *
 * Precedence is deliberate:
 *  1. An explicit restriction wins absolutely. A ban or suspension must take
 *     effect immediately and must not be overridable by any other record —
 *     including a governance role, or banning an administrator would leave
 *     them fully privileged.
 *  2. An explicit governance appointment in `user_roles` is next. That table is
 *     the only legitimate source of the `admin`/`dev` tier.
 *  3. Otherwise derive it from membership and application records, then
 *     elevate it from designation levels (5 → lead, 6 → head), which is the
 *     same ladder the client applies for display purposes only.
 *
 * `profiles.status` is deliberately not consulted even though a leftover read
 * of it survived here for a while. The column is not provisioned, so the read
 * always yielded `undefined` and the branch was dead — but leaving it in place
 * invites someone to "fix" it by adding the column, which is the exact bug this
 * function was written to remove.
 *
 * In-flight dedupe: concurrent callers for the same user share one promise.
 * No TTL cache — restrictions (ban/suspend) must take effect immediately on
 * the next request, so each request still triggers at least one resolution.
 */
const inflightStatus = new Map<string, Promise<string>>();

export async function resolveMembershipStatus(userId: string): Promise<string> {
  const pending = inflightStatus.get(userId);
  if (pending) return pending;
  const run = resolveMembershipStatusInner(userId).finally(() => {
    if (inflightStatus.get(userId) === run) inflightStatus.delete(userId);
  });
  inflightStatus.set(userId, run);
  return run;
}

async function resolveMembershipStatusInner(userId: string): Promise<string> {
  const { databases } = createServerDatabases();
  const [
    profiles,
    memberships,
    applications,
    userDesignations,
    designations,
    userRoles,
    userDepartments,
  ] = await Promise.all([
    databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
      Query.equal("userId", [userId]),
      Query.limit(1),
    ]),
    databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
      Query.equal("userId", [userId]),
      Query.limit(1),
    ]),
    databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
      Query.equal("userId", [userId]),
      Query.limit(1),
    ]),
    databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
      Query.equal("userId", [userId]),
      Query.equal("isActive", [true]),
      Query.limit(50),
    ]),
    databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
      Query.equal("isActive", [true]),
      Query.limit(200),
    ]),
    // `user_roles` is provisioned separately from the original tables. On an
    // installation that predates it the query throws, and because this function
    // is awaited by every status check, that would collapse every account to
    // "account". Degrade to "no role" instead of failing closed so hard.
    (async () => {
      try {
        return await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.USER_ROLES,
          [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(1),
          ],
        );
      } catch {
        return { documents: [] as Array<Record<string, unknown>> };
      }
    })(),
    databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
      Query.equal("userId", [userId]),
      Query.equal("isActive", [true]),
      Query.limit(50),
    ]).catch(() => ({ documents: [] as Array<Record<string, unknown>> })),
  ]);

  const membershipStatus = memberships.documents[0]?.status;
  const applicationStatus = applications.documents[0]?.status;

  // A restriction outranks every other source, including an explicit
  // governance role. The documentation above always claimed this, but the code
  // returned the role first — so banning or suspending an administrator left
  // them fully privileged, and the ban only appeared to work. Restriction is
  // checked before the role rather than instead of it because a ban must not be
  // undoable by any other record.
  if (
    typeof membershipStatus === "string" &&
    RESTRICTED_STATUSES.has(membershipStatus)
  ) {
    return membershipStatus;
  }

  const assignedRole = String(
    (userRoles.documents[0] as Record<string, unknown> | undefined)?.role || "",
  );

  if (assignedRole === "admin" || assignedRole === "dev") return assignedRole;

  let base = profiles.documents.length > 0 ? "account" : "no_account";

  if (membershipStatus === "active" || applicationStatus === "approved") {
    base = "member";
  } else if (
    applicationStatus === "pending" ||
    applicationStatus === "reapplied" ||
    applicationStatus === "rejected"
  ) {
    base = "applicant";
  }

  if (base === "member") {
    const levelByDesignation = new Map(
      designations.documents.map((designation) => [
        designation.$id,
        Number(designation.level) || 0,
      ]),
    );
    const highestLevel = userDesignations.documents.reduce(
      (highest, assignment) =>
        Math.max(
          highest,
          levelByDesignation.get(String(assignment.designationId)) ?? 0,
        ),
      0,
    );

    if (highestLevel >= 6) return "head";
    if (highestLevel >= 5) return "lead";
    // Department seniority without a governance designation: an active
    // core/lead department role makes the member a core_member. This is the
    // only path that produces the status, which the dashboards, the client
    // permission ladder, and the resource gates all already handle.
    const holdsDeptSeniority = userDepartments.documents.some((row) =>
      ["core_member", "lead"].includes(
        String((row as Record<string, unknown>).role ?? ""),
      ),
    );

    if (holdsDeptSeniority) return "core_member";
  }

  return base;
}

export async function isAdminUser(user: AppwriteUser): Promise<boolean> {
  if (isBootstrapAdmin(user.email)) return true;

  try {
    return ADMIN_STATUSES.has(await resolveMembershipStatus(user.$id));
  } catch {
    return false;
  }
}

export async function requireAdmin(request: NextRequest): Promise<AuthResult> {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated;

  if (!(await isAdminUser(authenticated.user))) {
    return {
      user: null,
      response: fail("FORBIDDEN", "Forbidden", 403),
    };
  }

  return authenticated;
}

export async function getMembershipStatus(user: AppwriteUser): Promise<string> {
  // A bootstrap administrator must resolve to `admin` for the client too, or
  // the console would be reachable by direct URL while every admin control in
  // the navigation stayed hidden.
  if (isBootstrapAdmin(user.email)) return "admin";

  try {
    return await resolveMembershipStatus(user.$id);
  } catch {
    return "account";
  }
}

export function isMemberStatus(status: string): boolean {
  return ["member", "core_member", "lead", "head", "admin", "dev"].includes(
    status,
  );
}

/**
 * Request-level guard for endpoints that require club membership rather than
 * administrative rights.
 */
export async function requireMember(request: NextRequest): Promise<AuthResult> {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated;

  const status = await getMembershipStatus(authenticated.user);

  if (!isMemberStatus(status)) {
    return {
      user: null,
      response: fail("FORBIDDEN", "Forbidden", 403),
    };
  }

  return authenticated;
}
