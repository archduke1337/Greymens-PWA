import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { isAdminUser, requireAuthenticatedUser } from "@/lib/server-auth";
import type { Models } from "appwrite";
import { ok, fail, ApiError } from "@/lib/api";

/**
 * Event type data is editable by the event owner, or by an administrator acting
 * on their behalf.
 *
 * The administrator test previously re-implemented the check by reading
 * `profiles.status` directly — a column that does not exist in the schema — so
 * it always evaluated to false and administrators could never edit an event they
 * did not own. It now delegates to the shared authorisation helper so the two
 * cannot drift apart again.
 */
async function getOwnedEvent(eventId: string, user: Models.User<Models.Preferences>) {
  const { databases } = createAdminClient();
  const event = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
  if (event.ownerId !== user.$id && !(await isAdminUser(user))) return null;
  return { databases, event };
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
  if (!eventId) return fail("VALIDATION", "eventId is required", 400);

  try {
    const owned = await getOwnedEvent(eventId, authenticated.user);
    if (!owned) return fail("FORBIDDEN", "Forbidden", 403);
    const response = await owned.databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, [
      Query.equal("eventId", [eventId]),
      Query.limit(1),
    ]);
    return ok({ data: response.documents[0] || null });
  } catch (error) {
    console.error("Event type data lookup error:", error);
    return fail("INTERNAL", "Unable to load event data", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as { eventId?: unknown; eventTypeId?: unknown; fieldData?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const eventTypeId = typeof body.eventTypeId === "string" ? body.eventTypeId.trim() : "";
    if (!eventId || !eventTypeId || !body.fieldData || typeof body.fieldData !== "object" || Array.isArray(body.fieldData)) {
      return fail("VALIDATION", "Invalid event type data", 400);
    }
    const fieldData = body.fieldData as Record<string, unknown>;
    if (Object.keys(fieldData).length > 100) return fail("VALIDATION", "Too many custom fields", 400);

    const owned = await getOwnedEvent(eventId, authenticated.user);
    if (!owned) return fail("FORBIDDEN", "Forbidden", 403);
    const existing = await owned.databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, [
      Query.equal("eventId", [eventId]),
      Query.limit(1),
    ]);
    const data = { eventId, eventTypeId, fieldData };
    const saved = existing.documents[0]
      ? await owned.databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, existing.documents[0].$id, { eventTypeId, fieldData })
      : await owned.databases.createDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, ID.unique(), data);
    return ok({ data: saved });
  } catch (error) {
    console.error("Event type data save error:", error);
    return fail("INTERNAL", "Unable to save event data", 500);
  }
}
