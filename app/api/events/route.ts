import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { isAdminUser, requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, isConflict } from "@/lib/api";
import { isHttpUrl } from "@/lib/validation";
import { logError } from "@/lib/logger";

const AUDIENCES = new Set(["public", "member_only", "exclusive"]);
const STATUSES = new Set(["draft", "review"]);

function text(value: unknown, max: number, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    return null;

  return value.trim();
}

const EDITABLE_EVENT_FIELDS = [
  "title",
  "description",
  "image",
  "eventTypeId",
  "category",
  "status",
  "audience",
  "date",
  "time",
  "endDate",
  "venue",
  "location",
  "capacity",
  "price",
  "discountPrice",
  "organizerName",
  "organizerAvatar",
  "tags",
  "isFeatured",
  "isPremium",
] as const;

function pickEditableEventFields(body: Record<string, unknown>) {
  return Object.fromEntries(
    EDITABLE_EVENT_FIELDS.filter((field) => body[field] !== undefined).map(
      (field) => [field, body[field]],
    ),
  );
}

export async function GET(request: NextRequest) {
  try {
    const { databases } = createServerDatabases();
    const eventId = request.nextUrl.searchParams.get("eventId")?.trim();

    if (eventId) {
      const event = await databases.getDocument(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        eventId,
      );

      // Only registration-open states are public. "approved" is an internal
      // pipeline state: serving it advertises events nobody can register for.
      if (!["published", "active"].includes(String(event.status))) {
        return fail("NOT_FOUND", "Event not found", 404);
      }

      return ok({ event });
    }

    // A proposer's own drafts live nowhere public: without this scope an
    // author whose event is still in review cannot see it at all — the
    // console list needs events.manage, which proposers don't hold. Mirrors
    // the gallery's scope=mine and the blog author visibility.
    if (request.nextUrl.searchParams.get("scope")?.trim() === "mine") {
      const authenticated = await requireAuthenticatedUser(request);

      if (!authenticated.user) return authenticated.response;
      const mine = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        [
          Query.equal("ownerId", [authenticated.user.$id]),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ],
      );

      return ok({ events: mine.documents });
    }

    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      [
        Query.equal("status", ["published", "active"]),
        Query.orderAsc("date"),
        Query.limit(100),
      ],
    );

    return ok({ events: response.documents });
  } catch (error) {
    logError("Public event lookup error:", error);

    return fail("INTERNAL", "Unable to load events", 500);
  }
}

function validateEvent(body: Record<string, unknown>) {
  if (!text(body.title, 255, true) || !text(body.description, 65535, true))
    return "Title and description are required";
  if (!text(body.slug, 255, true) || !text(body.eventTypeId, 100, true))
    return "Event type and slug are required";
  if (
    !text(body.date, 30, true) ||
    !text(body.time, 30, true) ||
    !text(body.venue, 255, true) ||
    !text(body.location, 500, true)
  )
    return "Date, time, venue, and location are required";
  if (!AUDIENCES.has(String(body.audience))) return "Invalid audience";
  if (body.status !== undefined && !STATUSES.has(String(body.status)))
    return "Invalid event status";
  if (
    !Number.isInteger(body.capacity) ||
    Number(body.capacity) < 0 ||
    !Number.isInteger(body.price) ||
    Number(body.price) < 0
  )
    return "Invalid capacity or price";
  // Discount and avatar were silently dropped here while the admin path kept
  // them — same form, divergent persistence. Validate to the same rules so
  // both doors store the same event.
  if (
    body.discountPrice !== undefined &&
    body.discountPrice !== null &&
    (!Number.isInteger(body.discountPrice) ||
      Number(body.discountPrice) < 0 ||
      (Number(body.price) > 0 &&
        Number(body.discountPrice) >= Number(body.price)))
  )
    return "Invalid discount price";
  if (
    body.organizerAvatar !== undefined &&
    body.organizerAvatar !== null &&
    body.organizerAvatar !== "" &&
    !isHttpUrl(String(body.organizerAvatar))
  )
    return "Invalid organizer avatar URL";
  if (
    body.image !== undefined &&
    body.image !== null &&
    body.image !== "" &&
    !isHttpUrl(String(body.image))
  )
    return "Invalid image URL";
  if (
    !Array.isArray(body.tags) ||
    !body.tags.every((tag) => typeof tag === "string" && tag.length <= 100)
  )
    return "Invalid tags";

  return null;
}

export async function POST(request: NextRequest) {
  // The self-service proposal path. The UI offers it to `events.create`
  // holders — the console nav item, the events page button and the create page
  // all check that capability, and the create page sends non-managers here
  // rather than to /api/admin/events. The endpoint used to ask for a
  // `lead`-or-above membership status instead, which after the designation
  // tier lift was retired resolves for nobody but an administrator: every
  // proposal from the people the button was shown to came back 403.
  const authenticated = await requireCapability(request, "events.create");

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const generatedSlug =
      typeof body.title === "string"
        ? body.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "")
            .slice(0, 255)
        : "";
    const payload: Record<string, unknown> = {
      ...pickEditableEventFields(body),
      slug: text(body.slug, 255) || generatedSlug,
    };
    const validationError = validateEvent(payload);

    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createServerDatabases();
    let event;

    try {
      event = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        ID.unique(),
        {
          ...payload,
          status: payload.status === "review" ? "review" : "draft",
          ownerId: authenticated.user.$id,
          organizerName:
            text(body.organizerName, 255) || authenticated.user.name,
          registered: 0,
        },
      );
    } catch (error) {
      // Lost the idx_slug race (same title, same millisecond): retry once
      // with a suffixed slug instead of 500ing the slower tap.
      if (!isConflict(error)) throw error;
      event = await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        ID.unique(),
        {
          ...payload,
          slug: `${String(payload.slug).slice(0, 240)}-${Date.now().toString(36)}`,
          status: payload.status === "review" ? "review" : "draft",
          ownerId: authenticated.user.$id,
          organizerName:
            text(body.organizerName, 255) || authenticated.user.name,
          registered: 0,
        },
      );
    }
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.create",
      entityType: "event",
      entityId: event.$id,
      details: { title: String(payload.title ?? "") },
    });

    return ok({ event }, 201);
  } catch (error) {
    logError("Event creation error:", error);

    return fail("INTERNAL", "Unable to create event", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";

    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    const { databases } = createServerDatabases();
    const current = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      eventId,
    );
    const rawData = pickEditableEventFields(body);
    const data = { ...rawData, slug: text(rawData.slug, 255) || current.slug };
    const validationError = validateEvent({ ...current, ...data });

    if (validationError) return fail("VALIDATION", validationError, 400);
    const admin = await isAdminUser(authenticated.user);

    if (!admin && current.ownerId !== authenticated.user.$id) {
      return fail("FORBIDDEN", "You do not own this event", 403);
    }
    // Blog parity: an owner revising reviewed content sends it back through
    // review — otherwise "edit" silently rewrites approved or live events.
    // An administrator polishing copy keeps the status untouched.
    const resubmitted =
      !admin && !["draft", "review"].includes(String(current.status ?? ""));
    const event = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      eventId,
      resubmitted ? { ...data, status: "review" } : data,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.update",
      entityType: "event",
      entityId: eventId,
      details: { fields: Object.keys(data), resubmitted },
    });

    return ok({ event, resubmitted });
  } catch (error) {
    logError("Event update error:", error);

    return fail("INTERNAL", "Unable to update event", 500);
  }
}
