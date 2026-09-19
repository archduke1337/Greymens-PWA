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
 */

import { randomUUID } from "node:crypto";

import { Resend } from "resend";

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

/** Escape notification text for the HTML part — titles/bodies are user input. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(title: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`)
    .join("");

  return (
    `<!doctype html><html><body style="font-family:sans-serif;line-height:1.6;color:#111">` +
    `<h2>${escapeHtml(title)}</h2>${paragraphs}` +
    `<hr><p style="font-size:12px;color:#666">Greymens Club notification — reply to this email is not monitored.</p>` +
    `</body></html>`
  );
}

const RESEND_BATCH_LIMIT = 50;

/**
 * Send one subject/body to many recipients in 50-address SDK batches.
 *
 * Follows the SDK contract: `{ data, error }` is inspected per batch, with
 * `try/catch` reserved for network-level failures only. A unique
 * idempotency key per batch makes retried requests safe. Provider
 * failures are counted in `failed` (first message kept in `detail`) so a
 * dead mail provider degrades the report, not the in-app fan-out around it.
 */
export async function sendBulkEmail(
  recipients: EmailRecipient[],
  subject: string,
  body: string,
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
  const html = renderHtml(subject, body);
  let sent = 0;
  let failed = 0;
  let detail: string | undefined;

  for (let i = 0; i < to.length; i += RESEND_BATCH_LIMIT) {
    const batch = to.slice(i, i + RESEND_BATCH_LIMIT);

    try {
      const { data, error } = await resend.emails.send(
        {
          from,
          to: batch,
          subject,
          text: body,
          html,
        },
        { idempotencyKey: `notification/${randomUUID()}` },
      );

      if (error) {
        failed += batch.length;
        detail ??= `${error.name}: ${error.message}`;
      } else if (data) {
        sent += batch.length;
      } else {
        failed += batch.length;
        detail ??= "Resend returned neither data nor error";
      }
    } catch (error) {
      failed += batch.length;
      detail ??=
        error instanceof Error ? `network: ${error.message}` : "network error";
    }
  }

  return { attempted: true, sent, failed, detail };
}
