import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { isPushConfigured } from "@/lib/server-push";
import { isRecord, readString } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

// One member will not own more devices than this; beyond it the oldest
// subscription is pruned on the next save.
const MAX_DEVICES_PER_USER = 10;
const MAX_ENDPOINT_LENGTH = 2000;
const MAX_KEY_LENGTH = 255;

function readSubscription(body: Record<string, unknown>) {
  const endpoint = readString(body.endpoint, MAX_ENDPOINT_LENGTH);
  const keys =
    body.keys && typeof body.keys === "object"
      ? (body.keys as Record<string, unknown>)
      : null;
  const p256dh = keys ? readString(keys.p256dh, MAX_KEY_LENGTH) : "";
  const auth = keys ? readString(keys.auth, MAX_KEY_LENGTH) : "";

  if (!endpoint || !p256dh || !auth) return null;

  return { endpoint, p256dh, auth };
}

/**
 * Save this device's push subscription for the signed-in account.
 *
 * Idempotent per endpoint: re-subscribing the same browser updates the row
 * instead of stacking duplicates. Subscription existence IS the opt-in —
 * deleting it (DELETE, or the browser revoking) opts the device out.
 */
export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  if (!isPushConfigured()) {
    return fail("UNAVAILABLE", "Push notifications are not configured", 503);
  }

  const limited = consumeRateLimit(
    `push:subscribe:${authenticated.user.$id}`,
    30,
    60 * 60 * 1000,
  );

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

  const subscription = readSubscription(body);

  if (!subscription) {
    return fail("VALIDATION", "endpoint and keys are required", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const userId = authenticated.user.$id;
    const now = new Date().toISOString();
    const userAgent = (request.headers.get("user-agent") ?? "").slice(0, 255);

    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PUSH_SUBSCRIPTIONS,
      [
        Query.equal("userId", [userId]),
        Query.equal("endpoint", [subscription.endpoint]),
        Query.limit(1),
      ],
    );

    if (existing.documents.length > 0) {
      const row = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.PUSH_SUBSCRIPTIONS,
        existing.documents[0].$id,
        {
          p256dh: subscription.p256dh,
          auth: subscription.auth,
          userAgent,
        },
      );

      return ok({ subscription: row, renewed: true });
    }

    const mine = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PUSH_SUBSCRIPTIONS,
      [Query.equal("userId", [userId]), Query.limit(MAX_DEVICES_PER_USER + 1)],
    );

    // Over the device cap: drop the oldest before inserting, so the table
    // cannot grow a row per subscribe click.
    if (mine.documents.length >= MAX_DEVICES_PER_USER) {
      const oldest = [...mine.documents].sort((a, b) =>
        String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")),
      )[0];

      if (oldest) {
        await databases.deleteDocument(
          DATABASE_ID,
          COLLECTIONS.PUSH_SUBSCRIPTIONS,
          oldest.$id,
        );
      }
    }

    const row = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PUSH_SUBSCRIPTIONS,
      ID.unique(),
      {
        userId,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        userAgent,
        createdAt: now,
      },
    );

    return ok({ subscription: row, renewed: false }, 201);
  } catch (error) {
    logError("Push subscribe error:", error);

    return fail("INTERNAL", "Unable to save push subscription", 500);
  }
}

/** Remove one device subscription — the per-device opt-out. */
export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  const endpoint = (request.nextUrl.searchParams.get("endpoint") ?? "").trim();

  if (!endpoint) {
    return fail("VALIDATION", "An endpoint is required", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PUSH_SUBSCRIPTIONS,
      [
        Query.equal("userId", [authenticated.user.$id]),
        Query.equal("endpoint", [endpoint]),
        Query.limit(1),
      ],
    );

    if (existing.documents.length > 0) {
      await databases.deleteDocument(
        DATABASE_ID,
        COLLECTIONS.PUSH_SUBSCRIPTIONS,
        existing.documents[0].$id,
      );
    }

    return ok({ success: true });
  } catch (error) {
    logError("Push unsubscribe error:", error);

    return fail("INTERNAL", "Unable to remove push subscription", 500);
  }
}
