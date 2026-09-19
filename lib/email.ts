/**
 * Outbound email, server-only.
 *
 * Transport is Resend over plain HTTPS (`fetch`, no SDK dependency):
 * `RESEND_API_KEY` sends, `EMAIL_FROM` is the sender identity (must be a
 * verified sender on the Resend account). Both unset means the channel is
 * off — callers check `isEmailConfigured()` and report "email skipped (not
 * configured)" instead of failing the in-app send. There is deliberately no
 * fallback transport: silently downgrading to an unconfigured SMTP relay
 * would blackhole mail, which is worse than an honest skip.
 *
 * This module imports nothing browser- or Appwrite-bound so it stays unit
 * testable; the only I/O is the Resend call in `sendBulkEmail`.
 */

export interface EmailRecipient {
  email: string;
  name?: string;
}

export interface EmailReport {
  attempted: boolean;
  sent: number;
  failed: number;
  reason?: string;
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
 * Send one subject/body to many recipients in 50-address Resend batches.
 * Never throws for transport failures — they are counted in `failed` so a
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

  const html = renderHtml(subject, body);
  let sent = 0;
  let failed = 0;

  for (let i = 0; i < to.length; i += RESEND_BATCH_LIMIT) {
    const batch = to.slice(i, i + RESEND_BATCH_LIMIT);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ from, to: batch, subject, text: body, html }),
      });

      if (response.ok) sent += batch.length;
      else failed += batch.length;
    } catch {
      failed += batch.length;
    }
  }

  return { attempted: true, sent, failed };
}
