import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { ok, fail, ApiError } from "@/lib/api";

/** Public sponsor catalogue; mutation belongs exclusively to /api/admin/sponsors. */
export async function GET(_request: NextRequest) {
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SPONSORS, [
      Query.equal("isActive", [true]),
      Query.orderAsc("displayOrder"),
      Query.limit(100),
    ]);
    return ok({ sponsors: response.documents });
  } catch (error) {
    console.error("Public sponsor lookup error:", error);
    return fail("INTERNAL", "Unable to load sponsors", 500);
  }
}
