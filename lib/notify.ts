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

import { ID } from "node-appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getUserContact } from "@/lib/server-users";
import { sendBulkEmail, type EmailReport } from "@/lib/email";

export interface DispatchInput {
  userId: string;
  type: string;
  title: string;
  body: string;
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
}

const NO_MAIL: EmailReport = {
  attempted: false,
  sent: 0,
  failed: 0,
  reason: "not_requested",
};

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
      letter: input.letter,
      data: input.data,
      read: false,
      createdAt: new Date().toISOString(),
    },
  );

  let email: EmailReport = NO_MAIL;

  if (input.email !== false) {
    const contact = await getUserContact(input.userId);

    email = contact
      ? await sendBulkEmail(
          [{ email: contact.email, name: contact.name }],
          input.title,
          input.emailBody ? `${input.body}\n\n${input.emailBody}` : input.body,
        )
      : { attempted: false, sent: 0, failed: 0, reason: "no_recipients" };
  }

  return { id: row.$id, email };
}
