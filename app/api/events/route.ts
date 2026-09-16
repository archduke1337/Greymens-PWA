import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getMembershipStatus, isAdminUser, isMemberStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { ok, fail, ApiError } from "@/lib/api";

const AUDIENCES = new Set(["public", "member_only", "exclusive"]);
const STATUSES = new Set(["draft", "review"]);

function text(value: unknown, max: number, required = false) {
  if (typeof value !== "string" || value.length > max || (required && !value.trim())) return null;
  return value.trim();
}

const EDITABLE_EVENT_FIELDS = [
  "title", "description", "image", "eventTypeId", "status", "audience", "date", "time", "endDate",
  "venue", "location", "capacity", "price", "organizerName", "tags", "isFeatured", "isPremium",
] as const;

function pickEditableEventFields(body: Record<string, unknown>) {
  return Object.fromEntries(EDITABLE_EVENT_FIELDS
    .filter((field) => body[field] !== undefined)
    .map((field) => [field, body[field]]));
}

export async function GET(request: NextRequest) {
  try {
    const { databases } = createAdminClient();
    const eventId = request.nextUrl.searchParams.get("eventId")?.trim();
    if (eventId) {
      const event = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
      if (!["published", "active", "approved"].includes(String(event.status))) {
        return fail("NOT_FOUND", "Event not found", 404);
      }
      return ok({ event });
    }

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [
      Query.equal("status", ["published", "active", "approved"]),
      Query.orderAsc("date"),
      Query.limit(100),
    ]);
    return ok({ events: response.documents });
  } catch (error) {
    console.error("Public event lookup error:", error);
    return fail("INTERNAL", "Unable to load events", 500);
  }
}

function validateEvent(body: Record<string, unknown>) {
  if (!text(body.title, 255, true) || !text(body.description, 65535, true)) return "Title and description are required";
  if (!text(body.slug, 255, true) || !text(body.eventTypeId, 100, true)) return "Event type and slug are required";
  if (!text(body.date, 30, true) || !text(body.time, 30, true) || !text(body.venue, 255, true) || !text(body.location, 500, true)) return "Date, time, venue, and location are required";
  if (!AUDIENCES.has(String(body.audience))) return "Invalid audience";
  if (body.status !== undefined && !STATUSES.has(String(body.status))) return "Invalid event status";
  if (!Number.isInteger(body.capacity) || Number(body.capacity) < 0 || !Number.isInteger(body.price) || Number(body.price) < 0) return "Invalid capacity or price";
  if (!Array.isArray(body.tags) || !body.tags.every((tag) => typeof tag === "string" && tag.length <= 100)) return "Invalid tags";
  return null;
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const status = await getMembershipStatus(authenticated.user);
  if (!isMemberStatus(status) || ["member", "core_member"].includes(status)) {
    return fail("FORBIDDEN", "Event creation requires lead access", 403);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const generatedSlug = typeof body.title === "string"
      ? body.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 255)
      : "";
    const payload: Record<string, unknown> = {
      ...pickEditableEventFields(body),
      slug: text(body.slug, 255) || generatedSlug,
    };
    const validationError = validateEvent(payload);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const event = await databases.createDocument(DATABASE_ID, COLLECTIONS.EVENTS, ID.unique(), {
      ...payload,
      status: payload.status === "review" ? "review" : "draft",
      ownerId: authenticated.user.$id,
      organizerName: text(body.organizerName, 255) || authenticated.user.name,
      registered: 0,
    });
    return ok({ event }, 201);
  } catch (error) {
    console.error("Event creation error:", error);
    return fail("INTERNAL", "Unable to create event", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    const { databases } = createAdminClient();
    const current = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
    const rawData = pickEditableEventFields(body);
    const data = { ...rawData, slug: text(rawData.slug, 255) || current.slug };
    const validationError = validateEvent({ ...current, ...data });
    if (validationError) return fail("VALIDATION", validationError, 400);
    const admin = await isAdminUser(authenticated.user);
    if (!admin && current.ownerId !== authenticated.user.$id) {
      return fail("FORBIDDEN", "You do not own this event", 403);
    }
    const event = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, data);
    return ok({ event });
  } catch (error) {
    console.error("Event update error:", error);
    return fail("INTERNAL", "Unable to update event", 500);
  }
}
