import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAnyCapability, requireCapability } from "@/lib/access-control";
import { createSignedTicket } from "@/lib/server/tickets";
import { dispatchNotification } from "@/lib/notify";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { consumeRateLimit } from "@/lib/rate-limit";
import { logError } from "@/lib/logger";

async function issueTicket(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  registration: Record<string, unknown>,
) {
  const existing = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.TICKETS,
    [Query.equal("registrationId", [String(registration.$id)]), Query.limit(1)],
  );

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
  // Reading an event's registration list is `registrations.view` — the grant
  // community_lead and event_coordinator hold for running their own events.
  // Changing a registration is `registrations.manage`, checked on PATCH.
  // Listing used to demand the managing capability, so the two offices that
  // were chartered to see registrations could not open the list at all.
  const authenticated = await requireAnyCapability(request, [
    "registrations.view",
    "registrations.manage",
  ]);

  if (!authenticated.user) return authenticated.response;

  try {
    const params = new URL(request.url).searchParams;
    const eventId = params.get("eventId")?.trim();

    if (!eventId) return fail("VALIDATION", "eventId is required", 400);
    // Paginated: the old fixed limit(100) silently dropped review rows past
    // the first hundred. Client sends offset; total tells it when to stop.
    const limit = Math.min(
      Math.max(Number.parseInt(params.get("limit") ?? "100", 10) || 100, 1),
      200,
    );
    const offset = Math.max(
      Number.parseInt(params.get("offset") ?? "0", 10) || 0,
      0,
    );

    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.REGISTRATIONS,
      [
        Query.equal("eventId", [eventId]),
        Query.orderDesc("registeredAt"),
        Query.limit(limit),
        Query.offset(offset),
      ],
    );

    return ok({
      registrations: response.documents,
      total: response.total,
      limit,
      offset,
    });
  } catch (error) {
    logError("Admin registration list error:", error);

    return fail("INTERNAL", "Unable to load registrations", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(
    request,
    "registrations.manage",
  );

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `registrations-review:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = (await request.json()) as {
      registrationId?: unknown;
      action?: unknown;
    };
    const registrationId =
      typeof body.registrationId === "string" ? body.registrationId.trim() : "";
    const action = body.action;

    if (!registrationId || (action !== "approve" && action !== "reject")) {
      return fail("VALIDATION", "Invalid registration action", 400);
    }

    const { databases } = createServerDatabases();
    const registration = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.REGISTRATIONS,
      registrationId,
    );

    // Waitlisted rows are reviewable too: when capacity is raised, the
    // waitlist would otherwise rot with no human path to approve it.
    if (
      registration.status !== "pending" &&
      registration.status !== "waitlisted"
    ) {
      return fail(
        "CONFLICT",
        "Only pending or waitlisted registrations can be reviewed",
        409,
      );
    }

    if (action === "reject") {
      const updated = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.REGISTRATIONS,
        registrationId,
        {
          status: "rejected",
          approvedBy: authenticated.user.$id,
          approvedAt: new Date().toISOString(),
        },
      );
      // A silent rejection is undiscoverable: the event page mislabels
      // rejected rows, so the applicant gets an explicit notice instead.
      const eventTitle = await databases
        .getDocument(
          DATABASE_ID,
          COLLECTIONS.EVENTS,
          String(registration.eventId ?? ""),
        )
        .catch(() => null);

      await dispatchNotification({
        userId: String(registration.userId ?? ""),
        type: "event_update",
        title: "Registration decision",
        body: `Your registration for ${eventTitle ? String(eventTitle.title ?? "the event") : "the event"} was not approved.`,
      }).catch((error) => {
        // The rejection stands; only the notice failed. Log it rather than
        // letting a silent catch imply the applicant was told.
        logError("Registration rejection notification failed:", error);
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

    // Capacity is rechecked from a live count, not the stored counter: admin
    // approvals never bumped the counter, so it understates reality.
    const event = await databases
      .getDocument(
        DATABASE_ID,
        COLLECTIONS.EVENTS,
        String(registration.eventId ?? ""),
      )
      .catch(() => null);

    if (event) {
      const approved = await databases
        .listDocuments(DATABASE_ID, COLLECTIONS.REGISTRATIONS, [
          Query.equal("eventId", [String(registration.eventId ?? "")]),
          Query.equal("status", ["approved"]),
          Query.limit(1),
        ])
        .catch(() => ({ total: 0 }));
      const capacity = Number(event.capacity ?? 0);

      if (capacity > 0 && approved.total >= capacity) {
        return fail(
          "CONFLICT",
          "Event is at capacity. Raise capacity or wait for cancellations.",
          409,
        );
      }
    }
    const updated = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.REGISTRATIONS,
      registrationId,
      {
        status: "approved",
        approvedBy: authenticated.user.$id,
        approvedAt: new Date().toISOString(),
      },
    );
    const ticket = await issueTicket(databases, updated);
    // Approval used to be the only decision that reached nobody: a rejected
    // registration got a notice, an approved one got a ticket row the member
    // had no reason to know about. Tell them, with the ticket named, so
    // "am I in?" stops depending on logging in to look.
    const approvedEventTitle = event
      ? String(event.title ?? "the event")
      : "the event";
    const registrantId = String(updated.userId ?? "");

    if (registrantId) {
      await dispatchNotification({
        userId: registrantId,
        type: "event_update",
        title: "Registration approved",
        body: `Your registration for ${approvedEventTitle} was approved. Your ticket is ready in your dashboard.`,
      }).catch((error) => {
        logError("Registration approval notification failed:", error);
      });
    }

    // Keep the stored counter in step with manual approvals so full/waitlist
    // displays stop understating.
    if (event) {
      const current = Number(event.registered ?? 0);

      await databases
        .updateDocument(
          DATABASE_ID,
          COLLECTIONS.EVENTS,
          String(event.$id ?? ""),
          {
            registered: current + 1,
          },
        )
        .catch(() => null);
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "registration.approve",
      entityType: "registration",
      entityId: registrationId,
      details: {
        eventId: String(updated.eventId ?? ""),
        ticketId: String((ticket as Record<string, unknown>).$id ?? ""),
      },
    });

    return ok({ registration: updated, ticket });
  } catch (error) {
    logError("Admin registration action error:", error);

    return fail("INTERNAL", "Unable to update registration", 500);
  }
}
