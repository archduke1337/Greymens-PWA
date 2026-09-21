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
 * Deliberately plain: a single column, system type, one accent rule, no
 * hero banner and no brand voice. Email clients are not browsers — table
 * layout, inline styles, no CSS variables, no web fonts — and a notice earns
 * attention by being short and legible, not by looking designed.
 */
import { markdownToPlainText, renderMarkdownHtml } from "@/lib/markdown";

const CLUB_NAME = "Greymens Club";
const ACCENT = "#2f6fed";
const INK = "#1a1d23";
const BODY_INK = "#3a3f4a";
const MUTED_INK = "#6e7683";
const PAPER = "#f4f5f7";
const RULE = "#e3e6eb";
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

export function renderEmailHtml(
  title: string,
  body: string,
  signoff?: string,
): string {
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
        <td align="center" style="padding:28px 16px;">
          <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${RULE};border-radius:8px;">
            <tr>
              <td style="padding:20px 28px 0;">
                <p style="margin:0;font-family:${FONT};font-size:13px;font-weight:600;color:${INK};">${CLUB_NAME}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 28px 0;">
                <h1 style="margin:0;font-family:${FONT};font-size:20px;line-height:1.4;font-weight:700;color:${INK};">${escapeHtml(title)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 0;">
                <div style="border-top:2px solid ${ACCENT};font-size:0;line-height:0;">&nbsp;</div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;">
                ${content}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 28px 24px;">
                <p style="margin:0;font-family:${FONT};font-size:14px;line-height:1.6;color:${BODY_INK};">${signoff ? `Office of the ${escapeHtml(signoff)}<br>` : ""}&mdash; Team Greymens</p>
              </td>
            </tr>
            <tr>
              <td style="border-top:1px solid ${RULE};padding:14px 28px 18px;">
                <p style="margin:0;font-family:${FONT};font-size:12px;line-height:1.6;color:${MUTED_INK};">You received this because you have a ${CLUB_NAME} account. Manage notifications from your dashboard.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
