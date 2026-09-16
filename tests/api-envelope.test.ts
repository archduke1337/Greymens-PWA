import { describe, expect, it } from "vitest";
import { ApiError, fail, ok } from "@/lib/api";

describe("ok envelope", () => {
  it("returns { success, data spread } with 200 by default", async () => {
    const res = ok({ hello: "world" });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: "world" });
    expect(body.hello).toBe("world");
  });

  it("honours a custom status", async () => {
    const res = ok({ id: "1" }, 201);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });
});

describe("fail envelope", () => {
  it("returns { success:false, error:{ code, message } } + status", async () => {
    const res = fail("NOT_FOUND", "Missing", 404);
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toEqual({ code: "NOT_FOUND", message: "Missing" });
  });

  it("spreads extra fields alongside the envelope", async () => {
    const res = fail("VALIDATION", "Bad input", 422, { fields: ["email"] });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
    expect(body.fields).toEqual(["email"]);
  });
});

describe("envelope integrity", () => {
  it("payload keys cannot overwrite the success flag", async () => {
    const res = ok({ success: false, hello: "world" } as unknown as Record<string, unknown>);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ hello: "world" });
    expect(body.hello).toBe("world");
  });
  it("extra keys cannot overwrite the error object", async () => {
    const res = fail("VALIDATION", "Bad input", 422, {
      error: "forged",
      success: true,
      fields: ["email"],
    });
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.error).toEqual({ code: "VALIDATION", message: "Bad input" });
    expect(body.fields).toEqual(["email"]);
  });
  it("ok({ success: true }) keeps the legacy flattened shape", async () => {
    const body = await (await ok({ success: true })).json();
    expect(body.success).toBe(true);
  });
});

describe("ApiError helpers", () => {
  it("maps helpers to status codes", async () => {
    const cases = [
      [ApiError.unauthorized(), 401, "UNAUTHENTICATED"],
      [ApiError.forbidden(), 403, "FORBIDDEN"],
      [ApiError.notFound(), 404, "NOT_FOUND"],
      [ApiError.conflict("clash"), 409, "CONFLICT"],
      [ApiError.validation("bad"), 422, "VALIDATION"],
      [ApiError.rateLimited(), 429, "RATE_LIMITED"],
      [ApiError.internal(), 500, "INTERNAL"],
    ] as const;
    for (const [res, status, code] of cases) {
      expect(res.status).toBe(status);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe(code);
    }
  });
});
