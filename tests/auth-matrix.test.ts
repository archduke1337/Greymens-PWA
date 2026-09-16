import { describe, expect, it } from "vitest";
import {
  buildUserContext,
  canGrantPower,
  hasPermission,
  resolvePermissions,
} from "@/lib/permissions";
import { OFFICE_CAPABILITIES, isCapability } from "@/lib/capabilities";
import { GOVERNED_PAGES, pagesForCapabilities } from "@/lib/governance";

/**
 * Authorization matrix — the single most important regression suite.
 * Pure unit tests (no DB): applicant/member/lead/head/admin vs sensitive ops.
 * Mirrors Blueprint §53: Applicant→approve 403, Member→verify 403, etc.
 * Client-side resolve mirrored server-side by requireCapability wildcard.
 */

const ctx = (status: Parameters<typeof buildUserContext>[0]["status"], extra = {}) =>
  buildUserContext({
    status,
    powers: [],
    departments: [],
    designations: [],
    ...extra,
  });

describe("status baseline", () => {
  it("anonymous/no_account has nothing", () => {
    expect(hasPermission(ctx("no_account"), "register_events")).toBe(false);
    expect(hasPermission(ctx("no_account"), "view_public_content")).toBe(false);
  });
  it("applicant cannot approve membership or verify tickets", () => {
    const u = ctx("applicant");
    expect(hasPermission(u, "approve_applications")).toBe(false);
    expect(hasPermission(u, "verify_tickets")).toBe(false);
    expect(hasPermission(u, "submit_application")).toBe(true);
  });
  it("member can register but cannot verify tickets or approve", () => {
    const u = ctx("member");
    expect(hasPermission(u, "register_events")).toBe(true);
    expect(hasPermission(u, "verify_tickets")).toBe(false);
    expect(hasPermission(u, "approve_applications")).toBe(false);
  });
  it("banned/suspended-equivalent has nothing", () => {
    expect(resolvePermissions(ctx("banned")).size).toBe(0);
  });
  it("admin has everything via ALL_PERMISSIONS", () => {
    const u = ctx("admin");
    expect(hasPermission(u, "approve_applications")).toBe(true);
    expect(hasPermission(u, "verify_tickets")).toBe(true);
    expect(hasPermission(u, "anything_at_all")).toBe(true);
  });
});

describe("scoped capabilities fail closed", () => {
  it("department-scoped cap requires scope", async () => {
    const { SCOPED_CAPABILITIES } = await import("@/lib/permissions");
    expect(SCOPED_CAPABILITIES).toContain("manage_department_team");
    const lead = buildUserContext({
      status: "lead",
      powers: [],
      departments: [{ departmentId: "eng", role: "lead", isActive: true } as never],
      designations: [],
    });
    expect(hasPermission(lead, "manage_department_team")).toBe(false);
    expect(hasPermission(lead, "manage_department_team", "department:eng")).toBe(true);
    expect(hasPermission(lead, "manage_department_team", "department:other")).toBe(false);
  });
});

describe("power expiry", () => {
  it("expired powers grant nothing", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const u = buildUserContext({
      status: "member",
      powers: [{ powerId: "ticket_verifier", isActive: true, expiresAt: past } as never],
      departments: [],
      designations: [],
      allPowers: [{ $id: "p1", name: "ticket_verifier" } as never],
    });
    expect(hasPermission(u, "verify_tickets")).toBe(false);
  });
  it("active power grants (id or name)", () => {
    const mk = (powerId: string) =>
      buildUserContext({
        status: "member",
        powers: [{ powerId, isActive: true } as never],
        departments: [],
        designations: [],
        allPowers: [{ $id: "p1", name: "ticket_verifier" } as never],
      });
    expect(hasPermission(mk("ticket_verifier"), "verify_tickets")).toBe(true);
    expect(hasPermission(mk("p1"), "verify_tickets")).toBe(true);
  });
});

describe("grant rules fail closed for restricted grantors", () => {
  it("banned/suspended/deactivated grant nothing, even blanket powers", () => {
    for (const status of ["banned", "suspended", "deactivated"] as const) {
      const grantor = ctx(status);
      expect(canGrantPower(grantor, "blog_creator")).toBe(false);
      expect(canGrantPower(grantor, "gallery_uploader")).toBe(false);
      expect(canGrantPower(grantor, "ticket_verifier", "eng")).toBe(false);
    }
  });
  it("members keep the blanket create/upload grants", () => {
    expect(canGrantPower(ctx("member"), "blog_creator")).toBe(true);
    expect(canGrantPower(ctx("member"), "ticket_verifier", "eng")).toBe(false);
  });
});

describe("designation levels never wildcard", () => {
  it("level 10 grants bounded perms, not ALL_PERMISSIONS", () => {
    const u = buildUserContext({
      status: "member",
      powers: [],
      departments: [],
      designations: [{ designationId: "d10", isActive: true } as never],
      allDesignations: [{ $id: "d10", level: 10 } as never],
    });
    const perms = resolvePermissions(u);
    expect(perms.has("ALL_PERMISSIONS")).toBe(false);
  });
});

describe("governance vocabulary", () => {
  it("every OFFICE_CAPABILITIES entry is a real capability", () => {
    for (const [office, caps] of Object.entries(OFFICE_CAPABILITIES)) {
      for (const c of caps) expect(isCapability(c), `${office} -> ${c}`).toBe(true);
    }
  });
  it("admin sees all governed pages; member sees none of admin console", () => {
    expect(pagesForCapabilities(new Set(["*"])).length).toBe(GOVERNED_PAGES.length);
    expect(pagesForCapabilities(["register_events"] as never).length).toBe(0);
  });
  it("membership_lead sees membership review", () => {
    const pages = pagesForCapabilities(OFFICE_CAPABILITIES["membership_lead"]);
    expect(pages.some((p) => p.href === "/admin/membership")).toBe(true);
  });
});
