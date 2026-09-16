import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalExpiry(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now() ? false : date.toISOString();
}

/**
 * Legacy operational powers remain part of authorization until all workflows
 * use role templates. They are therefore never writable from the browser SDK.
 * `powerId` accepts only an existing power document id; the permission engine
 * resolves either id or name, but accepting arbitrary strings here would create
 * grants that look successful while resolving to no capabilities.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createAdminClient();
    const [powers, grants, departments] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.POWERS, [Query.orderAsc("category"), Query.limit(200)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [Query.equal("isActive", [true]), Query.limit(500)]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [Query.equal("isActive", [true]), Query.orderAsc("displayOrder"), Query.limit(100)]),
    ]);
    return ok({ powers: powers.documents, grants: grants.documents, departments: departments.documents });
  } catch (error) {
    console.error("Admin power list error:", error);
    return fail("INTERNAL", "Unable to load powers", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const action = text(body.action, 20);
    const userId = text(body.userId, 36);
    const powerId = text(body.powerId, 100);
    if (!userId || !powerId || !["grant", "revoke"].includes(action)) {
      return fail("VALIDATION", "userId, powerId, and a grant/revoke action are required", 400);
    }

    const { databases } = createAdminClient();
    const power = await databases.getDocument(DATABASE_ID, COLLECTIONS.POWERS, powerId).catch(() => null);
    if (!power) return fail("NOT_FOUND", "Power does not exist", 404);

    if (action === "revoke") {
      // Revoke by both id and name: legacy grants may store powerName while
      // permission engine resolves either. Revoking only by id leaves privilege effective.
      const grants = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
        Query.equal("userId", [userId]),
        Query.equal("isActive", [true]),
        Query.limit(100),
      ]);
      const matching = grants.documents.filter((g) => {
        const pid = String((g as Record<string, unknown>).powerId ?? "");
        return pid === powerId || pid === String(power.name ?? "");
      });
      await Promise.all(matching.map((grant) =>
        databases.updateDocument(DATABASE_ID, COLLECTIONS.USER_POWERS, grant.$id, { isActive: false }),
      ));
      await recordAudit({ request, actor: authenticated.user, action: "power.revoke", entityType: "user_power", entityId: userId, details: { userId, powerId, powerName: power.name, revoked: matching.length } });
      return ok({ revoked: matching.length });
    }

    const expiresAt = optionalExpiry(body.expiresAt);
    if (expiresAt === false) return fail("VALIDATION", "expiresAt must be a future ISO date or empty", 400);
    const departmentId = text(body.departmentId, 36);
    // Dedupe: stacking duplicate active rows creates audit noise and revoke ambiguity.
    const existing = await databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
      Query.equal("userId", [userId]),
      Query.equal("isActive", [true]),
      Query.limit(100),
    ]);
    const already = existing.documents.find((g) => {
      const pid = String((g as Record<string, unknown>).powerId ?? "");
      const dept = String((g as Record<string, unknown>).departmentId ?? "");
      return (pid === powerId || pid === String(power.name ?? "")) && dept === (departmentId || "");
    });
    if (already) {
      return ok({ grant: already, alreadyGranted: true });
    }
    const grant = await databases.createDocument(DATABASE_ID, COLLECTIONS.USER_POWERS, ID.unique(), {
      userId,
      powerId,
      grantedBy: authenticated.user.$id,
      grantedAt: new Date().toISOString(),
      departmentId: departmentId || null,
      expiresAt,
      isActive: true,
    });
    await recordAudit({ request, actor: authenticated.user, action: "power.grant", entityType: "user_power", entityId: grant.$id, details: { userId, powerId, powerName: power.name, departmentId: departmentId || null, expiresAt } });
    return ok({ grant }, 201);
  } catch (error) {
    console.error("Admin power mutation error:", error);
    return fail("INTERNAL", "Unable to update power assignment", 500);
  }
}
