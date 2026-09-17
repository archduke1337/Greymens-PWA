import { describe, expect, it } from "vitest";
import {
  validateGovernanceRole,
  validateProfilePatch,
} from "@/lib/profile-fields";

describe("validateProfilePatch", () => {
  it("accepts a clean partial patch", () => {
    const result = validateProfilePatch({ bio: "Hello", pronouns: "they/them" });
    expect(result).toEqual({ data: { bio: "Hello", pronouns: "they/them" } });
  });

  it("rejects unknown fields for member self-service", () => {
    const result = validateProfilePatch({ bio: "x", userId: "evil" });
    expect("error" in result).toBe(true);
  });

  it("ignores (never writes) unknown fields for the admin console", () => {
    const result = validateProfilePatch(
      { bio: "x", $id: "abc", userId: "u1", avatar: "http://x/y.png" },
      { unknownFields: "ignore" },
    );
    expect(result).toEqual({ data: { bio: "x" } });
  });

  it("rejects overlong phone numbers that the database column cannot hold", () => {
    // profiles.phone is varchar(20): validation must stay within it.
    const result = validateProfilePatch({ phone: "+91 98765 43210 ext 12345" });
    expect("error" in result).toBe(true);
    expect(validateProfilePatch({ phone: "+919876543210" })).toEqual({
      data: { phone: "+919876543210" },
    });
  });

  it("rejects non-http(s) profile URLs", () => {
    expect(
      "error" in validateProfilePatch({ githubUrl: "javascript:alert(1)" }),
    ).toBe(true);
    expect(
      "error" in validateProfilePatch({ instagramUrl: "not a url" }),
    ).toBe(true);
  });

  it("treats social URLs as optional", () => {
    expect(validateProfilePatch({})).toEqual({ data: {} });
    expect(
      validateProfilePatch({ instagramUrl: "https://instagram.com/greymens" }),
    ).toEqual({ data: { instagramUrl: "https://instagram.com/greymens" } });
    expect(validateProfilePatch({ instagramUrl: "" })).toEqual({
      data: { instagramUrl: null },
    });
  });

  it("rejects enum values outside the catalogue", () => {
    expect("error" in validateProfilePatch({ gender: "robot" })).toBe(true);
  });

  it("normalizes blanks to null and dedupes arrays", () => {
    expect(validateProfilePatch({ bio: "   " })).toEqual({
      data: { bio: null },
    });
    expect(
      validateProfilePatch({ skills: ["react", "react", " node "] }),
    ).toEqual({ data: { skills: ["react", "node"] } });
  });

  it("rejects oversized or non-string arrays", () => {
    expect("error" in validateProfilePatch({ skills: ["ok", 42] })).toBe(true);
    expect(
      "error" in validateProfilePatch({
        skills: Array.from({ length: 51 }, (_, i) => `skill-${i}`),
      }),
    ).toBe(true);
  });
});

describe("validateGovernanceRole", () => {
  it("accepts only admin/dev", () => {
    expect(validateGovernanceRole("admin")).toBe("admin");
    expect(validateGovernanceRole("dev")).toBe("dev");
    expect(validateGovernanceRole("member")).toBeNull();
    expect(validateGovernanceRole(" lead ")).toBeNull();
  });
});
