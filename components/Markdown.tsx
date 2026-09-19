"use client";

import ReactMarkdown from "react-markdown";
import remarkBreaks from "remark-breaks";
import remarkGfm from "remark-gfm";

/**
 * In-app Markdown body (notifications, announcements).
 *
 * Raw HTML is never rendered: react-markdown escapes it by default, so a
 * `script` tag typed into the console stays inert text. Styling lives in
 * `.md-body` (styles/globals.css), the compact sibling of `.blog-body`.
 */
export default function Markdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className ?? "md-body"}>
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
