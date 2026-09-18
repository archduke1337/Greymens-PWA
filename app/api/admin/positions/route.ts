import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { ok, fail } from "@/lib/api";

const DESIGNATION_CAP = "designations.assign";

function chunk<T>(values: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

/**
 * Read model for the designations console.
 *
 * Offices used to share this endpoint's page and payload. They moved to the
 * Access console because an office *is* a capability bundle: it is administered
 * where capabilities are. A designation grants nothing — it is a title — so it
 * stays here, alone, and an office manager no longer needs this endpoint to
 * have rights over titles.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, DESIGNATION_CAP);
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();

    const [designationsRes, grantsRes, departmentsRes] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
        Query.equal("isActive", [true]),
        Query.orderAsc("level"),
        Query.limit(100),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
        Query.equal("isActive", [true]),
        Query.limit(500),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.orderAsc("displayOrder"),
        Query.limit(200),
      ]),
    ]);

    const catalogue = designationsRes.documents as Array<Record<string, unknown>>;
    const grants = grantsRes.documents as Array<Record<string, unknown>>;
    const nameByDesignation = new Map(
      catalogue.map((entry) => [String(entry.$id ?? ""), String(entry.name ?? "")]),
    );

    const holderIds = [...new Set(grants.map((row) => String(row.userId ?? "")).filter(Boolean))];

    // Profiles resolve URN for display. Chunked so a large member directory
    // never builds a query string Appwrite rejects.
    const profileRows: Array<Record<string, unknown>> = [];
    for (const ids of chunk(holderIds, 100)) {
      if (ids.length === 0) continue;
      const page = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
        Query.equal("userId", ids),
        Query.limit(500),
      ]);
      profileRows.push(...(page.documents as Array<Record<string, unknown>>));
    }
    const profileByUser = new Map(
      profileRows.map((profile) => [String(profile.userId ?? ""), profile]),
    );

    // Names live on the auth record — best-effort so a lookup failure never
    // fails the console.
    const accountNames = await getAccountNames(holderIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    const peopleById = new Map<
      string,
      {
        userId: string;
        name: string;
        urn?: string;
        designations: Array<{ designationId: string; name: string }>;
      }
    >();
    for (const row of grants) {
      const id = String(row.userId ?? "");
      if (!id) continue;
      let person = peopleById.get(id);
      if (!person) {
        const profile = profileByUser.get(id);
        person = {
          userId: id,
          name: accountNames[id] || String(profile?.urn ?? "") || id,
          urn: typeof profile?.urn === "string" ? profile.urn : undefined,
          designations: [],
        };
        peopleById.set(id, person);
      }
      const designationId = String(row.designationId ?? "");
      person.designations.push({
        designationId,
        name: nameByDesignation.get(designationId) || designationId,
      });
    }

    const holderCounts = new Map<string, number>();
    for (const row of grants) {
      const key = String(row.designationId ?? "");
      holderCounts.set(key, (holderCounts.get(key) ?? 0) + 1);
    }

    return ok({
      designations: catalogue.map((entry) => ({
        ...entry,
        holderCount: holderCounts.get(String(entry.$id ?? "")) ?? 0,
      })),
      departments: departmentsRes.documents,
      people: [...peopleById.values()].sort((a, b) => a.name.localeCompare(b.name)),
      accountNames,
    });
  } catch (error) {
    console.error("Designations read-model error:", error);
    return fail("INTERNAL", "Unable to load designations", 500);
  }
}
