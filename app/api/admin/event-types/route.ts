import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const EDITABLE_EVENT_TYPE_FIELDS = [
  "name",
  "displayName",
  "description",
  "icon",
  "fields",
  "registrationConfig",
  "ticketConfig",
  "workflowConfig",
  "isActive",
  "displayOrder",
] as const;

// JSON-string columns consumed via safeParse downstream.
const JSON_COLUMNS = new Set([
  "fields",
  "registrationConfig",
  "ticketConfig",
  "workflowConfig",
]);

function pickEventTypeFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};

  for (const key of EDITABLE_EVENT_TYPE_FIELDS) {
    const value = body[key];

    if (value === undefined) continue;
    out[key] = value;
  }

  return out;
}

function validateEventType(body: Record<string, unknown>, forUpdate = false) {
  // Creates require identity; updates validate only the fields being changed
  // so partial edits stay possible.
  if (!forUpdate || body.name !== undefined) {
    if (
      typeof body.name !== "string" ||
      !body.name.trim() ||
      body.name.length > 100
    )
      return "Name is required";
  }
  if (!forUpdate || body.displayName !== undefined) {
    if (
      typeof body.displayName !== "string" ||
      !body.displayName.trim() ||
      body.displayName.length > 100
    )
      return "Display name is required";
  }
  if (
    body.description !== undefined &&
    (typeof body.description !== "string" || body.description.length > 65535)
  )
    return "Invalid description";
  if (
    body.icon !== undefined &&
    (typeof body.icon !== "string" || body.icon.length > 100)
  )
    return "Invalid icon";
  if (body.isActive !== undefined && typeof body.isActive !== "boolean")
    return "Invalid active flag";
  if (
    body.displayOrder !== undefined &&
    (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0)
  )
    return "Invalid display order";
  for (const key of JSON_COLUMNS) {
    const value = body[key];

    if (value === undefined) continue;
    if (typeof value !== "string" || value.length > 65535)
      return `Invalid ${key}`;
    if (value.trim()) {
      try {
        JSON.parse(value);
      } catch {
        return `Invalid ${key}: must be valid JSON`;
      }
    }
  }

  return null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EVENT_TYPES,
      [Query.orderAsc("displayOrder"), Query.limit(100)],
    );

    return ok({ eventTypes: response.documents, total: response.total });
  } catch (error) {
    logError("Admin event type list error:", error);

    return fail("INTERNAL", "Unable to load event types", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;

    if (body.action === "seed")
      return fail(
        "INTERNAL",
        "Event type seeding is not available in this deployment",
        501,
      );
    const fields = pickEventTypeFields(body);
    const validationError = validateEventType(fields);

    if (validationError) {
      return fail("VALIDATION", validationError, 400);
    }
    const { databases } = createServerDatabases();
    const eventType = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.EVENT_TYPES,
      ID.unique(),
      { isActive: true, displayOrder: 0, ...fields },
    );

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
    logError("Admin event type create error:", error);

    return fail("INTERNAL", "Unable to create event type", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const eventTypeId =
      typeof body.eventTypeId === "string" ? body.eventTypeId.trim() : "";

    if (!eventTypeId) return fail("VALIDATION", "eventTypeId is required", 400);
    const { eventTypeId: _eventTypeId, ...rest } = body;
    const data = pickEventTypeFields(rest);
    const validationError = validateEventType(data, true);

    if (validationError) {
      return fail("VALIDATION", validationError, 400);
    }
    const { databases } = createServerDatabases();
    const eventType = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.EVENT_TYPES,
      eventTypeId,
      data,
    );

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
    logError("Admin event type update error:", error);

    return fail("INTERNAL", "Unable to update event type", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "events.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const eventTypeId = new URL(request.url).searchParams
      .get("eventTypeId")
      ?.trim();

    if (!eventTypeId) return fail("VALIDATION", "eventTypeId is required", 400);
    const { databases } = createServerDatabases();
    // Deleting a type that events reference would orphan their eventTypeId —
    // deactivate instead, and say so.
    const inUse = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      [Query.equal("eventTypeId", [eventTypeId]), Query.limit(1)],
    );

    if (inUse.total > 0) {
      return fail(
        "CONFLICT",
        `Cannot delete: ${inUse.total} event(s) use this type. Deactivate it instead.`,
        409,
        { events: inUse.total },
      );
    }
    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.EVENT_TYPES,
      eventTypeId,
    );
    // Cascade: custom-field payloads stored against this type would otherwise
    // dangle with no template to validate or render them.
    const payloads = await databases
      .listDocuments(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, [
        Query.equal("eventTypeId", [eventTypeId]),
        Query.limit(100),
      ])
      .catch(() => ({ documents: [] as Array<{ $id: string }> }));

    await Promise.all(
      payloads.documents.map((row) =>
        databases
          .deleteDocument(DATABASE_ID, COLLECTIONS.EVENT_TYPE_DATA, row.$id)
          .catch((error: unknown) =>
            logError("Event type cascade error:", error),
          ),
      ),
    );
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
    logError("Admin event type delete error:", error);

    return fail("INTERNAL", "Unable to delete event type", 500);
  }
}
