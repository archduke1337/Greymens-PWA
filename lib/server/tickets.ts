import { createHmac, timingSafeEqual } from "crypto";

/**
 * Signed ticket QR payloads (HMAC-SHA256).
 * qrData = JSON { ticketCode, eventId, sig } where sig covers ticketCode.eventId.
 * Secret: TICKET_HMAC_SECRET, fallback APPWRITE_API_KEY (server-only, never NEXT_PUBLIC).
 * Legacy unsigned { ticketCode, eventId } still verifies via ticketCode lookup
 * (migration window) but new issues are always signed.
 */

function secret(): string {
  return process.env.TICKET_HMAC_SECRET || process.env.APPWRITE_API_KEY || "";
}

export function signTicket(ticketCode: string, eventId: string): string {
  const s = secret();
  const data = `${ticketCode}.${eventId}`;
  const sig = s ? createHmac("sha256", s).update(data).digest("hex").slice(0, 32) : "unsigned";
  return JSON.stringify({ ticketCode, eventId, sig });
}

export function parseQrData(raw: string): { ticketCode: string; eventId: string; signed: boolean } | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const ticketCode = typeof o.ticketCode === "string" ? o.ticketCode : "";
    const eventId = typeof o.eventId === "string" ? o.eventId : "";
    if (!ticketCode || !eventId) return null;
    const sig = typeof o.sig === "string" ? o.sig : "";
    if (!sig) return { ticketCode, eventId, signed: false };
    const s = secret();
    if (!s) return { ticketCode, eventId, signed: false };
    const expected = createHmac("sha256", s).update(`${ticketCode}.${eventId}`).digest("hex").slice(0, 32);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return ok ? { ticketCode, eventId, signed: true } : null;
  } catch {
    return null;
  }
}
