import { describe, expect, it } from "vitest";
import {
  formatDate,
  getAvatarUrl,
  getRegistrationPercentage,
  getSpotsLeft,
  timeAgo,
} from "@/lib/format";

describe("timeAgo buckets", () => {
  it('returns "" for invalid input', () => {
    expect(timeAgo("not-a-date")).toBe("");
    expect(timeAgo("")).toBe("");
  });

  it('returns "just now" for < 1 minute', () => {
    expect(timeAgo(new Date().toISOString())).toBe("just now");
    expect(timeAgo(new Date(Date.now() - 30_000).toISOString())).toBe("just now");
  });

  it("buckets minutes / hours / days", () => {
    expect(timeAgo(new Date(Date.now() - 5 * 60_000).toISOString())).toBe("5m ago");
    expect(timeAgo(new Date(Date.now() - 3 * 3_600_000).toISOString())).toBe("3h ago");
    expect(timeAgo(new Date(Date.now() - 5 * 86_400_000).toISOString())).toBe("5d ago");
  });

  it("falls back to locale date beyond 30 days", () => {
    const out = timeAgo(new Date(Date.now() - 40 * 86_400_000).toISOString());
    expect(out).not.toBe("");
    expect(out).not.toContain("ago");
  });
});

describe("formatDate", () => {
  it('returns "" for invalid input', () => {
    expect(formatDate("bogus")).toBe("");
  });
});

describe("getSpotsLeft", () => {
  it("returns null without a positive capacity", () => {
    expect(getSpotsLeft(undefined, 10)).toBeNull();
    expect(getSpotsLeft(0, 0)).toBeNull();
    expect(getSpotsLeft(-5, 0)).toBeNull();
  });

  it("subtracts registered and clamps at zero", () => {
    expect(getSpotsLeft(100, 30)).toBe(70);
    expect(getSpotsLeft(50, undefined)).toBe(50);
    expect(getSpotsLeft(10, 15)).toBe(0);
  });
});

describe("getRegistrationPercentage", () => {
  it("returns 0 without a positive capacity", () => {
    expect(getRegistrationPercentage(0, 5)).toBe(0);
    expect(getRegistrationPercentage(undefined, 5)).toBe(0);
  });

  it("computes rounded pct and caps at 100", () => {
    expect(getRegistrationPercentage(100, 25)).toBe(25);
    expect(getRegistrationPercentage(100, undefined)).toBe(0);
    expect(getRegistrationPercentage(100, 150)).toBe(100);
  });
});

describe("getAvatarUrl fallback", () => {
  it("returns the avatar when provided", () => {
    expect(getAvatarUrl("https://cdn.example/a.png", "Ada")).toBe("https://cdn.example/a.png");
  });

  it("falls back to ui-avatars with the name initial", () => {
    const url = getAvatarUrl(null, "ada");
    expect(url).toContain("ui-avatars.com");
    expect(url).toContain("name=A");
  });

  it('defaults to "M" with no name', () => {
    expect(getAvatarUrl(undefined, undefined)).toContain("name=M");
  });
});
