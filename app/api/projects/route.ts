import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { ok, fail, ApiError } from "@/lib/api";

const MAX_LIMIT = 100;
const VALID_CATEGORIES = new Set(["ai-ml", "blockchain", "mobile", "web", "iot", "quantum"]);

/** Public project catalogue; privileged Appwrite access remains server-side. */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const limitValue = Number(request.nextUrl.searchParams.get("limit"));
  const limit = Number.isFinite(limitValue) && limitValue > 0
    ? Math.min(MAX_LIMIT, Math.floor(limitValue))
    : MAX_LIMIT;

  if (category && category !== "all" && !VALID_CATEGORIES.has(category)) {
    return fail("VALIDATION", "Invalid project category", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const queries = [
      ...(category && category !== "all" ? [Query.equal("category", [category])] : []),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ];
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, queries);
    // ok() spreads the payload top-level too, so this keeps the exact
    // { success, data, projects, total } shape clients already read.
    return ok({ projects: response.documents, total: response.total }, 200, { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" });
  } catch (error) {
    console.error("Public project lookup error:", error);
    return fail("INTERNAL", "Unable to load projects", 500);
  }
}
