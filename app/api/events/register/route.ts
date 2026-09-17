import { NextRequest } from "next/server";
import { createServerDatabases } from "@/lib/appwrite-server";
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
    const { databases } = createServerDatabases();
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

  // Hoisted (not block-scoped) so the duplicate-race handler in catch can
  // re-query the winning row.
  let eventId = "";

  try {
    // Step 1: validate payload.
    const body = (await request.json().catch(() => null)) as {
      eventId?: unknown;
    } | null;
    eventId = typeof body?.eventId === "string" ? body.eventId.trim() : "";
    if (!eventId) {
      return fail("VALIDATION", "eventId is required", 400);
    }

    // Step 2: restricted accounts cannot register for any event, including public.
    const callerStatus = await getMembershipStatus(authenticated.user);
    if (RESTRICTED_STATUSES.has(callerStatus)) {
      return fail("FORBIDDEN", "Forbidden", 403);
    }

    const { databases } = createServerDatabases();
    // Step 3: duplicate guard (unique idx_event_user is the backstop).
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
      Query.equal("eventId", [eventId]),
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    const existingRow = existing.documents[0] as Record<string, unknown> | undefined;
    const existingStatus = existingRow ? String(existingRow.status ?? "") : "";
    if (existingRow && existingStatus === "approved") {
      // Self-heal: a ticket-mint blip can leave approved-without-ticket.
      // Retry mints the missing ticket instead of 409ing a paying user.
      const issued = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
        Query.equal("registrationId", [String(existingRow.$id ?? "")]),
        Query.limit(1),
      ]);
      if (issued.documents.length === 0) {
        const ticket = await createSignedTicket(databases, {
          userId: authenticated.user.$id,
          eventId,
          registrationId: String(existingRow.$id ?? ""),
        });
        return ok({ registration: existingRow, status: "approved", ticket, recovered: true }, 200);
      }
      return fail("CONFLICT", "Already registered", 409);
    }
    if (existingRow && existingStatus === "pending") {
      return fail("CONFLICT", "Registration is awaiting approval", 409);
    }
    if (existingRow && existingStatus === "waitlisted") {
      return fail("CONFLICT", "You are on the waitlist for this event", 409);
    }
    // A rejected row is not a registration — the applicant resubmits through
    // the normal flow below by reviving the same row (no duplicate stack).
    const reviveRow = existingRow && existingStatus === "rejected" ? existingRow : null;
    if (existingRow && !reviveRow) {
      return fail("CONFLICT", "Already registered", 409);
    }

    // Step 4: load event.
    const event = await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventId);
    // Step 5: reject registration when the event date is past — datetime,
    // not just day, so a 9am event stops accepting at 9pm the same day.
    const eventDay = typeof event.date === "string" ? event.date.slice(0, 10) : "";
    const today = new Date().toISOString().slice(0, 10);
    if (eventDay && eventDay < today) {
      return fail("CONFLICT", "Event has ended", 409);
    }
    if (eventDay === today && typeof event.time === "string" && /^\d{2}:\d{2}/.test(event.time)) {
      const start = new Date(`${eventDay}T${event.time.slice(0, 5)}:00`);
      if (!Number.isNaN(start.getTime()) && start.getTime() <= Date.now()) {
        return fail("CONFLICT", "Event has already started", 409);
      }
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

    // Step 9: create registration row (or revive a rejected one in place —
    // the unique index forbids a second row for the pair).
    const registration = reviveRow
      ? await databases.updateDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, String(reviveRow.$id ?? ""), {
        registeredAt: new Date().toISOString(),
        status,
      })
      : await databases.createDocument(
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
        // Skip when a ticket already exists (revived rows, retries): minting
        // twice for one registration is how duplicates happen.
        const already = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
          Query.equal("registrationId", [registration.$id]),
          Query.limit(1),
        ]);
        ticket = already.documents[0] ?? null;
        if (!ticket) {
          ticket = await createSignedTicket(databases, {
            userId: authenticated.user.$id,
            eventId,
            registrationId: registration.$id,
          });
        }
      } catch {
        // The registration row is committed; a retry through this same
        // endpoint self-heals by minting the missing ticket (step 3).
        return fail("INTERNAL", "Registered, but the ticket could not be issued. Please retry — no new registration is created.", 503);
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
    // Duplicate-guard race: a concurrent double-submit can pass the step-3
    // check on both requests, and the loser hits the unique
    // registrations(eventId+userId) index. That is not a server failure — the
    // caller IS registered — so return the winning row instead of a 500 that
    // would read as "registration failed, try again" and invite a third tap.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === 409
    ) {
      try {
        const { databases: retryDb } = createServerDatabases();
        const existing = await retryDb.listDocuments(
          DATABASE_ID,
          COLLECTIONS.REGISTRATIONS,
          [
            Query.equal("eventId", [eventId]),
            Query.equal("userId", [authenticated.user.$id]),
            Query.limit(1),
          ],
        );
        const row = existing.documents[0] as
          | Record<string, unknown>
          | undefined;
        if (row) {
          const tickets = await retryDb.listDocuments(
            DATABASE_ID,
            COLLECTIONS.TICKETS,
            [
              Query.equal("registrationId", [String(row.$id ?? "")]),
              Query.limit(1),
            ],
          );
          return ok(
            {
              registration: row,
              status: String(row.status ?? "approved"),
              ticket: tickets.documents[0] ?? null,
              alreadyRegistered: true,
            },
            200,
          );
        }
      } catch {
        // Fall through to the generic failure below.
      }
    }
    console.error("Event registration error:", error);
    return fail("INTERNAL", "Failed to register for event", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  // Cancel/re-register cycling farms waitlist promotion and spams promotees:
  // same budget as registering.
  const limited = consumeRateLimit(`event-register:${authenticated.user.$id}`, 20, 10 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

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

    const { databases } = createServerDatabases();
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
        invalidatedBy: authenticated.user.$id,
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
          // Allocation failure reverts to waitlisted — an approved-without-
          // ticket row is invisible to every remediation flow, so never
          // leave one behind. The admin queue can approve waitlisted rows.
  try {
            // Guard against double promotion: two concurrent cancels can pick
            // the same oldest row. An existing ticket means someone already
            // promoted it — skip minting instead of duplicating.
            const minted = await databases.listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
              Query.equal("registrationId", [next.$id]),
              Query.limit(1),
            ]);
            if (minted.documents.length === 0) {
              await createSignedTicket(databases, {
                userId: String(next.userId),
                eventId,
                registrationId: next.$id,
              });
            }
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
            await databases.updateDocument(DATABASE_ID, COLLECTIONS.REGISTRATIONS, next.$id, {
              status: "waitlisted",
            }).catch(() => null);
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
