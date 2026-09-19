/**
 * The club's mail shell — client-safe on purpose.
 *
 * Lives apart from lib/email.ts (which pulls the Resend SDK) so the console's
 * notification composer can render the exact preview a member will receive
 * without dragging a server mail library into the browser bundle. One
 * implementation means the preview cannot drift from the sent mail.
 *
 * Email clients are not browsers: table layout, inline styles, no CSS
 * variables, no web fonts. The palette mirrors the site's accent (a vivid club
 * blue) on warm paper, so a decision letter reads like the club writing to a
 * person rather than a monitoring service.
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

/** Escape notification text for the HTML part — titles/bodies are user input. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderEmailHtml(title: string, body: string): string {
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
