import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { ID } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAnyCapability, requireCapability } from "@/lib/access-control";
import { dispatchNotification } from "@/lib/notify";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { isHttpUrl } from "@/lib/validation";
import { logError } from "@/lib/logger";

const AUDIENCES = new Set(["public", "member_only", "exclusive"]);

const MAX_CAPACITY = 100000;
const MAX_PRICE = 10000000;

function toOptionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) return null;

  return value.trim().slice(0, max);
}

function toCount(value: unknown, fallback: number, max: number): number | null {
  if (value === undefined || value === null) return fallback;
  if (!Number.isInteger(value) || Number(value) < 0 || Number(value) > max)
    return null;

  return Number(value);
}

export async function GET(request: NextRequest) {
  // Reviewers (approve/publish/update) need the queue as much as managers —
  // the sidebar admits them, so the list must too. Drafts are review
  // material, not secrets; nothing here reaches non-reviewers.
  const authenticated = await requireAnyCapability(request, [
    "events.manage",
    "events.approve",
    "events.publish",
    "events.update",
  ]);

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );

    return ok({ events: response.documents, total: response.total });
  } catch (error) {
    logError("Admin event list error:", error);

    return fail("INTERNAL", "Unable to load events", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const text = (key: string, max: number) =>
      typeof body[key] === "string"
        ? String(body[key]).trim().slice(0, max)
        : "";
    const title = text("title", 255);
    const description = text("description", 65535);
    const date = text("date", 30);
    const time = text("time", 30);
    const venue = text("venue", 255);
    const location = text("location", 500);

    if (!title || !description || !date || !time || !venue || !location) {
      return fail(
        "VALIDATION",
        "Title, description, date, time, venue, and location are required",
        400,
      );
    }
    const { databases } = createServerDatabases();
    const slug = `${title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${Date.now()}`;
    const audience = text("audience", 50) || "public";

    if (!AUDIENCES.has(audience))
      return fail("VALIDATION", "Invalid audience", 400);
    const capacity = toCount(body.capacity, 50, MAX_CAPACITY);
    const price = toCount(body.price, 0, MAX_PRICE);
    const discountRaw = body.discountPrice;
    // Appwrite rejects explicit null for optional columns: absent means
    // undefined (dropped from the payload), never null.
    const discountPrice =
      discountRaw === undefined || discountRaw === null
        ? undefined
        : toCount(discountRaw, 0, MAX_PRICE);

    if (capacity === null || price === null)
      return fail("VALIDATION", "Invalid capacity or price", 400);
    if (discountPrice === null)
      return fail("VALIDATION", "Invalid discount price", 400);
    if (discountPrice !== undefined && discountPrice >= price && price > 0)
      return fail("VALIDATION", "Discount price must be below price", 400);
    const image = text("image", 500);
    const organizerAvatar = text("organizerAvatar", 500);

    if (
      (image && !isHttpUrl(image)) ||
      (organizerAvatar && !isHttpUrl(organizerAvatar))
    )
      return fail("VALIDATION", "Invalid image URL", 400);
    const event = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      ID.unique(),
      {
        title,
        slug,
        description,
        image: image || undefined,
        eventTypeId: text("eventTypeId", 36) || "general",
        category: text("category", 50) || undefined,
        // Console-created events land as drafts unless the creator explicitly
        // filed them for review — the same draft/review choice the self-
        // service path offers, so the selector means the same thing on both.
        status: body.status === "review" ? "review" : "draft",
        audience,
        date,
        time,
        endDate: text("endDate", 30) || undefined,
        venue,
        location,
        capacity,
        registered: 0,
        price,
        discountPrice,
        organizerName:
          text("organizerName", 255) || authenticated.user.name || "Greymens",
        organizerAvatar: organizerAvatar || undefined,
        ownerId: authenticated.user.$id,
        tags: Array.isArray(body.tags)
          ? body.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().slice(0, 100))
              .filter(Boolean)
              .slice(0, 30)
          : [],
        isFeatured: body.isFeatured === true,
        isPremium: body.isPremium === true,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.create",
      entityType: "event",
      entityId: event.$id,
      details: { title },
    });

    return ok({ event }, 201);
  } catch (error) {
    logError("Admin event create error:", error);

    return fail("INTERNAL", "Unable to create event", 500);
  }
}

const PATCH_ACTIONS = new Set([
  "update",
  "approve",
  "reject",
  "publish",
  "cancel",
]);

/**
 * Event lifecycle, one capability per step.
 *
 * Every step used to sit behind a single `events.manage`, which meant `events.approve`
 * (president, vice_president) and `events.publish` (cto) were granted by offices and
 * checked by nothing — an officer could hold the capability their charter names and
 * still be refused the action. Each step now asks for its own, with `events.manage` as
 * the blanket alternative so managers and administrators lose nothing.
 */
export async function PATCH(request: NextRequest) {
  // Coarse gate first: the caller must hold some event-lifecycle capability before
  // the payload is even read. The narrow gate follows once we know the action.
  const authenticated = await requireAnyCapability(request, [
    "events.manage",
    "events.update",
    "events.approve",
    "events.publish",
  ]);

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as {
      eventId?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const action = String(body.action ?? "");

    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    if (!PATCH_ACTIONS.has(action))
      return fail("VALIDATION", "Invalid event action", 400);
    const { databases } = createServerDatabases();

    // ".user" is this module's answer to "was the gate satisfied": the 403 it
    // carries distinguishes a restricted account from a missing grant for us.
    const blanket =
      (await requireAnyCapability(request, ["events.manage"])).user !== null;

    if (action === "update") {
      if (!blanket) {
        const narrow = await requireAnyCapability(request, ["events.update"]);

        if (!narrow.user) return narrow.response;
        // events.update without events.manage is a coordinator's grant: it covers
        // the events they run, not every event on the platform. Ownership is the
        // same boundary /api/events PATCH draws for the self-service path.
        const current = await databases
          .getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId)
          .catch(() => null);

        if (!current) return fail("NOT_FOUND", "Event not found", 404);
        if (String(current.ownerId ?? "") !== authenticated.user.$id) {
          return fail("FORBIDDEN", "You can only edit events you own", 403);
        }
      }
      const raw = body as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      const stringFields: Array<[string, number]> = [
        ["title", 255],
        ["description", 65535],
        ["image", 500],
        ["category", 50],
        ["date", 30],
        ["time", 30],
        ["endDate", 30],
        ["venue", 255],
        ["location", 500],
        ["organizerName", 255],
        ["organizerAvatar", 500],
      ];

      for (const [field, max] of stringFields) {
        if (raw[field] === undefined) continue;
        const value = toOptionalText(raw[field], max);

        // Present-but-blank title/description/venue/location would blank a
        // required column; all other string columns clear to null.
        if (
          value === null &&
          ["title", "description", "venue", "location"].includes(field)
        ) {
          return fail("VALIDATION", `Invalid ${field}`, 400);
        }
        updates[field] = value;
      }
      if (raw.audience !== undefined) {
        if (typeof raw.audience !== "string" || !AUDIENCES.has(raw.audience))
          return fail("VALIDATION", "Invalid audience", 400);
        updates.audience = raw.audience;
      }
      for (const field of ["image", "organizerAvatar"] as const) {
        if (
          typeof updates[field] === "string" &&
          updates[field] &&
          !isHttpUrl(updates[field] as string)
        ) {
          return fail("VALIDATION", `Invalid ${field} URL`, 400);
        }
      }
      for (const field of ["capacity", "price", "discountPrice"] as const) {
        if (raw[field] === undefined) continue;
        // Explicit null clears the optional discount; capacity/price are
        // required counters and cannot be nulled.
        if (raw[field] === null) {
          if (field !== "discountPrice")
            return fail("VALIDATION", `Invalid ${field}`, 400);
          updates[field] = null;
          continue;
        }
        const max = field === "capacity" ? MAX_CAPACITY : MAX_PRICE;
        const parsed = toCount(raw[field], 0, max);

        if (parsed === null) return fail("VALIDATION", `Invalid ${field}`, 400);
        updates[field] = parsed;
      }
      if (raw.tags !== undefined) {
        if (!Array.isArray(raw.tags))
          return fail("VALIDATION", "Invalid tags", 400);
        updates.tags = raw.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 30);
      }
      for (const field of ["isFeatured", "isPremium"] as const) {
        if (raw[field] === undefined) continue;
        if (typeof raw[field] !== "boolean")
          return fail("VALIDATION", `Invalid ${field}`, 400);
        updates[field] = raw[field];
      }
      // A partial edit of an existing event (feature flag, capacity tweak)
      // must not have to resend the title — only a title that is actually
      // present and blank is invalid.
      if (updates.title !== undefined && !String(updates.title).trim())
        return fail("VALIDATION", "A valid title is required", 400);
      const event = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        eventId,
        updates,
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "event.update",
        entityType: "event",
        entityId: eventId,
        details: { fields: Object.keys(updates) },
      });

      return ok({ event });
    }

    if (!blanket) {
      // Each decision belongs to the capability its charter names: approving
      // and rejecting share events.approve, publishing and cancelling share
      // events.publish — pulling back something already live is the
      // publisher's call, not a second review.
      const narrow = await requireAnyCapability(request, [
        action === "publish" || action === "cancel"
          ? "events.publish"
          : "events.approve",
      ]);

      if (!narrow.user) return narrow.response;
    }
    const now = new Date().toISOString();
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "";

    if (action === "reject" || action === "cancel") {
      // The two verdicts apply to different phases of an event's life, so
      // check the phase before writing it. Rejecting a live event (or
      // cancelling a draft) would otherwise record a state transition that
      // never happened.
      const current = await databases
        .getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId)
        .catch(() => null);

      if (!current) return fail("NOT_FOUND", "Event not found", 404);
      const status = String(current.status ?? "");

      if (action === "reject" && !["draft", "review"].includes(status)) {
        return fail(
          "VALIDATION",
          "Only an unpublished event can be rejected",
          400,
        );
      }
      if (
        action === "cancel" &&
        !["approved", "published", "active"].includes(status)
      ) {
        return fail(
          "VALIDATION",
          "Only an approved or published event can be cancelled",
          400,
        );
      }
    }
    const data =
      action === "approve"
        ? {
            status: "approved",
            approvedBy: authenticated.user.$id,
            approvedAt: now,
          }
        : action === "publish"
          ? { status: "published", publishedAt: now }
          : action === "reject"
            ? {
                status: "rejected",
                rejectionReason: reason || "Rejected by administrator",
                approvedBy: null,
                approvedAt: null,
              }
            : {
                status: "cancelled",
                cancellationReason: reason || "Cancelled by administrator",
                cancelledAt: now,
              };
    const event = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      eventId,
      data,
    );

    // Blog-style review loop, closed: the organizer learns the decision even
    // if they never open the console — in-app row plus automatic mail via
    // the central dispatch. A missing owner (legacy rows) skips silently.
    const ownerId = String(event.ownerId ?? "");
    const eventTitle = String(event.title ?? "your event");

    if (ownerId) {
      const decision =
        action === "approve"
          ? {
              title: "Event approved",
              body: `"${eventTitle}" was approved and is queued for publishing.`,
            }
          : action === "publish"
            ? {
                title: "Event published",
                body: `"${eventTitle}" is now publicly visible and open for registration.`,
              }
            : action === "reject"
              ? {
                  title: "Event not approved",
                  body: `"${eventTitle}" was not approved. Reason: ${reason || "no reason given"}`,
                }
              : {
                  title: "Event cancelled",
                  body: `"${eventTitle}" was cancelled.${reason ? ` Reason: ${reason}` : ""}`,
                };

      await dispatchNotification({
        userId: ownerId,
        type: "event_update",
        ...decision,
      }).catch((error) => {
        // The decision stands either way, but a swallowed failure here is
        // indistinguishable from "the organizer was notified". Log it.
        logError("Event decision notification failed:", error);
      });
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: `event.${String(action)}`,
      entityType: "event",
      entityId: eventId,
      details: { reason: body.reason ?? null },
    });

    return ok({ event });
  } catch (error) {
    logError("Admin event lifecycle error:", error);

    return fail("INTERNAL", "Unable to update event", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json().catch(() => null)) as {
      eventId?: unknown;
      past?: unknown;
    } | null;
    const { databases } = createServerDatabases();

    if (body?.past === true) {
      const today = new Date().toISOString().split("T")[0];
      const past = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        [Query.lessThan("date", today), Query.limit(100)],
      );
      let deleted = 0;
      let skipped = 0;

      for (const event of past.documents) {
        const [regs, tix] = await Promise.all([
          databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
            Query.equal("eventId", [event.$id]),
            Query.limit(1),
          ]),
          databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
            Query.equal("eventId", [event.$id]),
            Query.limit(1),
          ]),
        ]);

        if (regs.total > 0 || tix.total > 0) {
          skipped += 1;
          continue;
        }
        await databases.deleteDocument(
          DATABASE_ID,
          COLLECTIONS.EVENTS,
          event.$id,
        );
        await recordAudit({
          request,
          actor: authenticated.user,
          action: "event.delete",
          entityType: "event",
          entityId: event.$id,
          details: { bulkPast: true },
        });
        deleted += 1;
      }

      return ok({ deleted, skipped });
    }
    const eventId =
      typeof body?.eventId === "string" ? body.eventId.trim() : "";

    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    const [registrations, tickets] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
        Query.equal("eventId", [eventId]),
        Query.limit(1),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
        Query.equal("eventId", [eventId]),
        Query.limit(1),
      ]),
    ]);

    if (registrations.total > 0 || tickets.total > 0) {
      return fail(
        "CONFLICT",
        `Cannot delete event with ${registrations.total} registration(s) and ${tickets.total} ticket(s)`,
        409,
        { registrations: registrations.total, tickets: tickets.total },
      );
    }
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
    // Cascade: custom-field payloads and gallery rows keyed to this event
    // would otherwise dangle forever with no parent to resolve against.
    // Bounded per table; failures are logged, not fatal, so one stuck child
    // table cannot block the delete itself.
    const [typeData, galleryRows] = await Promise.all([
      databases
        .listDocuments(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, [
          Query.equal("eventId", [eventId]),
          Query.limit(100),
        ])
        .catch(() => ({ documents: [] as Array<{ $id: string }> })),
      databases
        .listDocuments(DATABASE_ID, COLLECTIONS.GALLERY, [
          Query.equal("eventId", [eventId]),
          Query.limit(100),
        ])
        .catch(() => ({ documents: [] as Array<{ $id: string }> })),
    ]);

    await Promise.all([
      ...typeData.documents.map((row) =>
        databases
          .deleteDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, row.$id)
          .catch((error: unknown) =>
            logError("Event cascade (type data) error:", error),
          ),
      ),
      ...galleryRows.documents.map((row) =>
        databases
          .deleteDocument(DATABASE_ID, COLLECTIONS.GALLERY, row.$id)
          .catch((error: unknown) =>
            logError("Event cascade (gallery) error:", error),
          ),
      ),
    ]);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.delete",
      entityType: "event",
      entityId: eventId,
    });

    return ok({ success: true });
  } catch (error) {
    logError("Admin event delete error:", error);

    return fail("INTERNAL", "Unable to delete event", 500);
  }
}
