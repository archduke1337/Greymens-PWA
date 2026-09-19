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

/**
 * The club shell every notice wears.
 *
 * Email clients are not browsers: table layout, inline styles, no CSS
 * variables, no web fonts, and a dark-mode client that will happily invert
 * anything without an explicit colour. The palette mirrors the site's accent
 * (a vivid club blue) on warm paper, so a decision letter reads like it came
 * from the club rather than from a monitoring service. The sign-off is
 * deliberately human — these notices are the club talking to a person.
 */
const CLUB_NAME = "Greymens Club";
const CLUB_TAGLINE = "Learn · Build · Belong";
const BRAND = "#3b7df6";
const INK = "#171e2e";
const BODY_INK = "#39415a";
const MUTED_INK = "#6b7488";
const NAVY = "#101a33";
const PAPER = "#eef1f6";
const CARD_FOOT = "#f7f9fc";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function renderHtml(title: string, body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map(
      (block) =>
        `<p style="margin:0 0 16px;font-family:${FONT};font-size:15px;line-height:1.65;color:${BODY_INK};">${escapeHtml(
          block,
        ).replace(/\n/g, "<br>")}</p>`,
    )
    .join("");
  // Inbox preview line: the first words of the body, hidden inside the card.
  const preheader = escapeHtml(body.replace(/\s+/g, " ").trim().slice(0, 140));

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${PAPER};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${preheader}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${PAPER};">
      <tr>
        <td align="center" style="padding:32px 12px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f0;">
            <tr>
              <td style="background:${NAVY};padding:24px 32px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#9fc0ff;">${CLUB_NAME}</p>
                <p style="margin:6px 0 0;font-family:${FONT};font-size:13px;color:#8f9bb8;">${CLUB_TAGLINE}</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background:${BRAND};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:32px 32px 4px;">
                <h1 style="margin:0 0 18px;font-family:${FONT};font-size:21px;line-height:1.35;font-weight:700;color:${INK};">${escapeHtml(title)}</h1>
                ${paragraphs}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 32px 28px;">
                <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY_INK};">Warmly,<br /><strong style="color:${INK};">The ${CLUB_NAME} team</strong></p>
              </td>
            </tr>
            <tr>
              <td style="background:${CARD_FOOT};border-top:1px solid #e3e8f0;padding:18px 32px 22px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED_INK};">You are receiving this because you are part of ${CLUB_NAME}. Replies here are not monitored — the fastest way to reach a human is a message from your dashboard.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:${FONT};font-size:11px;color:${MUTED_INK};">${CLUB_NAME} · ${CLUB_TAGLINE}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
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
