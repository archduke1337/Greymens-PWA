import { NextRequest } from "next/server";
import { createServerTablesClient, Query } from "@/lib/appwrite-server";
import { COLLECTIONS } from "@/lib/database";
import { ok, fail } from "@/lib/api";

/**
 * Public department catalogue.
 *
 * Departments are reference data used by public pages and onboarding. The
 * browser used to read this table directly through the Appwrite SDK, which
 * coupled a client form to database permissions and made it easy for future
 * callers to copy the same pattern for protected data. The catalogue is now
 * read through one bounded server response instead.
 *
 * This endpoint intentionally returns only display fields. Assignment rows,
 * member counts, governance metadata, and other identity data never belong in a
 * public catalogue response.
 */
export async function GET(_request: NextRequest) {
  try {
    const { tables, databaseId } = createServerTablesClient();
    const response = await tables.listRows({
      databaseId,
      tableId: COLLECTIONS.DEPARTMENTS,
      queries: [
        Query.equal("isActive", true),
        Query.orderAsc("displayOrder"),
        Query.limit(100),
      ],
    });

    const departments = response.rows.map((department) => ({
      $id: department.$id,
      name: department.name,
      slug: department.slug,
      description: department.description,
      icon: department.icon,
      color: department.color,
      category: department.category,
      displayOrder: department.displayOrder,
    }));

    return ok({ departments });
  } catch (error) {
    console.error("Department catalogue error:", error);
    return fail("INTERNAL", "Unable to load departments", 500);
  }
}
