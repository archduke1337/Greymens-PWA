import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { getEffectiveCapabilities } from "@/lib/access-control";
import { ok, fail, ApiError } from "@/lib/api";

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
    const { databases } = createAdminClient();
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
      getMembershipStatus(authenticated.user),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [Query.equal("userId", [userId]), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [Query.equal("userId", [userId]), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [Query.equal("userId", [userId]), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [Query.equal("userId", [userId]), Query.equal("isActive", [true]), Query.limit(own.limit)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [Query.equal("userId", [userId]), Query.equal("isActive", [true]), Query.limit(own.limit)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [Query.equal("userId", [userId]), Query.equal("isActive", [true]), Query.limit(own.limit)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [Query.equal("isActive", [true]), Query.orderAsc("displayOrder"), Query.limit(200)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [Query.equal("isActive", [true]), Query.orderAsc("level"), Query.limit(200)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.POWERS, [Query.orderAsc("category"), Query.limit(200)]),
      getEffectiveCapabilities(userId),
    ]);

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
      capabilities: Array.from(capabilities).sort(),
    });
  } catch (error) {
    console.error("Permission lookup error:", error);
    return fail("INTERNAL", "Unable to load permissions", 500);
  }
}
