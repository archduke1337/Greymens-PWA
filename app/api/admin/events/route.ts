import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ID } from "appwrite";
import { ok, fail, ApiError } from "@/lib/api";
import { isHttpUrl } from "@/lib/validation";

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
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [Query.orderDesc("$createdAt"), Query.limit(100)]);
    return ok({ events: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin event list error:", error);
    return fail("INTERNAL", "Unable to load events", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const text = (key: string, max: number) => typeof body[key] === "string" ? String(body[key]).trim().slice(0, max) : "";
    const title = text("title", 255);
    const description = text("description", 65535);
    const date = text("date", 30);
    const time = text("time", 30);
    const venue = text("venue", 255);
    const location = text("location", 500);
    if (!title || !description || !date || !time || !venue || !location) {
      return fail("VALIDATION", "Title, description, date, time, venue, and location are required", 400);
    }
    const { databases } = createAdminClient();
    const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${Date.now()}`;
    const audience = text("audience", 50) || "public";
    if (!AUDIENCES.has(audience)) return fail("VALIDATION", "Invalid audience", 400);
    const capacity = toCount(body.capacity, 50, MAX_CAPACITY);
    const price = toCount(body.price, 0, MAX_PRICE);
    const discountRaw = body.discountPrice;
    const discountPrice =
      discountRaw === undefined || discountRaw === null
        ? null
        : toCount(discountRaw, 0, MAX_PRICE);
    if (capacity === null || price === null) return fail("VALIDATION", "Invalid capacity or price", 400);
    if (discountRaw !== undefined && discountRaw !== null && discountPrice === null) return fail("VALIDATION", "Invalid discount price", 400);
    if (discountPrice !== null && discountPrice >= price && price > 0) return fail("VALIDATION", "Discount price must be below price", 400);
    const image = text("image", 500);
    const organizerAvatar = text("organizerAvatar", 500);
    if ((image && !isHttpUrl(image)) || (organizerAvatar && !isHttpUrl(organizerAvatar))) return fail("VALIDATION", "Invalid image URL", 400);
    const event = await databases.createDocument(DATABASE_ID, COLLECTIONS.EVENTS, ID.unique(), {
      title,
      slug,
      description,
      image: image || null,
      eventTypeId: text("eventTypeId", 36) || "general",
      status: "draft",
      audience,
      date,
      time,
      endDate: text("endDate", 30) || null,
      venue,
      location,
      capacity,
      registered: 0,
      price,
      discountPrice,
      organizerName: text("organizerName", 255) || authenticated.user.name || "Greymens",
      organizerAvatar: organizerAvatar || null,
      ownerId: authenticated.user.$id,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").map((tag) => tag.trim().slice(0, 100)).filter(Boolean).slice(0, 30) : [],
      isFeatured: body.isFeatured === true,
      isPremium: body.isPremium === true,
    });
    await recordAudit({ request, actor: authenticated.user, action: "event.create", entityType: "event", entityId: event.$id, details: { title } });
    return ok({ event }, 201);
  } catch (error) {
    console.error("Admin event create error:", error);
    return fail("INTERNAL", "Unable to create event", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as { eventId?: unknown; action?: unknown; reason?: unknown };
    const eventId = typeof body.eventId === "string" ? body.eventId.trim() : "";
    const action = body.action;
    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    const { databases } = createAdminClient();

    if (action === "update") {
      const raw = body as Record<string, unknown>;
      const updates: Record<string, unknown> = {};
      const stringFields: Array<[string, number]> = [
        ["title", 255],
        ["description", 65535],
        ["image", 500],
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
        if (value === null && ["title", "description", "venue", "location"].includes(field)) {
          return fail("VALIDATION", `Invalid ${field}`, 400);
        }
        updates[field] = value;
      }
      if (raw.audience !== undefined) {
        if (typeof raw.audience !== "string" || !AUDIENCES.has(raw.audience)) return fail("VALIDATION", "Invalid audience", 400);
        updates.audience = raw.audience;
      }
      for (const field of ["image", "organizerAvatar"] as const) {
        if (typeof updates[field] === "string" && updates[field] && !isHttpUrl(updates[field] as string)) {
          return fail("VALIDATION", `Invalid ${field} URL`, 400);
        }
      }
      for (const field of ["capacity", "price", "discountPrice"] as const) {
        if (raw[field] === undefined) continue;
        // Explicit null clears the optional discount; capacity/price are
        // required counters and cannot be nulled.
        if (raw[field] === null) {
          if (field !== "discountPrice") return fail("VALIDATION", `Invalid ${field}`, 400);
          updates[field] = null;
          continue;
        }
        const max = field === "capacity" ? MAX_CAPACITY : MAX_PRICE;
        const parsed = toCount(raw[field], 0, max);
        if (parsed === null) return fail("VALIDATION", `Invalid ${field}`, 400);
        updates[field] = parsed;
      }
      if (raw.tags !== undefined) {
        if (!Array.isArray(raw.tags)) return fail("VALIDATION", "Invalid tags", 400);
        updates.tags = raw.tags
          .filter((tag): tag is string => typeof tag === "string")
          .map((tag) => tag.trim().slice(0, 100))
          .filter(Boolean)
          .slice(0, 30);
      }
      for (const field of ["isFeatured", "isPremium"] as const) {
        if (raw[field] === undefined) continue;
        if (typeof raw[field] !== "boolean") return fail("VALIDATION", `Invalid ${field}`, 400);
        updates[field] = raw[field];
      }
      if (typeof updates.title !== "string" || !updates.title.trim()) return fail("VALIDATION", "A valid title is required", 400);
      const event = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, updates);
      await recordAudit({ request, actor: authenticated.user, action: "event.update", entityType: "event", entityId: eventId, details: { fields: Object.keys(updates) } });
      return ok({ event });
    }

    if (!["approve", "reject", "publish"].includes(String(action))) {
      return fail("VALIDATION", "Invalid event action", 400);
    }
    const now = new Date().toISOString();
    const data = action === "approve"
      ? { status: "approved", approvedBy: authenticated.user.$id, approvedAt: now }
      : action === "publish"
        ? { status: "published", publishedAt: now }
        : { status: "cancelled", rejectionReason: typeof body.reason === "string" ? body.reason.slice(0, 2000) : "Rejected by administrator" };
    const event = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, data);
    await recordAudit({ request, actor: authenticated.user, action: `event.${String(action)}`, entityType: "event", entityId: eventId, details: { reason: body.reason ?? null } });
    return ok({ event });
  } catch (error) {
    console.error("Admin event lifecycle error:", error);
    return fail("INTERNAL", "Unable to update event", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json().catch(() => null) as { eventId?: unknown; past?: unknown } | null;
    const { databases } = createAdminClient();
    if (body?.past === true) {
      const today = new Date().toISOString().split("T")[0];
      const past = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENTS, [Query.lessThan("date", today), Query.limit(100)]);
      let deleted = 0;
      let skipped = 0;
      for (const event of past.documents) {
        const [regs, tix] = await Promise.all([
          databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [Query.equal("eventId", [event.$id]), Query.limit(1)]),
          databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [Query.equal("eventId", [event.$id]), Query.limit(1)]),
        ]);
        if (regs.total > 0 || tix.total > 0) { skipped += 1; continue; }
        await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EVENTS, event.$id);
        deleted += 1;
      }
      return ok({ deleted, skipped });
    }
    const eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    const [registrations, tickets] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [Query.equal("eventId", [eventId]), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [Query.equal("eventId", [eventId]), Query.limit(1)]),
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
    return ok({ success: true });
  } catch (error) {
    console.error("Admin event delete error:", error);
    return fail("INTERNAL", "Unable to delete event", 500);
  }
}
