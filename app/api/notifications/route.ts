import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { getEffectiveCapabilities, requireCapability } from "@/lib/access-control";
import {
  getAccountNames,
  getUserContact,
  listUserContacts,
} from "@/lib/server-users";
import { listNonOnboardedContacts } from "@/lib/server-onboarding";
import { GOVERNANCE_OFFICES } from "@/lib/governance";
import {
  isEmailConfigured,
  sendBulkEmail,
  type EmailRecipient,
  type EmailReport,
} from "@/lib/email";
import { sendPushToUsers, type PushReport } from "@/lib/server-push";
import { markdownToPlainText } from "@/lib/markdown";
import { recordAudit } from "@/lib/server-audit";
import { isRecord, readOptionalString, readString } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_JSON_LENGTH = 5000;

// Closed notification vocabulary (see audit: free-string types let a sender
// forge system-looking notices). SYSTEM_TYPES are written only by the flow
// that owns them — accepting them here would let any console sender emit an
// approval letter (membership) or a review verdict (content queues) unbacked
// by a real decision, indistinguishable from the genuine notice.
const SYSTEM_TYPES = new Set([
  "membership_approved",
  "membership_rejected",
  "submission_update",
]);
const NOTIFICATION_TYPES = new Set([
  "membership_approved",
  "membership_rejected",
  // Review verdicts for content submissions (projects, gallery, resources,
  // sponsors, blogs). In the vocabulary so the type is documented, absent from
  // the compose menu because SYSTEM_TYPES blocks senders from forging it.
  "submission_update",
  "promotion",
  "designation",
  "admin_announcement",
  "system_update",
  "event_reminder",
  "event_update",
  "general",
]);

/** Notifications belong to exactly one account; only that account may read it. */
async function getOwnedNotification(notificationId: string, userId: string) {
  const { databases } = createServerDatabases();

  try {
    const document = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.NOTIFICATIONS,
      notificationId,
    );

    return document.userId === userId ? document : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    const params = request.nextUrl.searchParams;
    const wantsAll = params.get("all") === "true";
    const rawLimit = Number(params.get("limit"));
    const limit =
      Number.isFinite(rawLimit) && rawLimit > 0
        ? Math.min(MAX_LIMIT, Math.floor(rawLimit))
        : DEFAULT_LIMIT;

    const { databases } = createServerDatabases();

    // The admin console views the whole feed; a member only ever sees their own.
    if (wantsAll) {
      const adminCheck = await requireCapability(request, "notifications.send");

      if (!adminCheck.user) return adminCheck.response;

      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.NOTIFICATIONS,
        [Query.orderDesc("createdAt"), Query.limit(limit)],
      );
      // Recipient names live on the auth record — best-effort so a lookup
      // failure never fails the admin feed.
      const recipientIds = [
        ...new Set(
          response.documents
            .map((doc) => String(doc.userId ?? ""))
            .filter(Boolean),
        ),
      ];
      const accountNames = await getAccountNames(recipientIds).then(
        (names) => Object.fromEntries(names) as Record<string, string>,
        () => ({}) as Record<string, string>,
      );

      return ok({
        notifications: response.documents,
        total: response.total,
        unreadCount: 0,
        accountNames,
        // The console's "also send email" toggle renders from this — the
        // client cannot read server env, so the server states the channel.
        emailConfigured: isEmailConfigured(),
      });
    }

    // Composer preview: how many accounts an audience reaches, before send.
    const countFor = (params.get("countFor") ?? "").trim();

    if (countFor) {
      const counterCheck = await requireCapability(
        request,
        "notifications.send",
      );

      if (!counterCheck.user) return counterCheck.response;
      if (!AUDIENCES.has(countFor)) {
        return fail(
          "VALIDATION",
          "audience must be all_members, all_users, or not_onboarded",
          400,
        );
      }

      const { databases } = createServerDatabases();
      const { count, capped } = await countAudience(countFor, databases);

      return ok({ audience: countFor, count, capped, limit: BROADCAST_CAP });
    }

    // Composer preview for multi-select sends: resolve the exact recipient
    // set (members + offices + broadcast audience, unioned) without writing
    // anything. `userIds`/`officeIds` are comma-separated query params.
    const wantResolve = params.get("resolve") === "true";

    if (wantResolve) {
      const resolveCheck = await requireCapability(
        request,
        "notifications.send",
      );

      if (!resolveCheck.user) return resolveCheck.response;

      const userIds = (params.get("userIds") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean);
      const officeIds = (params.get("officeIds") ?? "")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => OFFICE_IDS.has(value));
      const resolveAudience = (params.get("audience") ?? "").trim();

      if (resolveAudience && !AUDIENCES.has(resolveAudience)) {
        return fail(
          "VALIDATION",
          "audience must be all_members, all_users, or not_onboarded",
          400,
        );
      }

      const { databases } = createServerDatabases();
      const resolved = await resolveRecipientIds(databases, {
        userIds,
        officeIds,
        audience: resolveAudience || null,
      });
      const names = await getAccountNames([...resolved.ids].slice(0, 50)).then(
        (map) => map,
        () => new Map<string, string>(),
      );

      return ok({
        count: Math.min(resolved.ids.size, BROADCAST_CAP),
        capped: resolved.ids.size > BROADCAST_CAP,
        limit: BROADCAST_CAP,
        sample: [...resolved.ids]
          .slice(0, 10)
          .map((id) => names.get(id) || id.slice(0, 8)),
        offices: officeIds.map((officeId) => ({
          officeId,
          title: OFFICE_TITLES[officeId] ?? officeId,
          holders: (resolved.officeHolders.get(officeId) ?? []).map(
            (id) => names.get(id) || id.slice(0, 8),
          ),
        })),
      });
    }

    const [response, unread] = await Promise.all([      databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
        Query.equal("userId", [authenticated.user.$id]),
        Query.orderDesc("createdAt"),
        Query.limit(limit),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
        Query.equal("userId", [authenticated.user.$id]),
        Query.equal("read", [false]),
        Query.limit(1),
      ]),
    ]);

    return ok({
      notifications: response.documents,
      total: response.total,
      unreadCount: unread.total,
    });
  } catch (error) {
    logError("Notification lookup error:", error);

    return fail("INTERNAL", "Unable to load notifications", 500);
  }
}

// Broadcast fan-out cap: one announcement must never write an unbounded
// number of rows. Above this the sender narrows the audience instead.
const BROADCAST_CAP = 500;
const FANOUT_CONCURRENCY = 25;

/** Every profile holder, paged — the `all_users` audience. */
async function allProfileIds(
  databases: ReturnType<typeof createServerDatabases>["databases"],
): Promise<string[]> {
  const ids: string[] = [];
  let offset = 0;

  for (;;) {
    const page = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      [Query.limit(100), Query.offset(offset)],
    );

    for (const row of page.documents) {
      const userId = String(row.userId ?? "");

      if (userId) ids.push(userId);
      if (ids.length > BROADCAST_CAP) return ids;
    }
    if (page.documents.length < 100) break;
    offset += 100;
  }

  return ids;
}

const AUDIENCES = new Set(["all_members", "all_users", "not_onboarded"]);

// Office targeting uses the constitution's snake_case ids (president,
// general_secretary, …), never display titles or designation slugs.
const OFFICE_IDS = new Set(GOVERNANCE_OFFICES.map((office) => office.id));
const OFFICE_TITLES: Record<string, string> = Object.fromEntries(
  GOVERNANCE_OFFICES.map((office) => [office.id, office.title]),
);

/**
 * Active holders per office. Mirrors the capability checker's term logic:
 * a row whose termEnd is past holds no seat even if status still says
 * active. Bounded per office (one active holder is the rule; limit 10 is
 * headroom, not a model change).
 */
async function resolveOfficeHolders(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  officeIds: string[],
): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  const today = new Date().toISOString().slice(0, 10);

  await Promise.all(
    officeIds.map(async (officeId) => {
      try {
        const rows = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.OFFICE_ASSIGNMENTS,
          [
            Query.equal("officeId", [officeId]),
            Query.equal("status", ["active"]),
            Query.limit(10),
          ],
        );
        out.set(
          officeId,
          rows.documents
            .filter((row) => {
              const termEnd = String(row.termEnd ?? "");

              return !termEnd || termEnd >= today;
            })
            .map((row) => String(row.userId ?? ""))
            .filter(Boolean),
        );
      } catch {
        out.set(officeId, []);
      }
    }),
  );

  return out;
}

/**
 * May this sender sign as this office? Either they hold the seat right now
 * (term respected, same rule as targeting), or they are a wildcard admin.
 * Without this, anyone with the send capability could forge a notice "from
 * the President" indistinguishable from the real thing.
 */
async function canSendAsOffice(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  userId: string,
  email: string,
  officeId: string,
): Promise<boolean> {
  const capabilities = await getEffectiveCapabilities(
    userId,
    undefined,
    undefined,
    email || null,
  ).catch(() => new Set<string>());

  if (capabilities.has("*")) return true;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const rows = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.OFFICE_ASSIGNMENTS,
      [
        Query.equal("userId", [userId]),
        Query.equal("officeId", [officeId]),
        Query.equal("status", ["active"]),
        Query.limit(5),
      ],
    );

    return rows.documents.some((row) => {
      const termEnd = String(row.termEnd ?? "");

      return !termEnd || termEnd >= today;
    });
  } catch {
    return false;
  }
}

/** Parse an optional string array (bounded length + item length). */
function readStringArray(value: unknown, maxItems: number): string[] | null {
  if (value === undefined || value === null) return null;
  if (!Array.isArray(value)) return null;
  if (value.length > maxItems) return null;
  const out: string[] = [];

  for (const item of value) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();

    if (!trimmed || trimmed.length > 36) return null;
    out.push(trimmed);
  }

  return [...new Set(out)];
}

/**
 * Recipient count preview for the console composer, so a sender sees the
 * blast radius before committing. Totals come from cheap `limit(1)` reads
 * except `not_onboarded`, which must diff the directory (bounded at cap+1).
 */
async function countAudience(
  audience: string,
  databases: ReturnType<typeof createServerDatabases>["databases"],
): Promise<{ count: number; capped: boolean }> {
  if (audience === "all_members") {
    const memberships = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.MEMBERSHIPS,
      [Query.equal("status", ["active"]), Query.limit(1)],
    );

    return {
      count: Math.min(memberships.total, BROADCAST_CAP),
      capped: memberships.total > BROADCAST_CAP,
    };
  }
  if (audience === "all_users") {
    const profiles = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      [Query.limit(1)],
    );

    return {
      count: Math.min(profiles.total, BROADCAST_CAP),
      capped: profiles.total > BROADCAST_CAP,
    };
  }
  const contacts = await listNonOnboardedContacts(BROADCAST_CAP + 1);

  return {
    count: Math.min(contacts.length, BROADCAST_CAP),
    capped: contacts.length > BROADCAST_CAP,
  };
}

interface NotificationContent {
  type: string;
  title: string;
  body: string;
  /** Office id the notice is sent as, if any — stored per row, shown as the sender. */
  fromOffice?: string;
  letter?: string;
  data?: string;
  createdAt: string;
}

/** One row per recipient, written in bounded parallel chunks. */
async function createNotificationRows(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  recipientIds: string[],
  content: NotificationContent,
): Promise<Array<Record<string, unknown>>> {
  const rows: Array<Record<string, unknown>> = [];

  for (let i = 0; i < recipientIds.length; i += FANOUT_CONCURRENCY) {
    const chunk = recipientIds.slice(i, i + FANOUT_CONCURRENCY);
    const created = await Promise.all(
      chunk.map((userId) =>
        databases.createDocument(
          DATABASE_ID,
          COLLECTIONS.NOTIFICATIONS,
          ID.unique(),
          {
            userId,
            type: content.type,
            title: content.title,
            body: content.body,
            ...(content.fromOffice ? { fromOffice: content.fromOffice } : {}),
            letter: content.letter,
            data: content.data,
            read: false,
            // `createdAt` is a required column; the previous browser-side
            // writer never set it, so every notification insert failed.
            createdAt: content.createdAt,
          },
        ),
      ),
    );

    for (const row of created)
      rows.push(row as unknown as Record<string, unknown>);
  }

  return rows;
}

/**
 * Email addresses for the mail copy. `onlyIds` restricts to a recipient set
 * (member audience); `null` mails every account with an address. Scans the
 * directory in pages and stops early once a restricted set is satisfied, so
 * a 40-member broadcast does not page the whole directory.
 */
async function emailsForRecipients(
  onlyIds: Set<string> | null,
): Promise<EmailRecipient[]> {
  const out: EmailRecipient[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (;;) {
    const page = await listUserContacts(100, offset);

    if (page.length === 0) break;
    for (const contact of page) {
      if (onlyIds && !onlyIds.has(contact.userId)) continue;
      if (seen.has(contact.email)) continue;
      seen.add(contact.email);
      out.push({ email: contact.email, name: contact.name });
      if (out.length >= BROADCAST_CAP) return out;
    }
    if (onlyIds && out.length >= onlyIds.size) break;
    if (page.length < 100) break;
    offset += 100;
  }

  return out;
}

interface RecipientSpec {
  userIds: string[];
  officeIds: string[];
  audience: string | null;
}

interface ResolvedRecipients {
  ids: Set<string>;
  officeHolders: Map<string, string[]>;
  unknownUserIds: string[];
}

/**
 * Union of every recipient source: hand-picked members (verified, ghosts
 * reported), office holders (active seat, term respected), and one
 * broadcast audience. Shared by the composer preview and the send path so
 * the preview cannot disagree with the send.
 */
async function resolveRecipientIds(
  databases: ReturnType<typeof createServerDatabases>["databases"],
  spec: RecipientSpec,
): Promise<ResolvedRecipients> {
  const ids = new Set<string>();
  const unknownUserIds: string[] = [];

  for (let i = 0; i < spec.userIds.length; i += 20) {
    const chunk = spec.userIds.slice(i, i + 20);
    const contacts = await Promise.all(
      chunk.map((id) => getUserContact(id)),
    );

    contacts.forEach((contact, index) => {
      if (contact) ids.add(contact.userId);
      else unknownUserIds.push(chunk[index]);
    });
  }

  let officeHolders = new Map<string, string[]>();

  if (spec.officeIds.length > 0) {
    officeHolders = await resolveOfficeHolders(databases, spec.officeIds);

    for (const holders of officeHolders.values()) {
      for (const id of holders) ids.add(id);
    }
  }

  if (spec.audience === "all_members") {
    const memberships = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.MEMBERSHIPS,
      [Query.equal("status", ["active"]), Query.limit(BROADCAST_CAP + 1)],
    );

    if (
      memberships.total > BROADCAST_CAP ||
      memberships.documents.length > BROADCAST_CAP
    ) {
      throw new Error("AUDIENCE_OVER_CAP");
    }
    for (const row of memberships.documents) {
      const id = String(row.userId ?? "");

      if (id) ids.add(id);
    }
  } else if (spec.audience === "all_users") {
    for (const id of await allProfileIds(databases)) ids.add(id);
  } else if (spec.audience === "not_onboarded") {
    const contacts = await listNonOnboardedContacts(BROADCAST_CAP + 1);

    if (contacts.length > BROADCAST_CAP) throw new Error("AUDIENCE_OVER_CAP");
    for (const contact of contacts) ids.add(contact.userId);
  }

  return { ids, officeHolders, unknownUserIds };
}

export async function POST(request: NextRequest) {
  // Sending a notification to another account is an administrative action.
  const authenticated = await requireCapability(request, "notifications.send");

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  if (!isRecord(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  const userId = readString(body.userId, 36);
  const audience =
    typeof body.audience === "string" ? body.audience.trim() : "";
  // Multi-select sends: hand-picked member ids and/or office ids, unioned
  // with an optional broadcast audience on the server.
  const userIds = readStringArray(body.userIds, BROADCAST_CAP);
  const officeIds = readStringArray(body.officeIds, OFFICE_IDS.size);
  const type = readString(body.type, 100);
  const title = readString(body.title, 255);
  const bodyText = readString(body.body, MAX_BODY_LENGTH);
  const sendEmail = body.sendEmail === true;
  // Send-as: the office the notice is signed from ("Office of the
  // President"), as opposed to offices targeted as recipients.
  const fromOffice =
    typeof body.fromOffice === "string" ? body.fromOffice.trim() : "";

  // Exactly one recipient spec: a single account, or any combination of
  // member multi-select, offices, and a named audience.
  const hasMulti =
    (userIds !== null && userIds.length > 0) ||
    (officeIds !== null && officeIds.length > 0) ||
    Boolean(audience);

  if (userId && hasMulti) {
    return fail(
      "VALIDATION",
      "Send to one member (userId) or a selection, not both",
      400,
    );
  }
  if (!userId && !hasMulti) {
    return fail(
      "VALIDATION",
      "Send to one member (userId), members (userIds), offices (officeIds), or an audience",
      400,
    );
  }
  if (body.userIds !== undefined && userIds === null) {
    return fail("VALIDATION", "userIds must be an array of account ids", 400);
  }
  if (body.officeIds !== undefined && officeIds === null) {
    return fail("VALIDATION", "officeIds must be an array of office ids", 400);
  }
  if (officeIds) {
    const unknown = officeIds.filter((id) => !OFFICE_IDS.has(id));

    if (unknown.length > 0) {
      return fail(
        "VALIDATION",
        `Unknown office: ${unknown.slice(0, 3).join(", ")}`,
        400,
      );
    }
  }
  if (audience && !AUDIENCES.has(audience)) {
    return fail(
      "VALIDATION",
      "audience must be all_members, all_users, or not_onboarded",
      400,
    );
  }
  if (fromOffice && !OFFICE_IDS.has(fromOffice)) {
    return fail("VALIDATION", `Unknown office: ${fromOffice}`, 400);
  }
  if (!type || !title || !bodyText) {
    return fail("VALIDATION", "type, title, and body are required", 400);
  }
  // Closed vocabulary: a sender must not be able to forge system-looking
  // notices (e.g. membership_approved) outside the flows that own them.
  if (!NOTIFICATION_TYPES.has(type)) {
    return fail("VALIDATION", "Invalid notification type", 400);
  }
  if (SYSTEM_TYPES.has(type)) {
    return fail(
      "FORBIDDEN",
      "That notice is sent by its system flow, not the console",
      403,
    );
  }

  const letter =
    body.letter === undefined || body.letter === null
      ? undefined
      : JSON.stringify(body.letter);
  const data =
    body.data === undefined || body.data === null
      ? undefined
      : JSON.stringify(body.data);

  if (
    (letter && letter.length > MAX_JSON_LENGTH) ||
    (data && data.length > MAX_JSON_LENGTH)
  ) {
    return fail("VALIDATION", "Notification payload is too large", 400);
  }

  // A multi-select or office send fans out like a broadcast — throttle it
  // as one, so a 200-person selection cannot spend a single-send budget.
  const isBroadcast =
    Boolean(audience) ||
    (officeIds !== null && officeIds.length > 0) ||
    (userIds !== null && userIds.length > 1);
  const limited = consumeRateLimit(
    isBroadcast
      ? `notifications:broadcast:${authenticated.user.$id}`
      : `notifications:${authenticated.user.$id}`,
    isBroadcast ? 5 : 60,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const { databases } = createServerDatabases();
    const createdAt = new Date().toISOString();

    // Send-as authorization runs before any write: signing another
    // office's name must fail closed, not after rows fan out.
    if (fromOffice) {
      const allowed = await canSendAsOffice(
        databases,
        authenticated.user.$id,
        String(authenticated.user.email ?? ""),
        fromOffice,
      );

      if (!allowed) {
        return fail(
          "FORBIDDEN",
          "Only that office's current holder can send as it",
          403,
        );
      }
    }

    // Resolve recipient account ids. Single sends verify the account exists
    // (fail-closed: no rows for ghost ids); selections union every source
    // and stay bounded so a runaway fan-out 400s instead of writing
    // thousands of rows.
    let recipientIds: string[];
    let resolvedOffices: string[] = [];

    if (userId) {
      const contact = await getUserContact(userId);

      if (!contact) return fail("NOT_FOUND", "Recipient not found", 404);
      recipientIds = [contact.userId];
    } else {
      let resolved: ResolvedRecipients;

      try {
        resolved = await resolveRecipientIds(databases, {
          userIds: userIds ?? [],
          officeIds: officeIds ?? [],
          audience: audience || null,
        });
      } catch (error) {
        if (error instanceof Error && error.message === "AUDIENCE_OVER_CAP") {
          return fail(
            "VALIDATION",
            "Audience is larger than the broadcast limit — narrow it first",
            400,
          );
        }
        throw error;
      }

      if (resolved.unknownUserIds.length > 0) {
        return fail(
          "VALIDATION",
          `${resolved.unknownUserIds.length} selected recipient${resolved.unknownUserIds.length === 1 ? " was" : "s were"} not found — refresh the picker and try again`,
          400,
        );
      }
      if (resolved.ids.size === 0) {
        return fail(
          "VALIDATION",
          "Audience is empty — the selected offices have no active holders",
          400,
        );
      }
      if (resolved.ids.size > BROADCAST_CAP) {
        return fail(
          "VALIDATION",
          "Audience is larger than the broadcast limit — narrow it first",
          400,
        );
      }
      recipientIds = [...resolved.ids];
      resolvedOffices = officeIds ?? [];
    }

    const rows = await createNotificationRows(databases, recipientIds, {
      type,
      title,
      body: bodyText,
      ...(fromOffice ? { fromOffice } : {}),
      letter,
      data,
      createdAt,
    });

    // Email runs after the in-app rows are safely stored: mail is the
    // best-effort copy, the notification row is the record.
    let email: EmailReport = {
      attempted: false,
      sent: 0,
      failed: 0,
      reason: sendEmail ? undefined : "not_requested",
    };

    if (sendEmail) {
      // Mail exactly the notified accounts: previously every broadcast
      // mailed the whole directory while in-app rows went only to the
      // audience, so bystanders got mail for notices never sent to them.
      const contacts = await emailsForRecipients(new Set(recipientIds));

      email = await sendBulkEmail(contacts, title, bodyText, {
        signoff: fromOffice ? OFFICE_TITLES[fromOffice] : undefined,
      });

      // Resend's rejection reason belongs in the server logs — otherwise a
      // failed batch is a bare counter with no cause attached.
      if (email.failed > 0) {
        logError(
          "Notification email failed:",
          email.detail ?? "unknown provider error",
        );
      }
    }

    // Push to subscribed devices, same best-effort contract as mail: the
    // rows above are the record, this is the tap on the shoulder.
    const push: PushReport = await sendPushToUsers(recipientIds, {
      title,
      body: markdownToPlainText(bodyText) || bodyText,
    });

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "notification.send",
      entityType: "notification",
      entityId: String(rows[0]?.$id ?? "broadcast"),
      details: {
        audience: audience || (userId ? "single" : "selection"),
        userId: userId || null,
        userIds: userIds && userIds.length > 0 ? userIds.length : null,
        officeIds: resolvedOffices.length > 0 ? resolvedOffices : null,
        fromOffice: fromOffice || null,
        type,
        sent: rows.length,
        email,
        push,
      },
    });

    // `notification` is kept for single sends: older readers expect the
    // created row there (see notificationService.create).
    return ok(
      {
        sent: rows.length,
        audience: audience || (userId ? "single" : "selection"),
        email,
        push,
        ...(audience || !userId ? {} : { notification: rows[0] ?? null }),
      },
      201,
    );
  } catch (error) {
    logError("Notification create error:", error);

    return fail("INTERNAL", "Unable to send notification", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  if (!isRecord(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const readAt = new Date().toISOString();

    if (body.all === true) {
      const unread = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.NOTIFICATIONS,
        [
          Query.equal("userId", [authenticated.user.$id]),
          Query.equal("read", [false]),
          Query.limit(MAX_LIMIT),
        ],
      );

      await Promise.all(
        unread.documents.map((document) =>
          databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.NOTIFICATIONS,
            document.$id,
            { read: true, readAt },
          ),
        ),
      );

      return ok({ updated: unread.documents.length });
    }

    const notificationId = readOptionalString(body.id, 36);

    if (!notificationId) {
      return fail("VALIDATION", "A notification id is required", 400);
    }

    const owned = await getOwnedNotification(
      notificationId,
      authenticated.user.$id,
    );

    if (!owned) return fail("NOT_FOUND", "Notification not found", 404);

    const notification = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.NOTIFICATIONS,
      notificationId,
      { read: true, readAt },
    );

    return ok({ notification });
  } catch (error) {
    logError("Notification update error:", error);

    return fail("INTERNAL", "Unable to update notification", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  const notificationId = readOptionalString(
    request.nextUrl.searchParams.get("id"),
    36,
  );

  if (!notificationId) {
    return fail("VALIDATION", "A notification id is required", 400);
  }

  try {
    const owned = await getOwnedNotification(
      notificationId,
      authenticated.user.$id,
    );

    if (!owned) return fail("NOT_FOUND", "Notification not found", 404);

    const { databases } = createServerDatabases();

    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.NOTIFICATIONS,
      notificationId,
    );

    return ok({ success: true });
  } catch (error) {
    logError("Notification delete error:", error);

    return fail("INTERNAL", "Unable to delete notification", 500);
  }
}
