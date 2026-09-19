import { describe, expect, it } from "vitest";

import { markdownToPlainText, renderMarkdownHtml } from "@/lib/markdown";

describe("renderMarkdownHtml", () => {
  it("renders bold, italic, and links", () => {
    const html = renderMarkdownHtml(
      "**Friday session** moved. *Bring laptops.* See [notes](https://example.com/n).",
    );

    expect(html).toContain("<strong>Friday session</strong>");
    expect(html).toContain("<em>Bring laptops.</em>");
    expect(html).toContain('<a href="https://example.com/n"');
  });

  it("escapes raw HTML instead of rendering it", () => {
    const html = renderMarkdownHtml('<script>alert("x")</script>');

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("drops non-http(s) link targets", () => {
    const html = renderMarkdownHtml("[click](javascript:alert(1))");

    expect(html).not.toContain("javascript:");
    expect(html).toContain("click");
  });

  it("renders lists and headings", () => {
    const html = renderMarkdownHtml("# Update\n\n- one\n- two");

    expect(html).toContain("Update");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
  });
});

describe("markdownToPlainText", () => {
  it("strips markers but keeps words and link targets", () => {
    expect(
      markdownToPlainText("**Hi** see [notes](https://example.com/n) `code`"),
    ).toBe("Hi see notes (https://example.com/n) code");
  });

  it("turns list markers into bullets", () => {
    expect(markdownToPlainText("- one\n- two")).toBe("• one\n• two");
  });
});
