/**
 * Tiny dependency-free Markdown subset, client-safe on purpose.
 *
 * Two outputs from one input:
 * - `renderMarkdownHtml` — safe inline HTML for the mail shell (email
 *   clients are not browsers: no classes, inline styles only). Raw HTML in
 *   the source is escaped, never rendered, and links are restricted to
 *   http(s) so a `javascript:` href cannot survive.
 * - `markdownToPlainText` — readable fallback for the text mail part and
 *   for one-line in-app excerpts (bell, dashboard, admin list), where block
 *   markup would otherwise leak raw `#`/`**` characters.
 *
 * Supported: headings (#–###), bold, italic, strikethrough, inline code,
 * links, unordered/ordered lists, blockquotes, horizontal rules, paragraphs
 * and single-newline breaks. Tables and images stay plain text in mail —
 * they are authoring conveniences for the blog, not for an inbox.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Inline spans on already-escaped text. Order matters: code first so markers inside code are inert. */
function renderInline(escaped: string): string {
  const codeSpans: string[] = [];
  // Protect `code` spans from the marker passes below.
  const withoutCode = escaped.replace(/`([^`\n]+)`/g, (_, code: string) => {
    codeSpans.push(
      `<code style="font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.88em;background:#eef2f9;border-radius:4px;padding:1px 5px;">${code}</code>`,
    );

    return `\u0000${codeSpans.length - 1}\u0000`;
  });

  const withLinks = withoutCode.replace(
    /\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_, text: string, url: string) =>
      `<a href="${url}" style="color:#3b7df6;text-decoration:underline;">${text}</a>`,
  );

  const formatted = withLinks
    .replace(/\*\*([^*`\n]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_`*\n]+)__/g, "<strong>$1</strong>")
    .replace(/~~([^~`\n]+)~~/g, "<s>$1</s>")
    // Single-star italic after bold so ** pairs are consumed first.
    .replace(/\*([^*`\n]+)\*/g, "<em>$1</em>")
    .replace(/(^|[\s(])_([^_`\n]+)_/g, "$1<em>$2</em>");

  return formatted.replace(/\u0000(\d+)\u0000/g, (_, index: string) => codeSpans[Number(index)] ?? "");
}

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const PARAGRAPH_STYLE = `margin:0 0 14px;font-family:${FONT};font-size:15px;line-height:1.65;color:#39415a;`;
const HEADING_STYLE = `margin:20px 0 8px;font-family:${FONT};line-height:1.35;font-weight:700;color:#171e2e;`;
const LIST_STYLE = `margin:0 0 14px;padding-left:22px;font-family:${FONT};font-size:15px;line-height:1.65;color:#39415a;`;

export function renderMarkdownHtml(source: string): string {
  const blocks = source.replace(/\r\n/g, "\n").split(/\n{2,}/);
  const out: string[] = [];
  let listKind: "ul" | "ol" | null = null;

  const closeList = () => {
    if (listKind) {
      out.push(listKind === "ul" ? "</ul>" : "</ol>");
      listKind = null;
    }
  };

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const heading = block.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      closeList();
      const level = heading[1].length;
      const size = level === 1 ? 19 : level === 2 ? 17 : 16;
      out.push(
        `<p style="${HEADING_STYLE}font-size:${size}px;">${renderInline(escapeHtml(heading[2]))}</p>`,
      );
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(block)) {
      closeList();
      out.push(
        `<hr style="border:none;border-top:1px solid #e3e8f0;margin:20px 0;" />`,
      );
      continue;
    }

    const quote = block.match(/^((?:>[^\n]*\n?)+)$/);
    if (quote) {
      closeList();
      const inner = block
        .split("\n")
        .map((line) => line.replace(/^>\s?/, "").trim())
        .filter(Boolean)
        .map((line) => renderInline(escapeHtml(line)))
        .join("<br>");
      out.push(
        `<p style="margin:0 0 14px;padding:10px 14px;border-left:3px solid #3b7df6;background:#f4f7fd;font-size:15px;line-height:1.65;font-style:italic;">${inner}</p>`,
      );
      continue;
    }

    const lines = block.split("\n");
    const listLines = lines.filter((line) =>
      /^\s*(?:[-*+]\s+|\d+[.)]\s+)/.test(line),
    );
    if (listLines.length > 0 && listLines.length === lines.length) {
      const ordered = /^\s*\d+[.)]\s+/.test(lines[0]);
      const kind = ordered ? "ol" : "ul";
      if (listKind !== kind) {
        closeList();
        out.push(kind === "ul" ? `<ul style="${LIST_STYLE}">` : `<ol style="${LIST_STYLE}">`);
        listKind = kind;
      }
      for (const line of lines) {
        const text = line.replace(/^\s*(?:[-*+]\s+|\d+[.)]\s+)/, "");
        out.push(
          `<li style="margin:2px 0;">${renderInline(escapeHtml(text))}</li>`,
        );
      }
      continue;
    }

    closeList();
    out.push(
      `<p style="${PARAGRAPH_STYLE}">${renderInline(escapeHtml(block)).replace(/\n/g, "<br>")}</p>`,
    );
  }

  closeList();

  return out.join("");
}

/** Strip Markdown markers for text-only surfaces (mail text part, excerpts). */
export function markdownToPlainText(source: string): string {
  return source
    .replace(/\r\n/g, "\n")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, "$1 ($2)")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/(\*\*|__)([^*_]+)\1/g, "$2")
    .replace(/(^|[\s(])\*([^*\n]+)\*/g, "$1$2")
    .replace(/(^|[\s(])_([^_\n]+)_/g, "$1$2")
    .replace(/~~([^~]+)~~/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .replace(/^\s*\d+[.)]\s+/gm, "• ")
    .replace(/^(-{3,}|\*{3,}|_{3,})$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
