import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.EVENT_TYPES, [Query.orderAsc("displayOrder"), Query.limit(100)]);
    return ok({ eventTypes: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin event type list error:", error);
    return fail("INTERNAL", "Unable to load event types", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    if (body.action === "seed") return fail("INTERNAL", "Event type seeding is not available in this deployment", 501);
    if (typeof body.name !== "string" || !body.name.trim() || typeof body.displayName !== "string" || !body.displayName.trim()) {
      return fail("VALIDATION", "Name and display name are required", 400);
    }
    const { databases } = createAdminClient();
    const eventType = await databases.createDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPES, ID.unique(), body);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event_type.create",
      entityType: "event_type",
      entityId: eventType.$id,
      details: {},
    });
    return ok({ eventType }, 201);
  } catch (error) {
    console.error("Admin event type create error:", error);
    return fail("INTERNAL", "Unable to create event type", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const eventTypeId = typeof body.eventTypeId === "string" ? body.eventTypeId.trim() : "";
    if (!eventTypeId) return fail("VALIDATION", "eventTypeId is required", 400);
    const { eventTypeId: _eventTypeId, ...data } = body;
    const { databases } = createAdminClient();
    const eventType = await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPES, eventTypeId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event_type.update",
      entityType: "event_type",
      entityId: eventTypeId,
      details: { fields: Object.keys(data) },
    });
    return ok({ eventType });
  } catch (error) {
    console.error("Admin event type update error:", error);
    return fail("INTERNAL", "Unable to update event type", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const eventTypeId = new URL(request.url).searchParams.get("eventTypeId")?.trim();
    if (!eventTypeId) return fail("VALIDATION", "eventTypeId is required", 400);
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPES, eventTypeId);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event_type.delete",
      entityType: "event_type",
      entityId: eventTypeId,
      details: {},
    });
    return ok({ success: true });
  } catch (error) {
    console.error("Admin event type delete error:", error);
    return fail("INTERNAL", "Unable to delete event type", 500);
  }
}
