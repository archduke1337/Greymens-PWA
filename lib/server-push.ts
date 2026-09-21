import { Query } from "node-appwrite";
import webpush from "web-push";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { logError } from "@/lib/logger";

export interface PushPayload {
  title: string;
  body: string;
  /** Where a tap lands. Defaults to the member inbox. */
  url?: string;
}

export interface PushReport {
  attempted: boolean;
  sent: number;
  failed: number;
  reason?: string;
}

function vapid(): { publicKey: string; privateKey: string; subject: string } | null {
  const publicKey = process.env.VAPID_PUBLIC_KEY ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY ?? "";
  const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@greymens.club";

  if (!publicKey || !privateKey) return null;

  return { publicKey, privateKey, subject };
}

export function isPushConfigured(): boolean {
  return vapid() !== null;
}

export function pushPublicKey(): string | null {
  return vapid()?.publicKey ?? null;
}

interface StoredSubscription {
  $id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** All stored subscriptions for these accounts, paged (bounded). */
async function subscriptionsFor(
  userIds: string[],
): Promise<StoredSubscription[]> {
  const unique = [...new Set(userIds.filter(Boolean))];

  if (unique.length === 0) return [];

  const { databases } = createServerDatabases();
  const out: StoredSubscription[] = [];

  // Appwrite query strings have practical length limits — page the id list
  // in chunks rather than one giant equal().
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    let offset = 0;

    for (;;) {
      const page = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.PUSH_SUBSCRIPTIONS,
        [
          Query.equal("userId", chunk),
          Query.limit(100),
          Query.offset(offset),
        ],
      );

      for (const row of page.documents) {
        const endpoint = String(row.endpoint ?? "");
        const p256dh = String(row.p256dh ?? "");
        const auth = String(row.auth ?? "");

        if (endpoint && p256dh && auth) {
          out.push({ $id: row.$id, endpoint, p256dh, auth });
        }
      }
      if (page.documents.length < 100) break;
      offset += 100;
    }
  }

  return out;
}

/**
 * Best-effort Web Push to every subscribed device of these accounts.
 *
 * Never throws: a dead push service degrades the report, not the notice
 * around it. Dead subscriptions (410/404 from the push service) are
 * deleted so the table does not rot with uninstalled browsers.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload,
): Promise<PushReport> {
  const config = vapid();

  if (!config) {
    return { attempted: false, sent: 0, failed: 0, reason: "not_configured" };
  }
  if (userIds.length === 0) {
    return { attempted: false, sent: 0, failed: 0, reason: "no_recipients" };
  }

  webpush.setVapidDetails(config.subject, config.publicKey, config.privateKey);

  let subscriptions: StoredSubscription[];

  try {
    subscriptions = await subscriptionsFor(userIds);
  } catch (error) {
    logError("Push subscription lookup failed:", error);

    return { attempted: false, sent: 0, failed: 0, reason: "lookup_failed" };
  }

  if (subscriptions.length === 0) {
    return { attempted: false, sent: 0, failed: 0, reason: "no_subscriptions" };
  }

  const { databases } = createServerDatabases();
  const body = JSON.stringify({
    title: payload.title,
    body: payload.body,
    url: payload.url ?? "/notifications",
  });
  let sent = 0;
  let failed = 0;

  // Bounded parallelism: hundreds of devices must not open hundreds of
  // simultaneous TLS sessions to the push services.
  for (let i = 0; i < subscriptions.length; i += 10) {
    const chunk = subscriptions.slice(i, i + 10);

    await Promise.all(
      chunk.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            body,
          );
          sent += 1;
        } catch (error) {
          failed += 1;
          const status = (error as { statusCode?: number })?.statusCode;

          // 404/410 means the browser uninstalled or revoked — prune it.
          if (status === 404 || status === 410) {
            try {
              await databases.deleteDocument(
                DATABASE_ID,
                COLLECTIONS.PUSH_SUBSCRIPTIONS,
                sub.$id,
              );
            } catch {
              // Pruning is hygiene, not correctness.
            }
          } else {
            logError("Push send failed:", error);
          }
        }
      }),
    );
  }

  return { attempted: true, sent, failed };
}
