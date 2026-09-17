import { NextRequest, NextResponse } from "next/server";
import { createServerDatabases } from "@/lib/appwrite-server";
import { DATABASE_ID, COLLECTIONS } from "@/lib/database";
import { Query } from "appwrite";
import { getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { ok, fail } from "@/lib/api";

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();
    const profiles = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    const profile = profiles.documents[0] as Record<string, unknown> | undefined;
    // Derived, not read straight off the profile: membership and designation
    // records are what actually decide a member's standing.
    const status = await getMembershipStatus(authenticated.user);

    return ok({
      userId: authenticated.user.$id,
      status,
      profile: profile || null,
    });
  } catch (error) {
    console.error("Current user lookup error:", error);
    return fail("INTERNAL", "Unable to load current user", 500);
  }
}
