import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { getAccountNames } from "@/lib/server-users";
import {
  validateGovernanceRole,
  validateProfilePatch,
} from "@/lib/profile-fields";
import { ok, fail, ApiError } from "@/lib/api";
import { isRecord } from "@/lib/validation";
import { consumeRateLimit } from "@/lib/rate-limit";

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;
const MEMBERSHIP_STATUSES = new Set([
  "active",
  "inactive",
  "banned",
  "suspended",
  // "deactivated" is a real restriction state (RESTRICTED_STATUSES, dashboard
  // and filters model it) but was unsettable — every deactivation had to go
  // through "inactive", which grants nothing restriction-wise.
  "deactivated",
]);

function boundedInt(
  value: string | null,
  fallback: number,
  max: number,
): number {
  const parsed = Number.parseInt(value ?? "", 10);

  if (!Number.isFinite(parsed) || parsed < 0) return fallback;

  return Math.min(parsed, max);
}

/**
 * The administrator user list.
 *
 * Returns each profile already joined to its membership and to its department,
 * designation and power assignments, plus the reference catalogues the screen
 * needs to render names.
 *
 * The previous implementation performed this join in the browser: it fetched
 * every profile with the browser SDK and then issued four more queries per
 * profile (`getByUserId` x4). For a hundred accounts that is more than four
 * hundred round trips, all of them requiring the identity tables to be readable
 * by any signed-in user. It is now five queries, server-side, behind
 * `requireCapability`.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "users.view");

  if (!authenticated.user) return authenticated.response;

  try {
    const params = request.nextUrl.searchParams;
    const limit = boundedInt(params.get("limit"), DEFAULT_LIMIT, MAX_LIMIT);
    const offset = boundedInt(params.get("offset"), 0, 10_000);

    const { databases } = createServerDatabases();
    const [profiles, departments, designations, powers] = await Promise.all([
      databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
        Query.orderDesc("$createdAt"),
        Query.limit(limit),
        Query.offset(offset),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.orderAsc("displayOrder"),
        Query.limit(200),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [
        Query.orderAsc("level"),
        Query.limit(200),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.POWERS, [
        Query.orderAsc("category"),
        Query.limit(200),
      ]),
    ]);

    const userIds = profiles.documents
      .map((profile) => String(profile.userId ?? ""))
      .filter(Boolean);

    const empty = { documents: [] as Array<Record<string, unknown>> };
    const [memberships, userDepartments, userDesignations, userPowers] =
      userIds.length
        ? await Promise.all([
            databases.listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [
              Query.equal("userId", userIds),
              Query.limit(MAX_LIMIT),
            ]),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
              Query.equal("userId", userIds),
              Query.equal("isActive", [true]),
              Query.limit(MAX_LIMIT),
            ]),
            databases.listDocuments(
              DATABASE_ID,
              COLLECTIONS.USER_DESIGNATIONS,
              [
                Query.equal("userId", userIds),
                Query.equal("isActive", [true]),
                Query.limit(MAX_LIMIT),
              ],
            ),
            databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_POWERS, [
              Query.equal("userId", userIds),
              Query.equal("isActive", [true]),
              Query.limit(MAX_LIMIT),
            ]),
          ])
        : [empty, empty, empty, empty];

    const groupBy = (documents: Array<Record<string, unknown>>) => {
      const map = new Map<string, Array<Record<string, unknown>>>();

      for (const document of documents) {
        const key = String(document.userId ?? "");

        if (!key) continue;
        const bucket = map.get(key);

        if (bucket) bucket.push(document);
        else map.set(key, [document]);
      }

      return map;
    };

    const membershipByUser = new Map(
      memberships.documents.map((membership) => [
        String(membership.userId ?? ""),
        membership,
      ]),
    );
    const departmentsByUser = groupBy(
      userDepartments.documents as Array<Record<string, unknown>>,
    );
    const designationsByUser = groupBy(
      userDesignations.documents as Array<Record<string, unknown>>,
    );
    const powersByUser = groupBy(
      userPowers.documents as Array<Record<string, unknown>>,
    );

    const users = profiles.documents.map((profile) => {
      const userId = String(profile.userId ?? "");

      return {
        profile,
        membership: membershipByUser.get(userId) ?? null,
        departments: departmentsByUser.get(userId) ?? [],
        designations: designationsByUser.get(userId) ?? [],
        powers: powersByUser.get(userId) ?? [],
      };
    });

    // Names live on the auth record. Best-effort: a lookup failure must not
    // fail the whole user list.
    const accountNames = await getAccountNames(userIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok({
      users,
      departments: departments.documents,
      designations: designations.documents,
      powers: powers.documents,
      total: profiles.total,
      limit,
      offset,
      accountNames,
    });
  } catch (error) {
    console.error("Admin user list error:", error);

    return fail("INTERNAL", "Unable to load users", 500);
  }
}

async function findProfile(userId: string) {
  const { databases } = createServerDatabases();
  const response = await databases.listDocuments(
    DATABASE_ID,
    COLLECTIONS.PROFILES,
    [Query.equal("userId", [userId]), Query.limit(1)],
  );

  return { databases, profile: response.documents[0] ?? null };
}

/**
 * Administrative account actions.
 *
 * Every branch derives the actor from the verified session, applies one
 * validated change, and records what happened. The previous implementation did
 * this from the browser, where none of the writes could succeed — the tables
 * grant no client write permission — and where the audit entry was produced by
 * the client with a client-supplied `actorId`.
 */
export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "users.update");

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (!isRecord(body))
    return fail("VALIDATION", "Invalid request body", 400);

  const action = typeof body.action === "string" ? body.action : "";
  const userId = typeof body.userId === "string" ? body.userId.trim() : "";

  if (!userId)
    return fail("VALIDATION", "userId is required", 400);

  // Tier grants and bans are single-writer sensitive: throttle per actor.
  // Note on granularity: set_governance_role shares the users.update gate.
  // users.manage_roles exists in the vocabulary but no office or template
  // grants it, so splitting the gate today would only add confusion — only
  // "*" holders reach this switch at all.
  if (!consumeRateLimit(`admin-users:${authenticated.user.$id}`, 60, 10 * 60 * 1000).allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    switch (action) {
      case "update_profile": {
        if (!isRecord(body.fields)) {
          return fail("VALIDATION", "fields must be an object", 400);
        }
        // `unknownFields: "ignore"` because this screen round-trips a whole
        // profile document. Immutable keys are dropped, never written.
        const validated = validateProfilePatch(body.fields, {
          unknownFields: "ignore",
        });

        if ("error" in validated)
          return fail("VALIDATION", validated.error, 400);
        if (Object.keys(validated.data).length === 0) {
          return fail("VALIDATION", "No editable profile fields supplied", 400);
        }

        const { databases, profile } = await findProfile(userId);

        if (!profile)
          return fail("NOT_FOUND", "User profile not found", 404);
        const updated = await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.PROFILES,
          profile.$id,
          validated.data,
        );

        await recordAudit({
          request,
          actor: authenticated.user,
          action: "update_user_profile",
          entityType: "profile",
          entityId: profile.$id,
          details: {
            targetUserId: userId,
            fields: Object.keys(validated.data),
          },
        });

        return ok({ user: updated });
      }

      /**
       * Grant or revoke the `admin` / `dev` governance tier.
       *
       * This is the only application-level path to that tier, and it writes the
       * only table that can represent it. The previous implementation wrote
       * `profiles.status`, a column that no authorization path reads, so an
       * administrator could run this action, see it succeed, and change nothing.
       *
       * `role: null` (or an empty string) revokes. Self-revocation is refused
       * because regaining the tier requires either another administrator or the
       * bootstrap script, which needs project-level credentials.
       */
      case "set_governance_role": {
        const raw = body.role;
        const isRevoke = raw === undefined || raw === null || raw === "";
        const role = isRevoke ? null : validateGovernanceRole(raw);

        if (!isRevoke && !role) {
          return fail("VALIDATION", "role must be 'admin', 'dev', or null", 400);
        }
        if (userId === authenticated.user.$id && role === null) {
          return fail("CONFLICT", "You cannot revoke your own governance role", 409);
        }

        const { databases } = createServerDatabases();
        const now = new Date().toISOString();

        if (role) {
          const data = {
            userId,
            role,
            grantedBy: authenticated.user.$id,
            grantedAt: now,
            reason: "Assigned from the admin console",
            isActive: true,
          };

          try {
            // The row id is the user id, so an account holds exactly one role
            // row. Appwrite resolves the tier with `limit(1)` and no ordering,
            // so allowing several active rows would make the resolved tier
            // whichever row happened to come back first.
            await databases.createDocument(
              DATABASE_ID,
              COLLECTIONS.USER_ROLES,
              userId,
              data,
              [],
            );
          } catch (error) {
            if ((error as { code?: number }).code !== 409) throw error;
            await databases.updateDocument(
              DATABASE_ID,
              COLLECTIONS.USER_ROLES,
              userId,
              data,
            );
          }
        } else {
          try {
            await databases.updateDocument(
              DATABASE_ID,
              COLLECTIONS.USER_ROLES,
              userId,
              { isActive: false, grantedAt: now },
            );
          } catch (error) {
            // 404 means the account never held the tier, which is the state the
            // caller asked for.
            if ((error as { code?: number }).code !== 404) throw error;
          }
        }

        await recordAudit({
          request,
          actor: authenticated.user,
          action: role ? "grant_governance_role" : "revoke_governance_role",
          entityType: "user_roles",
          entityId: userId,
          details: { targetUserId: userId, role },
        });

        return ok({ userId, role });
      }

      case "set_membership_status": {
        const status = typeof body.status === "string" ? body.status : "";

        if (!MEMBERSHIP_STATUSES.has(status)) {
          return fail("VALIDATION", "Invalid membership status", 400);
        }

        const { databases } = createServerDatabases();
        const memberships = await databases.listDocuments(
          DATABASE_ID,
          COLLECTIONS.MEMBERSHIPS,
          [Query.equal("userId", [userId]), Query.limit(1)],
        );
        const membership = memberships.documents[0];

        if (!membership) {
          return fail("NOT_FOUND", "This account has no membership record", 404);
        }
        const updated = await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.MEMBERSHIPS,
          membership.$id,
          { status },
        );

        await recordAudit({
          request,
          actor: authenticated.user,
          action: "set_membership_status",
          entityType: "membership",
          entityId: membership.$id,
          details: { targetUserId: userId, status },
        });

        return ok({ membership: updated });
      }

      default:
        return fail("VALIDATION", "Unsupported action", 400);
    }
  } catch (error) {
    console.error("Admin user action error:", error);

    return fail("INTERNAL", "Unable to apply the change", 500);
  }
}
