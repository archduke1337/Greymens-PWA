import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ID } from "appwrite";
import { ok, fail, ApiError } from "@/lib/api";

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
    const event = await databases.createDocument(DATABASE_ID, COLLECTIONS.EVENTS, ID.unique(), {
      title,
      slug,
      description,
      image: text("image", 500) || null,
      eventTypeId: text("eventTypeId", 36) || "general",
      status: "draft",
      audience: text("audience", 50) || "public",
      date,
      time,
      endDate: text("endDate", 30) || null,
      venue,
      location,
      capacity: Number.isInteger(body.capacity) ? body.capacity : 50,
      registered: 0,
      price: Number.isInteger(body.price) ? body.price : 0,
      discountPrice: Number.isInteger(body.discountPrice) ? body.discountPrice : null,
      organizerName: text("organizerName", 255) || authenticated.user.name || "Mind Mesh",
      organizerAvatar: text("organizerAvatar", 500) || null,
      ownerId: authenticated.user.$id,
      tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === "string").slice(0, 30) : [],
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
      const updates: Record<string, unknown> = {};
      for (const field of ["title", "description", "image", "date", "time", "endDate", "venue", "location", "audience", "price", "discountPrice", "capacity", "organizerName", "organizerAvatar", "tags", "isFeatured", "isPremium"]) {
        if (body[field as keyof typeof body] !== undefined) updates[field] = body[field as keyof typeof body];
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
