/**
 * Outbound email via the official Resend Node.js SDK, server-only.
 *
 * Setup (human, once): create an API key and verify the sending domain at
 * https://resend.com/domains, then set `RESEND_API_KEY` and `EMAIL_FROM`
 * (a sender on the verified domain) in the deployment environment. Both
 * unset means the channel is off — callers check `isEmailConfigured()` and
 * report "email skipped (not configured)" instead of failing the in-app
 * send. There is deliberately no fallback transport: silently downgrading
 * to an unconfigured relay would blackhole mail, which is worse than an
 * honest skip.
 *
 * The HTML shell itself lives in lib/email-template.ts (client-safe) so the
 * console's composer can preview the exact mail a member receives.
 */

import { randomUUID } from "node:crypto";

import { Resend } from "resend";

import { escapeHtml, renderEmailHtml } from "@/lib/email-template";
import { markdownToPlainText } from "@/lib/markdown";

// Re-exported because this module has always been their public home.
export { escapeHtml };

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailReport {
  attempted: boolean;
  sent: number;
  failed: number;
  reason?: string;
  /** First provider error message, when any batch failed. */
  detail?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

const RESEND_BATCH_LIMIT = 100;

/**
 * Send one subject/body to many recipients via Resend's batch endpoint.
 *
 * Each recipient gets their own message (`to` holds exactly one address),
 * so member addresses are never exposed to each other the way a shared
 * `to: [...]` batch would. Requests go out in chunks of 100 (the batch
 * limit) with a unique idempotency key per chunk, and `{ data, error }`
 * is inspected per chunk — `try/catch` is reserved for network-level
 * failures only. Provider failures are counted in `failed` (first message
 * kept in `detail`) so a dead mail provider degrades the report, not the
 * in-app fan-out around it.
 */
export async function sendBulkEmail(
  recipients: EmailRecipient[],
  subject: string,
  body: string,
  options?: { signoff?: string },
): Promise<EmailReport> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    return { attempted: false, sent: 0, failed: 0, reason: "not_configured" };
  }
  const to = recipients
    .map((r) => r.email.trim().toLowerCase())
    .filter(Boolean);

  if (to.length === 0) {
    return { attempted: false, sent: 0, failed: 0, reason: "no_recipients" };
  }

  const resend = new Resend(apiKey);
  const html = renderEmailHtml(subject, body, options?.signoff);
  // The text part carries the words without the markers: a `**bold**` that
  // survives into plain text reads like a formatting bug in the inbox.
  const text = markdownToPlainText(body) || body;
  let sent = 0;
  let failed = 0;
  let detail: string | undefined;

  for (let i = 0; i < to.length; i += RESEND_BATCH_LIMIT) {
    const chunk = to.slice(i, i + RESEND_BATCH_LIMIT);

    try {
      const { data, error } = await resend.batch.send(
        chunk.map((email) => ({ from, to: email, subject, text, html })),
        { idempotencyKey: `notification/${randomUUID()}` },
      );

      if (error) {
        failed += chunk.length;
        detail ??= `${error.name}: ${error.message}`;
      } else if (data) {
        sent += chunk.length;
      } else {
        failed += chunk.length;
        detail ??= "Resend returned neither data nor error";
      }
    } catch (error) {
      failed += chunk.length;
      detail ??=
        error instanceof Error ? `network: ${error.message}` : "network error";
    }
  }

  return { attempted: true, sent, failed, detail };
}
