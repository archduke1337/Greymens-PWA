import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * GET /api/stats — homepage proof-strip counts in one request.
 *
 * Returns { upcomingEvents, projects, posts }. Projects and posts use
 * limit(1) and read `total`, so no document bodies cross the wire (the old
 * client fetched every published post body just to count it). Events keep
 * the same published/active query as /api/events and are counted for
 * upcoming dates server-side.
 */
export async function GET() {
  try {
    const { databases } = createServerDatabases();
    const [events, projects, posts] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [
        Query.equal("status", ["published", "active"]),
        Query.orderAsc("date"),
        Query.limit(100),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [
        Query.limit(1),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.BLOGS, [
        Query.equal("status", ["approved", "published"]),
        Query.limit(1),
      ]),
    ]);
    const now = Date.now();
    const upcomingEvents = (
      events.documents as Array<{ date?: string }>
    ).filter(
      (event) => !event.date || new Date(event.date).getTime() >= now,
    ).length;

    return ok({
      upcomingEvents,
      projects: projects.total,
      posts: posts.total,
    });
  } catch (error) {
    logError("Home stats error:", error);

    return fail("INTERNAL", "Unable to load stats", 500);
  }
}
