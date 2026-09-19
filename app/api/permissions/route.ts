import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  getMembershipStatus,
  requireAuthenticatedUser,
} from "@/lib/server-auth";
import { getEffectiveCapabilities } from "@/lib/access-control";
import { ok, fail } from "@/lib/api";
import { safe } from "@/lib/server-safe";
import { logError } from "@/lib/logger";

/**
 * The caller's own permissions payload.
 *
 * This is the single server-owned source of truth for the client permission
 * context. It replaces nine browser-SDK reads that previously ran on every
 * authenticated page load:
 *
 *   profileService.getByUserId, applicationService.getByUserId,
 *   membershipService.getByUserId, departmentService.getUserDepartments,
 *   designationService.getUserDesignations, powerService.getUserPowers,
 *   departmentService.getAll, designationService.getAll, powerService.getAll
 *
 * Two of those (`getAll`) read every row of their table as the signed-in user,
 * and the rest relied on those tables being world-readable to all accounts.
 * Serving them from here means the identity tables can be closed to clients
 * entirely without the UI losing anything.
 *
 * Scope note: this endpoint only ever returns the caller's own membership rows
 * plus the shared reference catalogues. It deliberately accepts no `userId`
 * parameter, so it cannot be used to enumerate other accounts.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();
    const userId = authenticated.user.$id;

    const own = { limit: 100 } as const;

    const [
      status,
      profiles,
      applications,
      memberships,
      powers,
      departments,
      designations,
      allDepartments,
      allDesignations,
      allPowers,
      capabilities,
    ] = await Promise.all([
      // Fail-closed: a status read that errors must not widen what the
      // client believes it may do, so it falls back to the unproven
      // baseline, never "member" or "admin".
      safe("status", () => getMembershipStatus(authenticated.user!), "account"),
      safe(
        "profile",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
            Query.equal("userId", [userId]),
            Query.limit(1),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "application",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
            Query.equal("userId", [userId]),
            Query.limit(1),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "membership",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
            Query.equal("userId", [userId]),
            Query.limit(1),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "powers",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(own.limit),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "departments",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(own.limit),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "designations",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
            Query.equal("userId", [userId]),
            Query.equal("isActive", [true]),
            Query.limit(own.limit),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "allDepartments",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
            Query.equal("isActive", [true]),
            Query.orderAsc("displayOrder"),
            Query.limit(200),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "allDesignations",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
            Query.equal("isActive", [true]),
            Query.orderAsc("level"),
            Query.limit(200),
          ]),
        { documents: [], total: 0 },
      ),
      safe(
        "allPowers",
        () =>
          databases.listDocuments(DATABASE_ID, COLLECTIONS.POWERS, [
            Query.orderAsc("category"),
            Query.limit(200),
          ]),
        { documents: [], total: 0 },
      ),
      // Fail-closed: on error the client sees no capabilities rather than
      // a stale set. Console buttons hide; the server re-checks anyway.
      // Tracked separately from the plain safe() wrapper so the degrade
      // flag below never fires for an ordinary member who merely holds
      // no grants.
      (async () => {
        try {
          return {
            set: await getEffectiveCapabilities(userId),
            failed: false,
          };
        } catch (error) {
          logError('"capabilities" query failed:', error);

          return { set: new Set<string>(), failed: true };
        }
      })(),
    ]);

    // Degrade flags let the client tell "you hold nothing" apart from
    // "the lookup itself failed", so a partial outage shows a banner
    // instead of silently hiding console entry the user actually has.
    const degraded = { capabilities: capabilities.failed };

    return ok({
      status,
      profile: profiles.documents[0] ?? null,
      application: applications.documents[0] ?? null,
      membership: memberships.documents[0] ?? null,
      powers: powers.documents,
      departments: departments.documents,
      designations: designations.documents,
      allDepartments: allDepartments.documents,
      allDesignations: allDesignations.documents,
      allPowers: allPowers.documents,
      capabilities: Array.from(capabilities.set).sort(),
      degraded,
    });
  } catch (error) {
    logError("Permission lookup error:", error);

    return fail("INTERNAL", "Unable to load permissions", 500);
  }
}
