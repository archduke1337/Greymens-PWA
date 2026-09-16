import { describe, expect, it } from "vitest";
import { parseQrData, signTicket } from "@/lib/server/tickets";

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
});
