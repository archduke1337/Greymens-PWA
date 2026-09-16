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
}));

vi.mock("@/lib/appwrite", () => ({
  APPWRITE_CONFIG: {
    databaseId: "test-db",
    eventsCollectionId: "events",
    registrationsCollectionId: "registrations",
    projectsCollectionId: "projects",
    eventImagesBucketId: "event-images",
  },
  createAdminClient: () => ({
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
        if (table === COLLECTIONS.POWERS) return { documents: [] };

        return { documents: [] };
      },
    },
  }),
}));

import {
  getEffectiveCapabilities,
  hasServerCapability,
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

beforeEach(() => {
  vi.clearAllMocks();
  db.powers = [];
  db.assignments = [{ ...activeAssignment }];
  db.roles = [{ ...grantingRole }];
  db.offices = [];
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
});
