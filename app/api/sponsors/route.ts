import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/** Public sponsor catalogue; mutation belongs exclusively to /api/admin/sponsors. */
export async function GET(_request: NextRequest) {
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SPONSORS,
      [
        Query.equal("isActive", [true]),
        Query.orderAsc("displayOrder"),
        Query.limit(100),
      ],
    );

    // `endDate` is the other half of "is this sponsor current": a deal that
    // lapsed months ago stayed on the wall until someone manually flipped
    // isActive. Filtered in code so a row with an unparseable date keeps
    // showing rather than vanishing on a typo.
    const now = Date.now();
    const sponsors = (response.documents as Array<{ endDate?: string }>).filter(
      (sponsor) => {
        if (!sponsor.endDate) return true;
        const endsAt = new Date(sponsor.endDate).getTime();

        return Number.isNaN(endsAt) || endsAt >= now;
      },
    );

    return ok({ sponsors });
  } catch (error) {
    logError("Public sponsor lookup error:", error);

    return fail("INTERNAL", "Unable to load sponsors", 500);
  }
}
