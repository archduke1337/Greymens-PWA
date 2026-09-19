import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { getEffectiveCapabilities } from "@/lib/access-control";
import { REVIEW_QUEUES } from "@/lib/capabilities";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Pending counts for the console sidebar badges.
 *
 * One request for every queue instead of the sidebar calling six list routes,
 * and each count is gated on the capability that can actually decide that
 * queue — REVIEW_QUEUES is the shared registry, so the badge and the nav entry
 * cannot disagree about who owns which queue.
 *
 * The pending predicate per queue. A failed count (e.g. a live table that
 * predates the reviewStatus column) drops that one badge rather than failing
 * the whole sidebar: an absent badge is a missing nicety, not an error.
 */
const PENDING_QUERIES: Record<
  string,
  { collection: string; queries: string[] }
> = {
  membership: {
    collection: COLLECTIONS.APPLICATIONS,
    queries: [Query.equal("status", ["pending"])],
  },
  events: {
    collection: COLLECTIONS.EVENTS,
    queries: [Query.equal("status", ["review"])],
  },
  blogs: {
    collection: COLLECTIONS.BLOGS,
    queries: [Query.equal("status", ["pending"])],
  },
  resources: {
    collection: COLLECTIONS.RESOURCES,
    queries: [Query.equal("status", ["pending"])],
  },
  gallery: {
    collection: COLLECTIONS.GALLERY,
    queries: [Query.equal("status", ["pending"])],
  },
  projects: {
    collection: COLLECTIONS.PROJECTS,
    queries: [Query.equal("reviewStatus", ["review"])],
  },
  sponsors: {
    collection: COLLECTIONS.SPONSORS,
    queries: [Query.equal("status", ["pending"])],
  },
};

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    // Capabilities resolved once: hasServerCapability per queue would re-read
    // the same role/office/power rows up to fourteen times per page nav.
    const capabilities = await getEffectiveCapabilities(authenticated.user.$id);
    const isAdmin = capabilities.has("*");
    const { databases } = createServerDatabases();
    const queues: Record<string, number> = {};

    await Promise.all(
      REVIEW_QUEUES.map(async (queue) => {
        const authorized =
          isAdmin || queue.capabilities.some((cap) => capabilities.has(cap));

        if (!authorized) return;

        const spec = PENDING_QUERIES[queue.key];

        if (!spec) return;
        // limit(1) because only `total` is wanted: the rows themselves are the
        // queue page's business, not the badge's.
        const count = await databases
          .listDocuments(DATABASE_ID, spec.collection, [
            ...spec.queries,
            Query.limit(1),
          ])
          .then((response) => response.total)
          .catch(() => null);

        if (count !== null) queues[queue.key] = count;
      }),
    );

    // Counts follow the caller's authority: never let a shared cache serve one
    // reviewer's queue sizes to another.
    return ok({ queues }, 200, { "Cache-Control": "private, no-store" });
  } catch (error) {
    logError("Review queue count error:", error);

    return fail("INTERNAL", "Unable to load queue counts", 500);
  }
}
