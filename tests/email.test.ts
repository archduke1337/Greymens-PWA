import { describe, expect, it, afterEach } from "vitest";

import {
  escapeHtml,
  isEmailConfigured,
  sendBulkEmail,
} from "@/lib/email";

const RESEND_KEY = "RESEND_API_KEY";
const FROM_KEY = "EMAIL_FROM";

afterEach(() => {
  delete process.env[RESEND_KEY];
  delete process.env[FROM_KEY];
});

describe("escapeHtml", () => {
  it("escapes markup so notification text cannot inject HTML", () => {
    expect(escapeHtml('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
    expect(escapeHtml("a & b 'c'")).toBe("a &amp; b &#39;c&#39;");
  });
});

describe("isEmailConfigured", () => {
  it("is false unless both the key and the sender are set", () => {
    expect(isEmailConfigured()).toBe(false);
    process.env[RESEND_KEY] = "re_test";
    expect(isEmailConfigured()).toBe(false);
    process.env[FROM_KEY] = "club@example.com";
    expect(isEmailConfigured()).toBe(true);
  });
});

describe("sendBulkEmail", () => {
  it("skips honestly when the channel is not configured", async () => {
    const report = await sendBulkEmail(
      [{ email: "a@example.com" }],
      "Hello",
      "Body",
    );

    expect(report).toEqual({
      attempted: false,
      sent: 0,
      failed: 0,
      reason: "not_configured",
    });
  });

  it("skips when there is nobody to mail", async () => {
    process.env[RESEND_KEY] = "re_test";
    process.env[FROM_KEY] = "club@example.com";
    const report = await sendBulkEmail([], "Hello", "Body");

    expect(report.reason).toBe("no_recipients");
    expect(report.attempted).toBe(false);
  });
});
