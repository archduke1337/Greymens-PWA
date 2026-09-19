import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, isConflict } from "@/lib/api";
import { logError } from "@/lib/logger";

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalExpiry(value: unknown): string | null | false {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string") return false;
  const date = new Date(value);

  return Number.isNaN(date.getTime()) || date.getTime() <= Date.now()
    ? false
    : date.toISOString();
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
    const { databases } = createServerDatabases();
    const [powers, grants, departments] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.POWERS, [
        Query.orderAsc("category"),
        Query.limit(200),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
        Query.equal("isActive", [true]),
        Query.limit(500),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.equal("isActive", [true]),
        Query.orderAsc("displayOrder"),
        Query.limit(100),
      ]),
    ]);

    return ok({
      powers: powers.documents,
      grants: grants.documents,
      departments: departments.documents,
    });
  } catch (error) {
    logError("Admin power list error:", error);

    return fail("INTERNAL", "Unable to load powers", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");

  if (!authenticated.user) return authenticated.response;
  if (
    !consumeRateLimit(
      `powers-mutate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const action = text(body.action, 20);
    const userId = text(body.userId, 36);
    const powerId = text(body.powerId, 100);

    if (!userId || !powerId || !["grant", "revoke"].includes(action)) {
      return fail(
        "VALIDATION",
        "userId, powerId, and a grant/revoke action are required",
        400,
      );
    }

    const { databases } = createServerDatabases();
    const power = await databases
      .getDocument(DATABASE_ID, COLLECTIONS.POWERS, powerId)
      .catch(() => null);

    if (!power) return fail("NOT_FOUND", "Power does not exist", 404);

    if (action === "revoke") {
      // Revoke by both id and name: legacy grants may store powerName while
      // permission engine resolves either. Revoking only by id leaves privilege effective.
      // Limit matches the catalogue cap: a truncated scan would leave live
      // privilege behind while reporting success.
      const grants = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.USER_POWERS,
        [
          Query.equal("userId", [userId]),
          Query.equal("isActive", [true]),
          Query.limit(500),
        ],
      );
      const matching = grants.documents.filter((g) => {
        const pid = String((g as Record<string, unknown>).powerId ?? "");

        return pid === powerId || pid === String(power.name ?? "");
      });

      await Promise.all(
        matching.map((grant) =>
          databases.updateDocument(
            DATABASE_ID,
            COLLECTIONS.USER_POWERS,
            grant.$id,
            { isActive: false },
          ),
        ),
      );
      await recordAudit({
        request,
        actor: authenticated.user,
        action: "power.revoke",
        entityType: "user_power",
        entityId: userId,
        details: {
          userId,
          powerId,
          powerName: power.name,
          revoked: matching.length,
        },
      });

      return ok({ revoked: matching.length });
    }

    const expiresAt = optionalExpiry(body.expiresAt);

    if (expiresAt === false)
      return fail(
        "VALIDATION",
        "expiresAt must be a future ISO date or empty",
        400,
      );
    const departmentId = text(body.departmentId, 36);
    // Dedupe: stacking duplicate active rows creates audit noise and revoke ambiguity.
    const existing = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_POWERS,
      [
        Query.equal("userId", [userId]),
        Query.equal("isActive", [true]),
        Query.limit(500),
      ],
    );
    const already = existing.documents.find((g) => {
      const pid = String((g as Record<string, unknown>).powerId ?? "");
      const dept = String((g as Record<string, unknown>).departmentId ?? "");

      return (
        (pid === powerId || pid === String(power.name ?? "")) &&
        dept === (departmentId || "")
      );
    });

    if (already) {
      return ok({ grant: already, alreadyGranted: true });
    }
    const grant = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.USER_POWERS,
      ID.unique(),
      {
        userId,
        powerId,
        grantedBy: authenticated.user.$id,
        grantedAt: new Date().toISOString(),
        departmentId: departmentId || undefined,
        expiresAt: expiresAt || undefined,
        isActive: true,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "power.grant",
      entityType: "user_power",
      entityId: grant.$id,
      details: {
        userId,
        powerId,
        powerName: power.name,
        departmentId: departmentId || null,
        expiresAt,
      },
    });

    return ok({ grant }, 201);
  } catch (error) {
    logError("Admin power mutation error:", error);

    return fail("INTERNAL", "Unable to update power assignment", 500);
  }
}

const POWER_CATEGORIES = new Set([
  "membership",
  "events",
  "tickets",
  "content",
  "resources",
  "admin",
  "gallery",
  "social",
]);
const POWER_SCOPES = new Set(["global", "department", "own"]);

function validatePowerFields(
  body: Record<string, unknown>,
  forCreate: boolean,
): string | null {
  if (forCreate) {
    const name = text(body.name, 100);

    if (!/^[a-z0-9]+(?:_[a-z0-9]+)*$/.test(name))
      return "Power name must be snake_case (e.g. event_manager)";
  }
  if (body.displayName !== undefined || forCreate) {
    const displayName = text(body.displayName, 100);

    if (!displayName) return "Display name is required";
  }
  if (
    body.description !== undefined &&
    body.description !== null &&
    (typeof body.description !== "string" || body.description.length > 65535)
  ) {
    return "Invalid power description";
  }
  if (
    body.category !== undefined &&
    (typeof body.category !== "string" || !POWER_CATEGORIES.has(body.category))
  ) {
    return "Invalid power category";
  }
  if (forCreate && body.category === undefined) {
    return "Power category is required";
  }
  if (
    body.scope !== undefined &&
    (typeof body.scope !== "string" || !POWER_SCOPES.has(body.scope))
  ) {
    return "Invalid power scope";
  }
  if (forCreate && body.scope === undefined) {
    return "Power scope is required";
  }

  return null;
}

/**
 * Catalogue administration: create and edit power definitions.
 *
 * The `name` is the grant vocabulary key — grants reference it — so it is
 * set once at create and never renamed. Everything else (display name,
 * description, category, scope) is editable. A new name confers no
 * capabilities until it is mapped in POWER_CAPABILITIES (code), which the
 * console states on unmapped rows instead of pretending otherwise.
 */
export async function PUT(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const record = body as Record<string, unknown>;
  const validationError = validatePowerFields(record, true);

  if (validationError) return fail("VALIDATION", validationError, 400);

  try {
    const { databases } = createServerDatabases();
    const power = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.POWERS,
      text(record.powerId, 100) || ID.unique(),
      {
        name: text(record.name, 100),
        displayName: text(record.displayName, 100),
        description:
          typeof record.description === "string" && record.description
            ? record.description.slice(0, 65535)
            : null,
        category: text(record.category, 50),
        scope: text(record.scope, 50),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "power.create",
      entityType: "power",
      entityId: power.$id,
      details: { name: power.name },
    });

    return ok({ power }, 201);
  } catch (error) {
    if (isConflict(error)) {
      return fail("CONFLICT", "A power with that name already exists", 409);
    }
    logError("Admin power create error:", error);

    return fail("INTERNAL", "Unable to create power", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const record = body as Record<string, unknown>;
  const powerId = text(record.powerId, 100);

  if (!powerId) return fail("VALIDATION", "powerId is required", 400);
  const validationError = validatePowerFields(record, false);

  if (validationError) return fail("VALIDATION", validationError, 400);

  try {
    const { databases } = createServerDatabases();
    const updates: Record<string, unknown> = {};

    for (const key of [
      "displayName",
      "description",
      "category",
      "scope",
    ] as const) {
      if (record[key] === undefined) continue;
      updates[key] =
        key === "description"
          ? typeof record[key] === "string" && record[key]
            ? (record[key] as string).slice(0, 65535)
            : null
          : text(record[key], key === "displayName" ? 100 : 50);
    }
    if (Object.keys(updates).length === 0) {
      return fail("VALIDATION", "Nothing to update", 400);
    }
    const power = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.POWERS,
      powerId,
      updates,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "power.update",
      entityType: "power",
      entityId: powerId,
      details: { fields: Object.keys(updates) },
    });

    return ok({ power });
  } catch (error) {
    logError("Admin power update error:", error);

    return fail("INTERNAL", "Unable to update power", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "powers.manage");

  if (!authenticated.user) return authenticated.response;
  const powerId =
    new URL(request.url).searchParams.get("powerId")?.trim() ?? "";

  if (!powerId) return fail("VALIDATION", "powerId is required", 400);

  try {
    const { databases } = createServerDatabases();
    const power = await databases
      .getDocument(DATABASE_ID, COLLECTIONS.POWERS, powerId)
      .catch(() => null);

    if (!power) return fail("NOT_FOUND", "Power does not exist", 404);
    // Grants reference the id or the name — deleting under live grants would
    // strand them. Revoke first; the refuse message says so.
    const grants = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.USER_POWERS,
      [Query.limit(500)],
    );
    const live = grants.documents.filter((grant) => {
      const row = grant as Record<string, unknown>;

      if (row.isActive === false) return false;
      const pid = String(row.powerId ?? "");

      return pid === powerId || pid === String(power.name ?? "");
    });

    if (live.length > 0) {
      return fail(
        "CONFLICT",
        `Power still has ${live.length} active grant(s) — revoke them first`,
        409,
      );
    }
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.POWERS, powerId);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "power.delete",
      entityType: "power",
      entityId: powerId,
      details: { name: power.name },
    });

    return ok({ success: true });
  } catch (error) {
    logError("Admin power delete error:", error);

    return fail("INTERNAL", "Unable to delete power", 500);
  }
}
