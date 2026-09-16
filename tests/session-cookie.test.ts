import { describe, expect, it } from "vitest";
import { resolveSessionSecret } from "@/lib/server-auth";
import { SESSION_COOKIE_NAME } from "@/lib/appwrite";

describe("resolveSessionSecret", () => {
  it("prefers the first-party mirror over native cookies", () => {
    expect(
      resolveSessionSecret([
        { name: "gm_session", value: "mirror-secret" },
        { name: "a_session_proj", value: "native-secret" },
      ]),
    ).toBe("mirror-secret");
    expect(SESSION_COOKIE_NAME).toBe("gm_session");
  });

  it("decodes a URI-encoded mirror value", () => {
    expect(
      resolveSessionSecret([
        { name: "gm_session", value: encodeURIComponent("abc/def+ghi") },
      ]),
    ).toBe("abc/def+ghi");
  });

  it("falls back to the native Appwrite cookie", () => {
    expect(
      resolveSessionSecret([{ name: "a_session_proj", value: "native" }]),
    ).toBe("native");
  });

  it("honors the legacy cookie so old sessions are not stranded", () => {
    expect(
      resolveSessionSecret([{ name: "a_session_legacy", value: "old" }]),
    ).toBe("old");
  });

  it("ignores the bare a_session_ prefix with no project", () => {
    expect(resolveSessionSecret([{ name: "a_session_", value: "x" }])).toBeNull();
  });

  it("returns null with no session cookies", () => {
    expect(
      resolveSessionSecret([{ name: "theme", value: "dark" }]),
    ).toBeNull();
    expect(resolveSessionSecret([])).toBeNull();
  });

  it("treats an empty mirror as absent and falls through", () => {
    expect(
      resolveSessionSecret([
        { name: "gm_session", value: "" },
        { name: "a_session_proj", value: "native" },
      ]),
    ).toBe("native");
  });
});
