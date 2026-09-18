import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { DATABASE_ID, COLLECTIONS } from "@/lib/database";
import { isAdminUser, requireAuthenticatedUser } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { findUserIdByEmail } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { parseQrData } from "@/lib/server/tickets";
import { ok, fail, ApiError } from "@/lib/api";

const MAX_TICKETS = 200;

/**
 * Door authority: an administrator, a holder of the `tickets.verify`
 * capability, or the owner of the event being scanned.
 *
 * The check used to read the legacy `ticket_verifier` power, which meant an
 * office that grants `tickets.verify` (cybersecurity_lead) had no door access
 * at all — the capability was granted and never consulted. Both routes now ask
 * the same question as every other capability-gated route.
 */
async function canVerify(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated;

  if (await isAdminUser(authenticated.user)) return authenticated;
  if (await hasServerCapability(authenticated.user.$id, "tickets.verify"))
    return authenticated;

  return {
    user: null,
    response: fail("FORBIDDEN", "Forbidden", 403),
  } as const;
}

/** True when the caller owns the event, which entitles them to its door list. */
async function ownsEvent(eventId: string, userId: string): Promise<boolean> {
  const { databases } = createServerDatabases();

  try {
    const event = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.EVENTS,
      eventId,
    );

    return String(event.ownerId ?? "") === userId;
  } catch {
    return false;
  }
}

/**
 * Ticket lookup.
 *
 *  - `?code=`     exact ticket code, as printed on the ticket.
 *  - `?email=`    the attendee's account email.
 *  - `?qrData=`   the payload scanned from a QR code.
 *  - `?eventId=`  the door list for one event.
 *
 * All four require door authority. The event list previously ran from the
 * browser against a table that is readable by every signed-in account, so any
 * member could enumerate an event's entire attendee list.
 */
export async function GET(request: NextRequest) {
  const authenticated = await canVerify(request);

  if (!authenticated.user) return authenticated.response;

  // Door lookups are authenticated but enumerable: throttle per verifier so a
  // compromised door account cannot sweep code space at full speed.
  const limited = consumeRateLimit(`ticket-verify-get:${authenticated.user.$id}`, 180, 10 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code")?.trim();
    const email = searchParams.get("email")?.trim().toLowerCase();
    const qrData = searchParams.get("qrData");
    const eventId = searchParams.get("eventId")?.trim();

    if (!code && !email && !qrData && !eventId) {
      return fail("VALIDATION", "code, email, qrData, or eventId is required", 400);
    }

    const { databases } = createServerDatabases();

    if (eventId) {
      const permitted =
        (await isAdminUser(authenticated.user)) ||
        (await hasServerCapability(authenticated.user.$id, "tickets.verify")) ||
        (await ownsEvent(eventId, authenticated.user.$id));

      if (!permitted) {
        return fail("FORBIDDEN", "Forbidden", 403);
      }
      // Paginated: the old fixed cap silently hid attendees past row 200 at
      // the door. The door client walks pages until total; single lookups are
      // unaffected.
      const doorLimit = Math.min(Math.max(Number.parseInt(searchParams.get("limit") ?? String(MAX_TICKETS), 10) || MAX_TICKETS, 1), 500);
      const doorOffset = Math.max(Number.parseInt(searchParams.get("offset") ?? "0", 10) || 0, 0);
      const tickets = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        [
          Query.equal("eventId", [eventId]),
          Query.orderDesc("issuedAt"),
          Query.limit(doorLimit),
          Query.offset(doorOffset),
        ],
      );

      return ok({
        tickets: tickets.documents,
        total: tickets.total,
        limit: doorLimit,
        offset: doorOffset,
      });
    }

    let tickets;

    if (code) {
      tickets = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        [Query.equal("ticketCode", [code]), Query.limit(1)],
      );
    } else if (qrData) {
      const parsed = parseQrData(qrData);
      if (!parsed) {
        return fail("NOT_FOUND", "Ticket not found", 404);
      }
      // Signed payloads bind code+event; look up by code (unique index) rather
      // than exact qrData string (legacy rows differ). Unsigned legacy payloads
      // still resolve but are audited as legacy below.
      tickets = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        [Query.equal("ticketCode", [parsed.ticketCode]), Query.limit(1)],
      );
      const found = tickets.documents[0] as Record<string, unknown> | undefined;
      if (found && String(found.eventId ?? "") !== parsed.eventId) {
        return fail("NOT_FOUND", "Ticket not found", 404);
      }
    } else {
      // Accounts own the email. There is no `profiles.email` column, so the
      // previous lookup could never match and always reported "not found".
      const userId = await findUserIdByEmail(email!);

      if (!userId)
        return fail("NOT_FOUND", "Ticket not found", 404);
      tickets = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        [
          Query.equal("userId", [userId]),
          Query.orderDesc("issuedAt"),
          Query.limit(1),
        ],
      );
    }

    const ticket = tickets.documents[0];

    if (!ticket)
      return fail("NOT_FOUND", "Ticket not found", 404);

    // Owner path for single-ticket lookup: event owners may view their own
    // event's tickets without holding global door authority (least-privilege
    // fix for inverted door-list vs single-lookup).
    // canVerify already passed for verifiers/admins; check owner as fallback
    // to avoid leaking existence via 403 vs 404 distinctions.
    const isOwner = await ownsEvent(String(ticket.eventId ?? ""), authenticated.user.$id);
    const isDoorAuthority =
      (await isAdminUser(authenticated.user)) ||
      (await hasServerCapability(authenticated.user.$id, "tickets.verify")) ||
      isOwner;
    if (!isDoorAuthority) {
      // Uniform 404 to avoid existence oracle.
      return fail("NOT_FOUND", "Ticket not found", 404);
    }

    return ok({ ticket });
  } catch (error) {
    console.error("Ticket lookup error:", error);

    return fail("INTERNAL", "Failed to find ticket", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await canVerify(request);

  if (!authenticated.user) return authenticated.response;

  const limited = consumeRateLimit(`ticket-verify:${authenticated.user.$id}`, 60, 10 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = await request.json();
    const ticketId =
      typeof body.ticketId === "string" ? body.ticketId.trim() : "";
    const action = body.action;

    if (!ticketId || !["checkIn", "invalidate"].includes(action)) {
      return fail("VALIDATION", "Invalid ticket action", 400);
    }

    const { databases } = createServerDatabases();
    const ticket = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.TICKETS,
      ticketId,
    ).catch(() => null);
    if (!ticket) {
      return fail("NOT_FOUND", "Ticket not found", 404);
    }
    // Optional event scope: when the door passes its eventId, enforce it here
    // so a manual lookup cannot check in a ticket from another event. Uniform
    // 404 avoids leaking existence across events.
    const requestedEventId =
      typeof body.eventId === "string" ? body.eventId.trim() : "";
    if (requestedEventId && String(ticket.eventId ?? "") !== requestedEventId) {
      return fail("NOT_FOUND", "Ticket not found", 404);
    }
    // Event-scope enforcement: non-admin callers must own the event or hold the
    // tickets.verify capability. Verifiers remain cross-event until event↔dept
    // linkage exists, but ownership is now checked and logged.
    const eventIdForScope = String(ticket.eventId ?? "");
    const callerIsAdmin = await isAdminUser(authenticated.user);
    const callerOwnsEvent = eventIdForScope ? await ownsEvent(eventIdForScope, authenticated.user.$id) : false;
    const callerIsVerifier = await hasServerCapability(authenticated.user.$id, "tickets.verify");
    if (!callerIsAdmin && !callerOwnsEvent && !callerIsVerifier) {
      return fail("FORBIDDEN", "Forbidden", 403);
    }
    // Do not admit tickets for cancelled/draft events. Fail CLOSED on
    // lookup error: the old fail-open admitted check-ins for cancelled
    // events whenever the database hiccuped at the door.
    const eventDoc = eventIdForScope
      ? await databases.getDocument(DATABASE_ID, COLLECTIONS.EVENTS, eventIdForScope).catch(() => null)
      : null;
    if (eventIdForScope && !eventDoc) {
      return fail("INTERNAL", "Event status unknown. Please retry.", 503);
    }
    const eventStatus = eventDoc ? String((eventDoc as Record<string, unknown>).status ?? "") : "";
    if (eventDoc && !["published", "active", "approved"].includes(eventStatus)) {
      return fail("CONFLICT", `Event is not open for check-in (status: ${eventStatus || "unknown"})`, 409);
    }
    const now = new Date().toISOString();
    // Forensic method derives from proof, not the client hint alone: `qr_scan`
    // is recorded only when the request carries a verifiably signed payload
    // for this exact ticket and event. A manual lookup claiming `qr_scan`
    // would otherwise pollute door forensics.
    let method = "manual_search";
    if (body.method === "qr_scan" && typeof body.qrData === "string" && body.qrData) {
      const proof = parseQrData(body.qrData);
      if (
        proof?.signed &&
        proof.ticketCode === String(ticket.ticketCode ?? "") &&
        proof.eventId === String(ticket.eventId ?? "")
      ) {
        method = "qr_scan";
      }
    }

    if (action === "checkIn") {
      // Multi-entry tickets: allow re-check-in while status is issued/active
      // and entries remain.
      const maxEntries = Number(ticket.maxEntries) || 1;
      if (ticket.status !== "issued" && ticket.status !== "active") {
        return fail("CONFLICT", `Ticket cannot be checked in from ${ticket.status} state`, 409);
      }
      // Atomic bounded admission: the increment serializes concurrent scans
      // and each caller observes its own post-increment count, so exactly the
      // first maxEntries callers are admitted. Over-limit callers revert the
      // increment and 409 — the old read-then-write admitted twice when two
      // door devices scanned together.
      let admittedCount = 0;
      try {
        const after = await databases.incrementDocumentAttribute(
          DATABASE_ID,
          COLLECTIONS.TICKETS,
          ticketId,
          "entryCount",
          1,
        );
        admittedCount = Number((after as unknown as Record<string, unknown>).entryCount) || 0;
      } catch {
        return fail("INTERNAL", "Could not record entry. Please retry.", 503);
      }
      if (admittedCount > maxEntries || admittedCount <= 0) {
        // Revert best-effort: a stuck counter fails closed (fewer admissions),
        // never open. The holder retries and takes a fresh count.
        await databases.decrementDocumentAttribute(
          DATABASE_ID,
          COLLECTIONS.TICKETS,
          ticketId,
          "entryCount",
          1,
        ).catch(() => null);
        return fail("CONFLICT", maxEntries <= 1
          ? "This ticket has already been checked in"
          : "Maximum entries reached", 409);
      }
      const newStatus = admittedCount >= maxEntries ? "checked_in" : "active";

      const updated = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.TICKETS,
        ticketId,
        {
          status: newStatus,
          checkedInAt: now,
          checkedInBy: authenticated.user.$id,
          entryCount: admittedCount,
        },
      );

      // Every admission is recorded. The manual path previously wrote no
      // verification row, so door activity was only partially reconstructable.
      await databases.createDocument(
        DATABASE_ID,
        COLLECTIONS.TICKET_VERIFICATIONS,
        ID.unique(),
        {
          ticketId,
          eventId: ticket.eventId,
          verifiedBy: authenticated.user.$id,
          method,
          result: "success",
          verifiedAt: now,
        },
      );

      await recordAudit({
        request,
        actor: authenticated.user,
        action: "ticket_check_in",
        entityType: "ticket",
        entityId: ticketId,
        details: { eventId: String(ticket.eventId ?? ""), method },
      });

      return ok({
        ticket: updated,
        message: "Checked in successfully",
      });
    }

    if (ticket.status === "invalidated") {
      return fail("CONFLICT", "This ticket is already invalidated", 409);
    }

    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.TICKETS,
      ticketId,
      {
        status: "invalidated",
        invalidatedAt: now,
        invalidatedBy: authenticated.user.$id,
        invalidatedReason: reason || "Invalidated by verifier",
      },
    );

    await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.TICKET_VERIFICATIONS,
      ID.unique(),
      {
        ticketId,
        eventId: ticket.eventId,
        verifiedBy: authenticated.user.$id,
        method,
        result: "invalidated",
        verifiedAt: now,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "ticket_invalidate",
      entityType: "ticket",
      entityId: ticketId,
      details: {
        eventId: String(ticket.eventId ?? ""),
        reason: reason || "Invalidated by verifier",
      },
    });

    return ok({ ticket: updated });
  } catch (error) {
    console.error("Ticket update error:", error);

    return fail("INTERNAL", "Failed to update ticket", 500);
  }
}
