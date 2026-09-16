import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { createSignedTicket } from "@/lib/server/tickets";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

async function issueTicket(
  databases: ReturnType<typeof createAdminClient>["databases"],
  registration: Record<string, unknown>,
) {
  const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
    Query.equal("registrationId", [String(registration.$id)]),
    Query.limit(1),
  ]);
  if (existing.documents[0]) return existing.documents[0];

  // Same signed, clash-checked issuance as self-registration: admin approval
  // must not produce weaker (shorter, unsigned) tickets.
  return createSignedTicket(databases, {
    userId: String(registration.userId),
    eventId: String(registration.eventId),
    registrationId: String(registration.$id),
  });
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "registrations.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const eventId = new URL(request.url).searchParams.get("eventId")?.trim();
    if (!eventId) return fail("VALIDATION", "eventId is required", 400);

    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
      Query.equal("eventId", [eventId]),
      Query.orderDesc("registeredAt"),
      Query.limit(100),
    ]);
    return ok({ registrations: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin registration list error:", error);
    return fail("INTERNAL", "Unable to load registrations", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "registrations.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as { registrationId?: unknown; action?: unknown };
    const registrationId = typeof body.registrationId === "string" ? body.registrationId.trim() : "";
    const action = body.action;
    if (!registrationId || (action !== "approve" && action !== "reject")) {
      return fail("VALIDATION", "Invalid registration action", 400);
    }

    const { databases } = createAdminClient();
    const registration = await databases.getDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, registrationId);
    if (registration.status !== "pending") {
      return fail("CONFLICT", "Only pending registrations can be reviewed", 409);
    }

    if (action === "reject") {
      const updated = await databases.updateDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, registrationId, {
        status: "rejected",
        approvedBy: authenticated.user.$id,
        approvedAt: new Date().toISOString(),
      });
      await recordAudit({
        request,
        actor: authenticated.user,
        action: "registration.reject",
        entityType: "registration",
        entityId: registrationId,
        details: { eventId: String(registration.eventId ?? "") },
      });
      return ok({ registration: updated });
    }

    const updated = await databases.updateDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, registrationId, {
      status: "approved",
      approvedBy: authenticated.user.$id,
      approvedAt: new Date().toISOString(),
    });
    const ticket = await issueTicket(databases, updated);

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "registration.approve",
      entityType: "registration",
      entityId: registrationId,
      details: { eventId: String(updated.eventId ?? ""), ticketId: String((ticket as Record<string, unknown>).$id ?? "") },
    });
    return ok({ registration: updated, ticket });
  } catch (error) {
    console.error("Admin registration action error:", error);
    return fail("INTERNAL", "Unable to update registration", 500);
  }
}
