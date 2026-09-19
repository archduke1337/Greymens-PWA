import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import {
  getAccountNames,
  getUserContact,
  listUserContacts,
} from "@/lib/server-users";
import {
  isEmailConfigured,
  sendBulkEmail,
  type EmailRecipient,
} from "@/lib/email";
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
// forge system-looking notices). membership_approved / membership_rejected are
// written only by the membership flow itself — accepting them here would let
// any console sender emit approval letters unbacked by a membership row,
// indistinguishable from the real ones.
const SYSTEM_TYPES = new Set(["membership_approved", "membership_rejected"]);
const NOTIFICATION_TYPES = new Set([
  "membership_approved",
  "membership_rejected",
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

    const [response, unread] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
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

interface NotificationContent {
  type: string;
  title: string;
  body: string;
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
  const type = readString(body.type, 100);
  const title = readString(body.title, 255);
  const bodyText = readString(body.body, MAX_BODY_LENGTH);
  const sendEmail = body.sendEmail === true;

  // Exactly one recipient spec: a single account, or a named audience.
  if ((userId && audience) || (!userId && !audience)) {
    return fail(
      "VALIDATION",
      "Send to one member (userId) or an audience, not both",
      400,
    );
  }
  if (audience && audience !== "all_members" && audience !== "all_users") {
    return fail("VALIDATION", "audience must be all_members or all_users", 400);
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

  // A broadcast fans out to hundreds of rows — throttle it separately from
  // single sends so one announcement cannot spend the sender's whole budget.
  const limited = consumeRateLimit(
    audience
      ? `notifications:broadcast:${authenticated.user.$id}`
      : `notifications:${authenticated.user.$id}`,
    audience ? 5 : 60,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const { databases } = createServerDatabases();
    const createdAt = new Date().toISOString();

    // Resolve recipient account ids. Single sends verify the account exists
    // (fail-closed: no rows for ghost ids); audiences are bounded so a
    // runaway fan-out 400s instead of writing thousands of rows.
    let recipientIds: string[];

    if (userId) {
      const contact = await getUserContact(userId);

      if (!contact) return fail("NOT_FOUND", "Recipient not found", 404);
      recipientIds = [contact.userId];
    } else if (audience === "all_members") {
      const memberships = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.MEMBERSHIPS,
        [Query.equal("status", ["active"]), Query.limit(BROADCAST_CAP + 1)],
      );

      if (
        memberships.total > BROADCAST_CAP ||
        memberships.documents.length > BROADCAST_CAP
      ) {
        return fail(
          "VALIDATION",
          "Audience is larger than the broadcast limit — narrow it first",
          400,
        );
      }
      recipientIds = memberships.documents
        .map((row) => String(row.userId ?? ""))
        .filter(Boolean);
    } else {
      recipientIds = await allProfileIds(databases);

      if (recipientIds.length === 0) {
        return fail("VALIDATION", "Audience is empty", 400);
      }
    }

    const rows = await createNotificationRows(databases, recipientIds, {
      type,
      title,
      body: bodyText,
      letter,
      data,
      createdAt,
    });

    // Email runs after the in-app rows are safely stored: mail is the
    // best-effort copy, the notification row is the record.
    let email: {
      attempted: boolean;
      sent: number;
      failed: number;
      reason?: string;
    } = {
      attempted: false,
      sent: 0,
      failed: 0,
      reason: sendEmail ? undefined : "not_requested",
    };

    if (sendEmail) {
      const contacts = await emailsForRecipients(
        audience ? null : new Set(recipientIds),
      );

      email = await sendBulkEmail(contacts, title, bodyText);
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "notification.send",
      entityType: "notification",
      entityId: String(rows[0]?.$id ?? "broadcast"),
      details: {
        audience: audience || "single",
        userId: userId || null,
        type,
        sent: rows.length,
        email,
      },
    });

    // `notification` is kept for single sends: older readers expect the
    // created row there (see notificationService.create).
    return ok(
      {
        sent: rows.length,
        audience: audience || "single",
        email,
        ...(audience ? {} : { notification: rows[0] ?? null }),
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
