import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/appwrite";
import { DATABASE_ID, COLLECTIONS } from "@/lib/database";
import { ID, Query } from "appwrite";
import { getMembershipStatus, isMemberStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { createSignedTicket } from "@/lib/server/tickets";
import { ok, fail, ApiError } from "@/lib/api";

const RESTRICTED_STATUSES = new Set(["banned", "suspended", "deactivated"]);

/**
 * The caller's own registrations and issued tickets.
 *
 * This replaces two client-side hacks: a `registeredEvents` array kept in
 * `localStorage` (which could drift from the database, be edited by the user,
 * and never reflected a ticket the door would accept) and a fabricated
 * `ticket_<eventId>` record holding a made-up ticket ID. Registration state now
 * comes from the same rows the scanner validates against.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createAdminClient();
    const [registrations, tickets] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
        Query.equal("userId", [authenticated.user.$id]),
        Query.limit(200),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
        Query.equal("userId", [authenticated.user.$id]),
        Query.limit(200),
      ]),
    ]);

    return ok({
      registrations: registrations.documents.map((registration) => ({
        eventId: registration.eventId,
        status: registration.status,
        registeredAt: registration.registeredAt,
      })),
      tickets: tickets.documents.map((ticket) => ({
        $id: ticket.$id,
        eventId: ticket.eventId,
        ticketCode: ticket.ticketCode,
        status: ticket.status,
        issuedAt: ticket.issuedAt,
      })),
    });
  } catch (error) {
    console.error("Registration lookup error:", error);
    return fail("INTERNAL", "Unable to load registrations", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  const limited = consumeRateLimit(`event-register:${authenticated.user.$id}`, 20, 10 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    // Step 1: validate payload.
    const { eventId } = await request.json();
    if (typeof eventId !== "string" || !eventId.trim()) {
      return fail("VALIDATION", "eventId is required", 400);
    }

    // Step 2: restricted accounts cannot register for any event, including public.
    const callerStatus = await getMembershipStatus(authenticated.user);
    if (RESTRICTED_STATUSES.has(callerStatus)) {
      return fail("FORBIDDEN", "Forbidden", 403);
    }

    const { databases } = createAdminClient();
    // Step 3: duplicate guard (unique idx_event_user is the backstop).
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
      Query.equal("eventId", [eventId]),
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    if (existing.documents.length > 0) {
      return fail("CONFLICT", "Already registered", 409);
    }

    // Step 4: load event.
    const event = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
    // Step 5: reject registration when the event date is past.
    const eventDay = typeof event.date === "string" ? event.date.slice(0, 10) : "";
    const today = new Date().toISOString().slice(0, 10);
    if (eventDay && eventDay < today) {
      return fail("CONFLICT", "Event has ended", 409);
    }
    // Step 6: event must be open for registration.
    if (event.status !== "published" && event.status !== "active") {
      return fail("CONFLICT", "This event is not open for registration", 409);
    }
    // Step 7: member-only / exclusive audience gate.
    if (event.audience === "member_only" || event.audience === "exclusive") {
      const membershipStatus = await getMembershipStatus(authenticated.user);
      if (!isMemberStatus(membershipStatus)) {
        return fail("FORBIDDEN", "This event is restricted to members", 403);
      }
    }

    // Step 8: resolve status (exclusive → pending approval, full → waitlist).
    const registered = Number(event.registered) || 0;
    const capacity = Number(event.capacity) || 0;
    let status: "approved" | "pending" | "waitlisted" = "approved";
    if (event.audience === "exclusive") status = "pending";
    else if (capacity > 0 && registered >= capacity) status = "waitlisted";

    // Step 9: create registration row.
    const registration = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.REGISTRATIONS,
      ID.unique(),
      {
        eventId,
        userId: authenticated.user.$id,
        registeredAt: new Date().toISOString(),
        status,
      }
    );

    // Step 10: approve path — issue ticket + bump counter (unchanged).
    let ticket = null;
    if (status === "approved") {
      try {
        ticket = await createSignedTicket(databases, {
          userId: authenticated.user.$id,
          eventId,
          registrationId: registration.$id,
        });
      } catch {
        return fail("INTERNAL", "Could not allocate ticket. Please retry.", 503);
      }

      await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, {
        registered: registered + 1,
      });
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.register",
      entityType: "registration",
      entityId: registration.$id,
      details: { eventId, status },
    });

    return ok({ registration, status, ticket }, 201);
  } catch (error) {
    console.error("Event registration error:", error);
    return fail("INTERNAL", "Failed to register for event", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    // Step 1: validate payload. The id travels on the query string — some
    // proxies and CDNs drop DELETE bodies — with a JSON-body fallback for
    // older clients.
    const queryEventId = request.nextUrl.searchParams.get("eventId")?.trim();
    let bodyEventId = "";
    if (!queryEventId) {
      const body = (await request.json().catch(() => null)) as { eventId?: unknown } | null;
      bodyEventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    }
    const eventId = queryEventId || bodyEventId;
    if (!eventId) {
      return fail("VALIDATION", "eventId is required", 400);
    }

    // Step 2: restricted accounts cannot cancel (no state change).
    const callerStatus = await getMembershipStatus(authenticated.user);
    if (RESTRICTED_STATUSES.has(callerStatus)) {
      return fail("FORBIDDEN", "Forbidden", 403);
    }

    const { databases } = createAdminClient();
    // Step 3: load caller's registration.
    const registrations = await databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
      Query.equal("eventId", [eventId]),
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    const registration = registrations.documents[0];
    if (!registration) return fail("NOT_FOUND", "Registration not found", 404);

    // Step 4: load event + block cancel after the event date passed.
    const eventForGuard = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId).catch(() => null);
    if (eventForGuard) {
      const eventDay = typeof eventForGuard.date === "string" ? eventForGuard.date.slice(0, 10) : "";
      const today = new Date().toISOString().slice(0, 10);
      if (eventDay && eventDay < today) {
        return fail("CONFLICT", "Event has ended", 409);
      }
    }

    // Step 5: delete registration row.
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, registration.$id);
    // Step 6: invalidate any tickets issued for this registration.
    const tickets = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
      Query.equal("eventId", [eventId]),
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(10),
    ]);
    await Promise.all(tickets.documents.map((ticket) =>
      databases.updateDocument(DATABASE_ID, COLLECTIONS.TICKETS, ticket.$id, {
        status: "invalidated",
        invalidatedAt: new Date().toISOString(),
        invalidatedReason: "Registration cancelled",
      })
    ));

    // Step 7: decrement counter + waitlist promotion when capacity frees.
    let promoted = false;
    if (registration.status === "approved") {
      const event = eventForGuard ?? await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
      const currentRegistered = Number(event.registered) || 0;
      const capacity = Number(event.capacity) || 0;
      const nextRegistered = Math.max(0, currentRegistered - 1);
      await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, {
        registered: nextRegistered,
      });
      // Step 8: if capacity freed, promote the oldest waitlisted registration.
      if (capacity > 0 && nextRegistered < capacity) {
        const waitlisted = await databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
          Query.equal("eventId", [eventId]),
          Query.equal("status", ["waitlisted"]),
          Query.orderAsc("registeredAt"),
          Query.limit(1),
        ]);
        const next = waitlisted.documents[0];
        if (next) {
          await databases.updateDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, next.$id, {
            status: "approved",
          });
          // Step 9: issue ticket for the promoted user (shared issuance).
          // Allocation failure skips the promotion but must not fail the
          // cancellation itself; the ticket can be issued from the admin queue.
          try {
            await createSignedTicket(databases, {
              userId: String(next.userId),
              eventId,
              registrationId: next.$id,
            });
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId, {
              registered: nextRegistered + 1,
            });
            promoted = true;
            // Step 10: audit the promotion.
            await recordAudit({
              request,
              actor: authenticated.user,
              action: "event.promote_waitlist",
              entityType: "registration",
              entityId: next.$id,
              details: { eventId, promotedUserId: String(next.userId ?? "") },
            });
          } catch (promotionError) {
            console.error("Waitlist promotion ticket error:", promotionError);
          }
        }
      }
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "event.cancel_registration",
      entityType: "registration",
      entityId: registration.$id,
      details: { eventId },
    });

    return ok({ success: true, promoted });
  } catch (error) {
    console.error("Event cancellation error:", error);
    return fail("INTERNAL", "Failed to cancel registration", 500);
  }
}
