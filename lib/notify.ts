/**
 * Central notification dispatch, server-only.
 *
 * Every system flow that tells a user something (membership approved /
 * rejected, registration decisions, and later promotions and reminders)
 * comes through here so the two copies of a notice stay in sync: the
 * in-app row is the record and always written; the email copy follows
 * automatically whenever the channel is configured. Mail never throws —
 * a dead provider degrades the returned report, not the flow that called.
 *
 * Console broadcasts do NOT use this helper: they fan out to hundreds of
 * recipients with their own budget and sender-chosen email flag
 * (see POST /api/notifications).
 */

import { ID, Query } from "node-appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getUserContact } from "@/lib/server-users";
import { sendBulkEmail, type EmailReport } from "@/lib/email";
import {
  sendPushToUsers,
  type PushReport,
} from "@/lib/server-push";
import { officeTitle } from "@/lib/governance";
import { markdownToPlainText } from "@/lib/markdown";

export interface DispatchInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  /** Office id the notice is signed from, if any. */
  fromOffice?: string;
  /** Pre-serialized letter JSON for the in-app row (as stored today). */
  letter?: string;
  /** Pre-serialized data JSON for the in-app row. */
  data?: string;
  /**
   * Extra plain text appended to the MAIL copy only (e.g. a letter's
   * subject + body, which the in-app row carries as structured JSON).
   */
  emailBody?: string;
  /**
   * System flows mail when configured — applicants must get decisions even
   * if they never log back in. Pass `false` only for notices that are
   * meaningless outside the app.
   */
  email?: boolean;
}

export interface DispatchResult {
  id: string;
  email: EmailReport;
  push: PushReport;
}

const NO_MAIL: EmailReport = {
  attempted: false,
  sent: 0,
  failed: 0,
  reason: "not_requested",
};

/**
 * The member's mail preference, read fresh per send so a change takes effect
 * on the next notice. A missing value (or a lookup failure) reads as opted in:
 * a decision the member is waiting for must not be dropped because a profile
 * row could not be read.
 */
async function emailOptedOut(userId: string): Promise<boolean> {
  try {
    const { databases } = createServerDatabases();
    const rows = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      [Query.equal("userId", [userId]), Query.limit(1)],
    );

    return (
      (rows.documents[0] as Record<string, unknown> | undefined)
        ?.emailNotifications === false
    );
  } catch {
    return false;
  }
}

export async function dispatchNotification(
  input: DispatchInput,
): Promise<DispatchResult> {
  const { databases } = createServerDatabases();
  const row = await databases.createDocument(
    DATABASE_ID,
    COLLECTIONS.NOTIFICATIONS,
    ID.unique(),
    {
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      ...(input.fromOffice ? { fromOffice: input.fromOffice } : {}),
      letter: input.letter,
      data: input.data,
      read: false,
      createdAt: new Date().toISOString(),
    },
  );

  let email: EmailReport = NO_MAIL;

  if (input.email !== false && !(await emailOptedOut(input.userId))) {
    const contact = await getUserContact(input.userId);

    email = contact
      ? await sendBulkEmail(
          [{ email: contact.email, name: contact.name }],
          input.title,
          input.emailBody ? `${input.body}\n\n${input.emailBody}` : input.body,
          {
            signoff: input.fromOffice
              ? (officeTitle(input.fromOffice) ?? undefined)
              : undefined,
          },
        )
      : { attempted: false, sent: 0, failed: 0, reason: "no_recipients" };
  }

  // Push follows the same best-effort contract as mail: a device that never
  // subscribed simply has no subscription, and failures never throw.
  const push = await sendPushToUsers([input.userId], {
    title: input.title,
    body: markdownToPlainText(input.body) || input.body,
  });

  return { id: row.$id, email, push };
}
