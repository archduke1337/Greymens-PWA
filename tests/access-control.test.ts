import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

import { COLLECTIONS } from "@/lib/database";

const { resolveMembershipStatus, requireAuthenticatedUser } = vi.hoisted(
  () => ({
    resolveMembershipStatus: vi.fn(),
    requireAuthenticatedUser: vi.fn(),
  }),
);

vi.mock("@/lib/server-auth", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/server-auth")>();

  return {
    ...actual,
    resolveMembershipStatus,
    requireAuthenticatedUser,
  };
});

// In-memory stand-ins for the Appwrite tables access-control reads.
const db = vi.hoisted(() => ({
  powers: [] as Array<Record<string, unknown>>,
  assignments: [] as Array<Record<string, unknown>>,
  roles: [] as Array<Record<string, unknown>>,
  offices: [] as Array<Record<string, unknown>>,
  userDesignations: [] as Array<Record<string, unknown>>,
  designations: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/appwrite", () => ({
  APPWRITE_CONFIG: {
    databaseId: "test-db",
    eventsCollectionId: "events",
    registrationsCollectionId: "registrations",
    projectsCollectionId: "projects",
    eventImagesBucketId: "event-images",
  },
}));

vi.mock("@/lib/appwrite-server", () => ({
  createServerDatabases: () => ({
    databases: {
      listDocuments: async (
        _dbId: string,
        table: string,
        _queries?: unknown,
      ) => {
        if (table === COLLECTIONS.USER_POWERS)
          return { documents: db.powers };
        if (table === COLLECTIONS.ROLE_ASSIGNMENTS)
          return { documents: db.assignments };
        if (table === COLLECTIONS.ROLE_TEMPLATES)
          return { documents: db.roles };
        if (table === COLLECTIONS.OFFICE_ASSIGNMENTS)
          return { documents: db.offices };
        if (table === COLLECTIONS.USER_DESIGNATIONS)
          return { documents: db.userDesignations };
        if (table === COLLECTIONS.DESIGNATIONS)
          return { documents: db.designations };
        if (table === COLLECTIONS.POWERS) return { documents: [] };

        return { documents: [] };
      },
    },
  }),
}));

import {
  getEffectiveCapabilities,
  hasServerCapability,
  officeCapabilities,
  requireCapability,
} from "@/lib/access-control";

const grantingRole = {
  $id: "role-1",
  capabilities: ["events.manage"],
  isActive: true,
};

const activeAssignment = {
  $id: "assign-1",
  userId: "u1",
  roleId: "role-1",
  scopeType: "global",
  isActive: true,
};

/** A live presidential term. OFFICE_CAPABILITIES.president includes membership.approve. */
const presidentOffice = {
  $id: "oa-1",
  userId: "u1",
  officeId: "president",
  status: "active",
  termStart: "2026-01-01",
  termEnd: "2099-01-01",
};

beforeEach(() => {
  vi.clearAllMocks();
  db.powers = [];
  db.assignments = [{ ...activeAssignment }];
  db.roles = [{ ...grantingRole }];
  db.offices = [];
  db.userDesignations = [];
  db.designations = [];
});

describe("restricted statuses keep no capabilities", () => {
  it.each(["banned", "suspended", "deactivated"])(
    "%s user with a live grant row gets an empty set",
    async (status) => {
      resolveMembershipStatus.mockResolvedValue(status);
      const caps = await getEffectiveCapabilities("u1");

      expect(caps.size).toBe(0);
      expect(await hasServerCapability("u1", "events.manage")).toBe(false);
    },
  );

  it("requireCapability answers 403 for a banned user holding a grant", async () => {
    resolveMembershipStatus.mockResolvedValue("banned");
    requireAuthenticatedUser.mockResolvedValue({
      user: { $id: "u1" },
      response: undefined,
    });
    const res = await requireCapability(
      new NextRequest("http://localhost/admin/events"),
      "events.manage",
    );

    expect(res.user).toBeNull();
    expect(res.response?.status).toBe(403);
  });

  it("member control: the same grant row still grants", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.manage")).toBe(true);
  });
});

describe("grant Hygiene", () => {
  it("ignores assignments with unknown scope types (fail closed)", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [{ ...activeAssignment, scopeType: "planet" }];
    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.manage")).toBe(false);
  });

  it("ignores non-vocabulary strings smuggled through role templates", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.roles = [
      { ...grantingRole, capabilities: ["events.manage", "*", "not_a_cap"] },
    ];
    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.manage")).toBe(true);
    expect(caps.has("*")).toBe(false);
    expect(caps.has("not_a_cap")).toBe(false);
  });

  it("grants nothing from a switched-off template", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.roles = [{ ...grantingRole, isActive: false }];
    const caps = await getEffectiveCapabilities("u1");

    expect(caps.size).toBe(0);
  });
});

describe("an office is a role template plus a term", () => {
  it("reads the office's capabilities from its template", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [
      {
        $id: "office-president",
        officeId: "president",
        capabilities: ["events.publish"],
        isActive: true,
      },
    ];
    db.offices = [{ ...presidentOffice }];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.publish")).toBe(true);
    // The compile-time map is a seed default only — it must not also apply, or
    // editing the template would not actually change the office.
    expect(caps.has("membership.approve")).toBe(false);
  });

  it("grants nothing when the office template is switched off", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [
      {
        $id: "office-president",
        officeId: "president",
        capabilities: ["events.publish"],
        isActive: false,
      },
    ];
    db.offices = [{ ...presidentOffice }];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.publish")).toBe(false);
    // Not the seed default either: "inactive" must not fall back to "absent".
    expect(caps.has("membership.approve")).toBe(false);
  });

  it("falls back to the seed default when no template exists", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [];
    db.offices = [{ ...presidentOffice }];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("membership.approve")).toBe(true);
  });

  it("an ended term grants nothing, template or not", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [];
    db.offices = [{ ...presidentOffice, termEnd: "2000-01-01" }];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.size).toBe(0);
  });

  it("a designation carries only the capabilities listed on it", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [];
    db.userDesignations = [
      { $id: "ud-1", userId: "u1", designationId: "d-1", isActive: true },
    ];
    db.designations = [
      { $id: "d-1", name: "Head of Web", level: 4, capabilities: ["events.manage"] },
    ];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("events.manage")).toBe(true);
    // The level must not grant anything: 4 is just seniority for display.
    expect(caps.has("view_department_stats")).toBe(false);
  });

  it("a title with no capabilities grants nothing", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [];
    db.userDesignations = [
      { $id: "ud-1", userId: "u1", designationId: "d-1", isActive: true },
    ];
    db.designations = [
      { $id: "d-1", name: "Member of the Month", level: 2, capabilities: [] },
    ];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.size).toBe(0);
  });

  it("a title cannot smuggle a non-vocabulary capability", async () => {
    resolveMembershipStatus.mockResolvedValue("member");
    db.assignments = [];
    db.roles = [];
    db.userDesignations = [
      { $id: "ud-1", userId: "u1", designationId: "d-1", isActive: true },
    ];
    db.designations = [
      { $id: "d-1", name: "Sneaky", level: 9, capabilities: ["*", "not_a_cap"] },
    ];

    const caps = await getEffectiveCapabilities("u1");

    expect(caps.has("*")).toBe(false);
    expect(caps.has("not_a_cap")).toBe(false);
  });

  it("officeCapabilities prefers the template and honours its off switch", () => {
    const template = [
      {
        officeId: "president",
        capabilities: ["audit.view"],
        isActive: true,
      },
    ];

    expect(officeCapabilities("president", template)).toEqual(["audit.view"]);
    expect(
      officeCapabilities("president", [{ ...template[0], isActive: false }]),
    ).toEqual([]);
    // No template at all: the seeded default, which is a superset of audit.view.
    expect(officeCapabilities("president", []).length).toBeGreaterThan(1);
    // Unknown office: nothing.
    expect(officeCapabilities("not_an_office", [])).toEqual([]);
  });
});
