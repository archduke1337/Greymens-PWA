import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Administrative member search for governance assignment flows.
 *
 * The designation screen previously called `profileService.search` from the
 * browser, which fetched the first twenty profiles and filtered them in the
 * client — it ignored the query for everything past page one and required
 * `profiles` to be world-readable. This endpoint runs the same lookups
 * server-side behind `requireCapability` and paginates properly.
 */

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "users.view");

  if (!authenticated.user) return authenticated.response;

  try {
    const params = request.nextUrl.searchParams;
    const query = params.get("q")?.trim() ?? "";
    const rawLimit = Number(params.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(MAX_PAGE_SIZE, Math.floor(rawLimit))
        : PAGE_SIZE;
    const offsetRaw = Number(params.get("offset"));
    const offset =
      Number.isFinite(offsetRaw) && offsetRaw > 0
        ? Math.min(1000, Math.floor(offsetRaw))
        : 0;

    // Appwrite supports substring search only through its search attribute;
    // URN prefixes and user IDs are matched with prefix queries, which cover
    // the governance use case (paste a URN or account id, find the person).
    const queries = [Query.limit(limit), Query.offset(offset)];

    if (query) queries.push(Query.startsWith("urn", query));

    const { databases } = createServerDatabases();
    const profiles = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      queries,
    );

    // Fall back to a userId prefix when a URN search finds nothing, so pasting
    // an account id still works.
    let documents = profiles.documents;

    if (query && documents.length === 0) {
      const byUserId = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.PROFILES,
        [Query.startsWith("userId", query), Query.limit(limit)],
      );

      documents = byUserId.documents;
    }

    return ok({
      profiles: documents,
      total: profiles.total,
      limit,
      offset,
    });
  } catch (error) {
    logError("Admin member search error:", error);

    return fail("INTERNAL", "Unable to search members", 500);
  }
}
