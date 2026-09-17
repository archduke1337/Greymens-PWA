import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { GOVERNANCE_OFFICES } from "@/lib/governance";
import { ok, fail } from "@/lib/api";

const OFFICE_CAP = "governance.manage_offices";
const DESIGNATION_CAP = "designations.assign";

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/**
 * Unified read model for position management (offices + designations).
 *
 * The two systems stay separate tables with separate mutation endpoints —
 * single-holder offices with terms and multi-holder designations with
 * maxHolders caps have genuinely different invariants — but administration
 * happens on one page, so the page needs one call, not five. Each section of
 * the response is filtered by the caller's own capabilities: an
 * offices-only manager never sees the designation catalogue and vice versa.
 * Callers with neither capability get 403, same as the underlying endpoints.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const userId = authenticated.user.$id;

  const [canManageOffices, canAssignDesignations] = await Promise.all([
    hasServerCapability(userId, OFFICE_CAP),
    hasServerCapability(userId, DESIGNATION_CAP),
  ]);
  if (!canManageOffices && !canAssignDesignations) {
    return fail("FORBIDDEN", "Position management access is required", 403);
  }

  try {
    const { databases } = createServerDatabases();

    const [assignmentsRes, designationsRes, grantsRes, membershipsRes, departmentsRes] = await Promise.all([
      canManageOffices
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.OFFICE_ASSIGNMENTS, [
            Query.orderDesc("termStart"),
            Query.limit(200),
          ])
        : Promise.resolve({ documents: [] as Array<Record<string, unknown>>, total: 0 }),
      canAssignDesignations
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
            Query.orderAsc("level"),
            Query.limit(100),
          ])
        : Promise.resolve({ documents: [] as Array<Record<string, unknown>>, total: 0 }),
      canAssignDesignations
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
            Query.equal("isActive", [true]),
            Query.limit(500),
          ])
        : Promise.resolve({ documents: [] as Array<Record<string, unknown>>, total: 0 }),
      canManageOffices
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
            Query.equal("status", ["active"]),
            Query.limit(500),
          ])
        : Promise.resolve({ documents: [] as Array<Record<string, unknown>>, total: 0 }),
      canAssignDesignations
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
            Query.orderAsc("displayOrder"),
            Query.limit(200),
          ])
        : Promise.resolve({ documents: [] as Array<Record<string, unknown>>, total: 0 }),
    ]);

    const assignments = assignmentsRes.documents as Array<Record<string, unknown>>;
    const catalogue = designationsRes.documents as Array<Record<string, unknown>>;
    const grants = grantsRes.documents as Array<Record<string, unknown>>;
    const activeMemberships = membershipsRes.documents as Array<Record<string, unknown>>;

    const titleByOffice = new Map(GOVERNANCE_OFFICES.map((office) => [office.id, office.title]));
    const nameByDesignation = new Map(catalogue.map((entry) => [String(entry.$id ?? ""), String(entry.name ?? "")]));

    const holderIds = [
      ...assignments.map((row) => String(row.userId ?? "")),
      ...grants.map((row) => String(row.userId ?? "")),
      ...activeMemberships.map((row) => String(row.userId ?? "")),
    ].filter(Boolean);
    const uniqueIds = [...new Set(holderIds)];

    // Profiles resolve URN/branch for display. Chunked so a large member
    // directory never builds a query string Appwrite rejects.
    const profileRows: Array<Record<string, unknown>> = [];
    for (const ids of chunk(uniqueIds, 100)) {
      if (ids.length === 0) continue;
      const page = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
        Query.equal("userId", ids),
        Query.limit(500),
      ]);
      profileRows.push(...(page.documents as Array<Record<string, unknown>>));
    }
    const profileByUser = new Map(profileRows.map((profile) => [String(profile.userId ?? ""), profile]));

    // Names live on the auth record — best-effort so a lookup failure never
    // fails the whole positions console.
    const accountNames = await getAccountNames(uniqueIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    const displayName = (id: string) =>
      accountNames[id] || String(profileByUser.get(id)?.urn ?? "") || id;

    // Per-person union of everything position-like they hold. Offices and
    // designations stay labelled by source system — merging the labels would
    // lie about which one grants real capabilities (offices do, titles don't).
    const peopleById = new Map<string, {
      userId: string;
      name: string;
      urn?: string;
      branch?: string;
      offices: Array<{ officeId: string; title: string; assignmentId: string; selectionMethod: string; termStart: string; termEnd?: string; status: string }>;
      designations: Array<{ designationId: string; name: string }>;
    }>();
    const person = (id: string) => {
      const existing = peopleById.get(id);
      if (existing) return existing;
      const profile = profileByUser.get(id);
      const created = {
        userId: id,
        name: displayName(id),
        urn: typeof profile?.urn === "string" ? profile.urn : undefined,
        branch: typeof profile?.branch === "string" ? profile.branch : undefined,
        offices: [] as Array<{ officeId: string; title: string; assignmentId: string; selectionMethod: string; termStart: string; termEnd?: string; status: string }>,
        designations: [] as Array<{ designationId: string; name: string }>,
      };
      peopleById.set(id, created);
      return created;
    };

    for (const row of assignments) {
      const id = String(row.userId ?? "");
      if (!id || String(row.status ?? "") !== "active") continue;
      const officeId = String(row.officeId ?? "");
      person(id).offices.push({
        officeId,
        title: titleByOffice.get(officeId) || officeId,
        assignmentId: String(row.$id ?? ""),
        selectionMethod: String(row.selectionMethod ?? ""),
        termStart: String(row.termStart ?? ""),
        termEnd: typeof row.termEnd === "string" ? row.termEnd : undefined,
        status: String(row.status ?? ""),
      });
    }
    for (const row of grants) {
      const id = String(row.userId ?? "");
      if (!id) continue;
      const designationId = String(row.designationId ?? "");
      person(id).designations.push({
        designationId,
        name: nameByDesignation.get(designationId) || designationId,
      });
    }

    // Active-member directory for the office assignment picker. Built from
    // memberships + profiles + names so offices-only managers — who may lack
    // users.view — get a picker instead of a raw ID field.
    const directory = activeMemberships
      .map((row) => String(row.userId ?? ""))
      .filter(Boolean)
      .filter((id, index, all) => all.indexOf(id) === index)
      .map((id) => ({
        userId: id,
        name: displayName(id),
        urn: typeof profileByUser.get(id)?.urn === "string" ? (profileByUser.get(id)?.urn as string) : undefined,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const holderCounts = new Map<string, number>();
    for (const row of grants) {
      const key = String(row.designationId ?? "");
      holderCounts.set(key, (holderCounts.get(key) ?? 0) + 1);
    }

    return ok({
      canManageOffices,
      canAssignDesignations,
      assignments,
      members: directory,
      designations: catalogue.map((entry) => ({
        ...entry,
        holderCount: holderCounts.get(String(entry.$id ?? "")) ?? 0,
      })),
      departments: departmentsRes.documents,
      people: [...peopleById.values()].sort((a, b) => a.name.localeCompare(b.name)),
      accountNames,
    });
  } catch (error) {
    console.error("Positions read-model error:", error);
    return fail("INTERNAL", "Unable to load positions", 500);
  }
}
