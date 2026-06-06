import { ID, Query } from "appwrite";
import { databases, APPWRITE_CONFIG } from "./appwrite";
import type { Ticket, TicketVerification } from "./types";

const { databaseId: DATABASE_ID } = APPWRITE_CONFIG;
const TICKETS_COLLECTION = "tickets";
const TICKET_VERIFICATIONS_COLLECTION = "ticket_verifications";

function generateTicketCode(eventIndex: number, ticketIndex: number): string {
  const evt = String(eventIndex).padStart(3, "0");
  const tkt = String(ticketIndex).padStart(3, "0");
  return `MM-EVT-${evt}-${tkt}`;
}

function generateQrData(): string {
  return `mm-ticket-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export const ticketService = {
  async generate(eventId: string, userId: string, registrationId: string, maxEntries = 1): Promise<Ticket> {
    // Check for existing ticket
    const existing = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("eventId", eventId), Query.equal("userId", userId), Query.limit(1)]
    );
    if (existing.documents.length > 0) {
      throw new Error("Ticket already exists for this user and event");
    }

    // Get ticket count for code generation
    const allTickets = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("eventId", eventId), Query.limit(1)]
    );

    const response = await databases.createDocument(
      DATABASE_ID,
      TICKETS_COLLECTION,
      ID.unique(),
      {
        eventId,
        userId,
        registrationId,
        ticketCode: generateTicketCode(1, allTickets.total + 1),
        qrData: generateQrData(),
        status: "issued",
        issuedAt: new Date().toISOString(),
        entryCount: 0,
        maxEntries,
      }
    );
    return response as unknown as Ticket;
  },

  async getByUser(userId: string): Promise<Ticket[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("userId", userId), Query.orderDesc("$createdAt")]
    );
    return response.documents as unknown as Ticket[];
  },

  async getByEvent(eventId: string): Promise<Ticket[]> {
    const response = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("eventId", eventId), Query.orderDesc("$createdAt")]
    );
    return response.documents as unknown as Ticket[];
  },

  async getById(ticketId: string): Promise<Ticket | null> {
    try {
      const response = await databases.getDocument(DATABASE_ID, TICKETS_COLLECTION, ticketId);
      return response as unknown as Ticket;
    } catch {
      return null;
    }
  },

  async getByQrData(qrData: string): Promise<Ticket | null> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        TICKETS_COLLECTION,
        [Query.equal("qrData", qrData), Query.limit(1)]
      );
      return (response.documents[0] as unknown as Ticket) || null;
    } catch {
      return null;
    }
  },

  async checkIn(ticketId: string, verifierId: string, method: "qr_scan" | "manual_search"): Promise<{ success: boolean; message: string }> {
    const ticket = await this.getById(ticketId);
    if (!ticket) return { success: false, message: "Ticket not found" };
    if (ticket.status === "checked_in") return { success: false, message: "Already checked in" };
    if (ticket.status === "invalidated") return { success: false, message: "Ticket is invalidated" };
    if (ticket.status !== "issued" && ticket.status !== "active") {
      return { success: false, message: `Cannot check in with status: ${ticket.status}` };
    }
    if (ticket.entryCount >= ticket.maxEntries) {
      return { success: false, message: "Maximum entries reached" };
    }

    await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION, ticketId, {
      status: "checked_in",
      checkedInAt: new Date().toISOString(),
      checkedInBy: verifierId,
      entryCount: ticket.entryCount + 1,
    });

    // Log verification
    await databases.createDocument(
      DATABASE_ID,
      TICKET_VERIFICATIONS_COLLECTION,
      ID.unique(),
      {
        ticketId,
        eventId: ticket.eventId,
        verifiedBy: verifierId,
        method,
        result: "success",
        verifiedAt: new Date().toISOString(),
      }
    );

    return { success: true, message: "Checked in successfully" };
  },

  async invalidate(ticketId: string, reason: string): Promise<void> {
    await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION, ticketId, {
      status: "invalidated",
      invalidatedAt: new Date().toISOString(),
      invalidatedReason: reason,
    });
  },

  async setActive(eventId: string): Promise<void> {
    const tickets = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("eventId", eventId), Query.equal("status", "issued")]
    );
    for (const doc of tickets.documents) {
      await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION, doc.$id, { status: "active" });
    }
  },

  async setCompleted(eventId: string): Promise<void> {
    const tickets = await databases.listDocuments(
      DATABASE_ID,
      TICKETS_COLLECTION,
      [Query.equal("eventId", eventId), Query.equal("status", "checked_in")]
    );
    for (const doc of tickets.documents) {
      await databases.updateDocument(DATABASE_ID, TICKETS_COLLECTION, doc.$id, { status: "completed" });
    }
  },

  async getEventStats(eventId: string): Promise<{ total: number; issued: number; checkedIn: number; invalidated: number }> {
    const [total, issued, checkedIn, invalidated] = await Promise.all([
      databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION, [Query.equal("eventId", eventId), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION, [Query.equal("eventId", eventId), Query.equal("status", "issued"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION, [Query.equal("eventId", eventId), Query.equal("status", "checked_in"), Query.limit(1)]),
      databases.listDocuments(DATABASE_ID, TICKETS_COLLECTION, [Query.equal("eventId", eventId), Query.equal("status", "invalidated"), Query.limit(1)]),
    ]);
    return { total: total.total, issued: issued.total, checkedIn: checkedIn.total, invalidated: invalidated.total };
  },
};
