/**
 * The club's mail shell — client-safe on purpose.
 *
 * Lives apart from lib/email.ts (which pulls the Resend SDK) so the console's
 * notification composer can render the exact preview a member will receive
 * without dragging a server mail library into the browser bundle. One
 * implementation means the preview cannot drift from the sent mail.
 *
 * Bodies are Markdown (lib/markdown.ts): the composer accepts it, the shell
 * renders a safe subset, and raw HTML is escaped rather than rendered.
 *
 * Email clients are not browsers: table layout, inline styles, no CSS
 * variables, no web fonts. The voice is a senior writing to a junior — warm,
 * direct, plain words — on the club's navy-and-blue identity, so a notice
 * reads like Greymens writing to a person rather than a service pinging an
 * inbox.
 */
import { markdownToPlainText, renderMarkdownHtml } from "@/lib/markdown";

const CLUB_NAME = "Greymens Club";
const CLUB_SHORT = "Greymens";
const TAGLINE = "Learn · Build · Belong";
const BRAND = "#3b7df6";
const INK = "#171e2e";
const BODY_INK = "#39415a";
const MUTED_INK = "#6b7488";
const NAVY = "#101a33";
const NAVY_SOFT = "#1b2a52";
const PAPER = "#e9edf4";
const CARD_FOOT = "#f5f8fc";
const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

/** Escape notification text for the HTML part — titles are user input. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailHtml(title: string, body: string): string {
  const content = renderMarkdownHtml(body);
  // Inbox preview line: the first words of the body, markup stripped.
  const preheader = escapeHtml(
    markdownToPlainText(body).replace(/\s+/g, " ").trim().slice(0, 140),
  );

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
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dfe6f1;">
            <tr>
              <td style="background:${NAVY};padding:26px 32px 22px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:.24em;text-transform:uppercase;color:#9fc0ff;">${CLUB_NAME}</p>
                <p style="margin:8px 0 0;font-family:${FONT};font-size:13px;color:#a9b4cf;">${TAGLINE} · School of Engineering, ADYPU</p>
              </td>
            </tr>
            <tr>
              <td style="background:${NAVY_SOFT};padding:10px 32px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;color:#cdd8f2;">A note from your club — worth two minutes over chai.</p>
              </td>
            </tr>
            <tr>
              <td style="height:4px;line-height:4px;font-size:0;background:${BRAND};">&nbsp;</td>
            </tr>
            <tr>
              <td style="padding:30px 32px 2px;">
                <h1 style="margin:0 0 16px;font-family:${FONT};font-size:22px;line-height:1.35;font-weight:700;color:${INK};">${escapeHtml(title)}</h1>
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:6px 32px 28px;">
                <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY_INK};">See you at the next session,<br /><strong style="color:${INK};">Team ${CLUB_SHORT}</strong></p>
              </td>
            </tr>
            <tr>
              <td style="background:${CARD_FOOT};border-top:1px solid #e3e8f0;padding:18px 32px 22px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED_INK};">You are getting this because you are part of ${CLUB_NAME} — a student cybersecurity crew that learns by building together. This inbox is not monitored; the fastest way to reach a human is a message from your dashboard.</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-family:${FONT};font-size:11px;color:${MUTED_INK};">${CLUB_NAME} · ${TAGLINE}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
