import { describe, expect, it, vi } from "vitest";
import {
  createSignedTicket,
  generateTicketCode,
  parseQrData,
  signTicket,
} from "@/lib/server/tickets";

// Deterministic test secret (server-only in prod via TICKET_HMAC_SECRET).
process.env.TICKET_HMAC_SECRET = "test-secret-0123456789abcdef";

describe("ticket HMAC", () => {
  it("signs and verifies round-trip", () => {
    const qr = signTicket("MM-ABCDEF123456", "evt1");
    const parsed = parseQrData(qr);
    expect(parsed).not.toBeNull();
    expect(parsed?.ticketCode).toBe("MM-ABCDEF123456");
    expect(parsed?.signed).toBe(true);
  });
  it("rejects forged payloads", () => {
    expect(parseQrData(JSON.stringify({ ticketCode: "MM-X", eventId: "evt1", sig: "00" }))).toBeNull();
    expect(parseQrData("not-json")).toBeNull();
    expect(parseQrData(JSON.stringify({ ticketCode: "", eventId: "" }))).toBeNull();
  });
  it("accepts legacy unsigned for migration", () => {
    const parsed = parseQrData(JSON.stringify({ ticketCode: "MM-X", eventId: "evt1" }));
    expect(parsed?.signed).toBe(false);
  });
  it("fails closed when no secret is configured", async () => {
    const savedHmac = process.env.TICKET_HMAC_SECRET;
    const savedApiKey = process.env.APPWRITE_API_KEY;
    delete process.env.TICKET_HMAC_SECRET;
    delete process.env.APPWRITE_API_KEY;
    try {
      expect(() => signTicket("MM-X", "evt1")).toThrow();
      // A signed payload that cannot be verified must be rejected, not
      // downgraded to the unsigned path.
      expect(
        parseQrData(
          JSON.stringify({ ticketCode: "MM-X", eventId: "evt1", sig: "aa" }),
        ),
      ).toBeNull();
    } finally {
      if (savedHmac !== undefined) process.env.TICKET_HMAC_SECRET = savedHmac;
      if (savedApiKey !== undefined) process.env.APPWRITE_API_KEY = savedApiKey;
    }
  });
});

describe("shared issuance", () => {
  it("generates 48-bit codes", () => {
    expect(generateTicketCode()).toMatch(/^MM-[0-9A-F]{12}$/);
  });
  it("persists a signed ticket row", async () => {
    const created: Array<Record<string, unknown>> = [];
    const databases = {
      listDocuments: vi.fn().mockResolvedValue({ documents: [] }),
      createDocument: vi
        .fn()
        .mockImplementation(
          async (
            _db: string,
            _table: string,
            _id: string,
            data: Record<string, unknown>,
          ) => {
            created.push(data);

            return { $id: "t1", ...data };
          },
        ),
    };
    const ticket = (await createSignedTicket(databases as never, {
      userId: "u1",
      eventId: "evt1",
      registrationId: "r1",
    })) as unknown as Record<string, unknown>;

    expect(String(ticket.ticketCode)).toMatch(/^MM-[0-9A-F]{12}$/);
    expect(parseQrData(String(ticket.qrData))?.signed).toBe(true);
    expect(ticket.status).toBe("issued");
    expect(created).toHaveLength(1);
  });
  it("throws when no unique code can be allocated", async () => {
    const databases = {
      listDocuments: vi.fn().mockResolvedValue({ documents: [{}] }),
      createDocument: vi.fn(),
    };

    await expect(
      createSignedTicket(databases as never, {
        userId: "u1",
        eventId: "evt1",
        registrationId: "r1",
      }),
    ).rejects.toThrow();
    expect(databases.createDocument).not.toHaveBeenCalled();
  });
});
