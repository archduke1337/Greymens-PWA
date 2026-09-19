import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAnyCapability } from "@/lib/access-control";
import { getAccountNames, searchUsersByName } from "@/lib/server-users";
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
 *
 * Name search needs the Users API: names live on the account, not on
 * `profiles` (that table deliberately has no name column), so a name query
 * fans out to `searchUsersByName` and the hits are joined back to profiles
 * for their URNs. The unified `candidates` list (`{ userId, name, urn }`)
 * is what assignment pickers render; the legacy `profiles` field is kept
 * for older readers.
 */

const PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

export async function GET(request: NextRequest) {
  // Department managers assign department members but do not necessarily
  // hold users.view — without the second grant the department console's own
  // member picker would 403 for exactly the people who need it.
  const authenticated = await requireAnyCapability(request, [
    "users.view",
    "departments.manage",
  ]);

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

    // Name hits come from the Users API (names live on the account), keyed
    // back to profiles for URNs. Profile rows found above keep their URNs;
    // name-only hits resolve theirs here so every candidate renders the same.
    const urnByUserId = new Map(
      documents.map((profile) => [
        String(profile.userId ?? ""),
        typeof profile.urn === "string" ? profile.urn : "",
      ]),
    );
    const nameHits = query ? await searchUsersByName(query, limit) : [];
    const nameUserIds = nameHits
      .map((hit) => hit.userId)
      .filter((userId) => !urnByUserId.has(userId));
    let extraProfiles: Array<Record<string, unknown>> = [];

    if (nameUserIds.length > 0) {
      try {
        const extra = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.PROFILES,
          [Query.equal("userId", nameUserIds), Query.limit(nameUserIds.length)],
        );

        extraProfiles = extra.documents as Array<Record<string, unknown>>;
      } catch {
        extraProfiles = [];
      }
    }
    for (const profile of extraProfiles) {
      urnByUserId.set(
        String(profile.userId ?? ""),
        typeof profile.urn === "string" ? profile.urn : "",
      );
    }

    const seen = new Set<string>();
    const candidates: Array<{ userId: string; name: string; urn: string }> = [];

    for (const profile of documents) {
      const userId = String(profile.userId ?? "");

      if (!userId || seen.has(userId)) continue;
      seen.add(userId);
      candidates.push({
        userId,
        name: "",
        urn: typeof profile.urn === "string" && profile.urn ? profile.urn : "",
      });
    }
    for (const hit of nameHits) {
      if (seen.has(hit.userId)) {
        const existing = candidates.find((c) => c.userId === hit.userId);

        if (existing && !existing.name) existing.name = hit.name;
        continue;
      }
      seen.add(hit.userId);
      candidates.push({
        userId: hit.userId,
        name: hit.name,
        urn: urnByUserId.get(hit.userId) ?? "",
      });
    }

    // Profile rows carry no name (names live on the account), so enrich
    // nameless candidates best-effort — a lookup failure leaves the URN/id
    // rendering, never fails the search.
    try {
      const names = await getAccountNames(
        candidates.filter((c) => !c.name).map((c) => c.userId),
      );

      for (const candidate of candidates) {
        if (!candidate.name) candidate.name = names.get(candidate.userId) ?? "";
      }
    } catch {
      // Nameless candidates still render with URN/id.
    }

    return ok({
      profiles: documents,
      candidates: candidates.slice(0, limit),
      total: profiles.total,
      limit,
      offset,
    });
  } catch (error) {
    logError("Admin member search error:", error);

    return fail("INTERNAL", "Unable to search members", 500);
  }
}
