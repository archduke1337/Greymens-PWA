import type { ServerDatabases } from "@/lib/appwrite-server";

import { createHmac, timingSafeEqual } from "crypto";

import { ID, Query } from "appwrite";

import { COLLECTIONS, DATABASE_ID } from "@/lib/database";

/**
 * Signed ticket QR payloads (HMAC-SHA256).
 * qrData = JSON { ticketCode, eventId, sig } where sig covers ticketCode.eventId.
 *
 * Secret: TICKET_HMAC_SECRET only. An earlier revision fell back to
 * APPWRITE_API_KEY, collapsing key separation (a leaked signing key would be
 * the master API key and vice versa). Signing fails closed without the
 * dedicated secret; verification still accepts the old fallback so tickets
 * issued before the split keep scanning, and every re-issue migrates forward.
 * Legacy unsigned { ticketCode, eventId } still verifies via ticketCode lookup
 * (migration window) but new issues are always signed.
 */

function signingSecret(): string {
  return process.env.TICKET_HMAC_SECRET || "";
}

function verificationSecrets(): string[] {
  const secrets = [
    process.env.TICKET_HMAC_SECRET || "",
    process.env.APPWRITE_API_KEY || "",
  ];

  return secrets.filter((secret) => secret.length > 0);
}

export function signTicket(ticketCode: string, eventId: string): string {
  const s = signingSecret();

  // Fail closed: an "unsigned" ticket is forgeable by anyone who can guess a
  // code, so a missing secret must break issuance loudly, not silently.
  if (!s) throw new Error("Ticket signing secret is not configured");
  const data = `${ticketCode}.${eventId}`;
  const sig = createHmac("sha256", s).update(data).digest("hex").slice(0, 32);

  return JSON.stringify({ ticketCode, eventId, sig });
}

export function parseQrData(
  raw: string,
): { ticketCode: string; eventId: string; signed: boolean } | null {
  try {
    const o = JSON.parse(raw) as Record<string, unknown>;
    const ticketCode = typeof o.ticketCode === "string" ? o.ticketCode : "";
    const eventId = typeof o.eventId === "string" ? o.eventId : "";

    if (!ticketCode || !eventId) return null;
    const sig = typeof o.sig === "string" ? o.sig : "";

    if (!sig) return { ticketCode, eventId, signed: false };
    // Accept signatures from the dedicated secret or the legacy API-key
    // fallback (pre-split tickets). A signed payload matching neither is
    // forged — reject, never downgrade to the unsigned path.
    const data = `${ticketCode}.${eventId}`;

    for (const s of verificationSecrets()) {
      const expected = createHmac("sha256", s)
        .update(data)
        .digest("hex")
        .slice(0, 32);
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);

      if (a.length === b.length && timingSafeEqual(a, b)) {
        return { ticketCode, eventId, signed: true };
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Single ticket-code generator (48-bit entropy, 12 hex chars).
 *
 * Every issuance path — self-registration, waitlist promotion, and admin
 * approval — must use this so codes stay unguessable and identically shaped.
 */
export function generateTicketCode(): string {
  return `MM-${crypto.randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
}

export interface IssuedTicketInput {
  userId: string;
  eventId: string;
  registrationId: string;
  maxEntries?: number;
}

/**
 * Allocate a clash-checked code and persist a signed ticket row.
 *
 * The unique index on `ticketCode` is the final backstop; the pre-check loop
 * keeps the common path free of constraint-violation retries. Throws when no
 * code could be allocated so callers fail loudly instead of issuing unsigned.
 */
export async function createSignedTicket(
  databases: Pick<ServerDatabases, "listDocuments" | "createDocument">,
  input: IssuedTicketInput,
) {
  let code = "";

  for (let attempt = 0; attempt < 5 && !code; attempt += 1) {
    const candidate = generateTicketCode();
    const clash = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.TICKETS,
      [Query.equal("ticketCode", [candidate]), Query.limit(1)],
    );

    if (clash.documents.length === 0) code = candidate;
  }
  if (!code) throw new Error("Could not allocate a unique ticket code");

  return databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.TICKETS,
    ID.unique(),
    {
      userId: input.userId,
      eventId: input.eventId,
      registrationId: input.registrationId,
      ticketCode: code,
      qrData: signTicket(code, input.eventId),
      status: "issued",
      issuedAt: new Date().toISOString(),
      entryCount: 0,
      maxEntries: input.maxEntries ?? 1,
    },
  );
}
