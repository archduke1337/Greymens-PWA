import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { isRecord, readOptionalString, readString } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, ApiError } from "@/lib/api";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_BODY_LENGTH = 5000;
const MAX_JSON_LENGTH = 5000;

// Closed notification vocabulary (see audit: free-string types let a sender
// forge system-looking notices). System flows own membership_approved /
// membership_rejected; the console offers the rest.
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
    const document = await databases.getDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, notificationId);
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
    const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(MAX_LIMIT, Math.floor(rawLimit)) : DEFAULT_LIMIT;

    const { databases } = createServerDatabases();

    // The admin console views the whole feed; a member only ever sees their own.
    if (wantsAll) {
      const adminCheck = await requireCapability(request, "notifications.send");
      if (!adminCheck.user) return adminCheck.response;

      const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
        Query.orderDesc("createdAt"),
        Query.limit(limit),
      ]);
      // Recipient names live on the auth record — best-effort so a lookup
      // failure never fails the admin feed.
      const recipientIds = [...new Set(response.documents.map((doc) => String(doc.userId ?? "")).filter(Boolean))];
      const accountNames = await getAccountNames(recipientIds).then(
        (names) => Object.fromEntries(names) as Record<string, string>,
        () => ({}) as Record<string, string>,
      );
      return ok({ notifications: response.documents, total: response.total, unreadCount: 0, accountNames });
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
    console.error("Notification lookup error:", error);
    return fail("INTERNAL", "Unable to load notifications", 500);
  }
}

export async function POST(request: NextRequest) {
  // Sending a notification to another account is an administrative action.
  const authenticated = await requireCapability(request, "notifications.send");
  if (!authenticated.user) return authenticated.response;

  const limited = consumeRateLimit(`notifications:${authenticated.user.$id}`, 60, 60 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

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
  const type = readString(body.type, 100);
  const title = readString(body.title, 255);
  const bodyText = readString(body.body, MAX_BODY_LENGTH);

  if (!userId || !type || !title || !bodyText) {
    return fail("VALIDATION", "userId, type, title, and body are required", 400);
  }
  // Closed vocabulary: a sender must not be able to forge system-looking
  // notices (e.g. membership_approved) outside the flows that own them.
  if (!NOTIFICATION_TYPES.has(type)) {
    return fail("VALIDATION", "Invalid notification type", 400);
  }

  const letter = body.letter === undefined || body.letter === null ? null : JSON.stringify(body.letter);
  const data = body.data === undefined || body.data === null ? null : JSON.stringify(body.data);
  if ((letter && letter.length > MAX_JSON_LENGTH) || (data && data.length > MAX_JSON_LENGTH)) {
    return fail("VALIDATION", "Notification payload is too large", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const notification = await databases.createDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, ID.unique(), {
      userId,
      type,
      title,
      body: bodyText,
      letter,
      data,
      read: false,
      // `createdAt` is a required column; the previous browser-side writer never
      // set it, so every notification insert failed.
      createdAt: new Date().toISOString(),
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "notification.send",
      entityType: "notification",
      entityId: notification.$id,
      details: { userId, type },
    });
    return ok({ notification }, 201);
  } catch (error) {
    console.error("Notification create error:", error);
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
      const unread = await databases.listDocuments(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, [
        Query.equal("userId", [authenticated.user.$id]),
        Query.equal("read", [false]),
        Query.limit(MAX_LIMIT),
      ]);
      await Promise.all(
        unread.documents.map((document) =>
          databases.updateDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, document.$id, { read: true, readAt })
        )
      );
      return ok({ updated: unread.documents.length });
    }

    const notificationId = readOptionalString(body.id, 36);
    if (!notificationId) {
      return fail("VALIDATION", "A notification id is required", 400);
    }

    const owned = await getOwnedNotification(notificationId, authenticated.user.$id);
    if (!owned) return fail("NOT_FOUND", "Notification not found", 404);

    const notification = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.NOTIFICATIONS,
      notificationId,
      { read: true, readAt }
    );
    return ok({ notification });
  } catch (error) {
    console.error("Notification update error:", error);
    return fail("INTERNAL", "Unable to update notification", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  const notificationId = readOptionalString(request.nextUrl.searchParams.get("id"), 36);
  if (!notificationId) {
    return fail("VALIDATION", "A notification id is required", 400);
  }

  try {
    const owned = await getOwnedNotification(notificationId, authenticated.user.$id);
    if (!owned) return fail("NOT_FOUND", "Notification not found", 404);

    const { databases } = createServerDatabases();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.NOTIFICATIONS, notificationId);
    return ok({ success: true });
  } catch (error) {
    console.error("Notification delete error:", error);
    return fail("INTERNAL", "Unable to delete notification", 500);
  }
}
