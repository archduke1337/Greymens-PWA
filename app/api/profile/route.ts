import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { MEMBER_FILE_PERMISSIONS, PUBLIC_FILE_PERMISSIONS } from "@/lib/storage";
import { validateProfilePatch } from "@/lib/profile-fields";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const RESTRICTED = new Set(["banned", "suspended", "deactivated"]);

const PROFILE_IMAGE_BUCKET_ID = "profile-pictures";
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// Field validation is shared with the administrator console; see
// lib/profile-fields.ts. Keeping one copy means the stricter member-facing
// rules cannot silently diverge from the console's.

// The stored avatar is a file view URL, so the replaced file id has to be read
// back out of it to clean up orphaned uploads.
function extractFileIdFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const match = url.match(/\/storage\/buckets\/[^/]+\/files\/([^/?#]+)\//);
  return match ? match[1] : null;
}

async function getOwnProfile(userId: string) {
  const { databases } = createAdminClient();
  const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
    Query.equal("userId", [userId]),
    Query.limit(1),
  ]);
  return response.documents[0] || null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createAdminClient();
    const userId = authenticated.user.$id;
    const [profile, userDepartments, userDesignations, memberships, tickets] = await Promise.all([
      getOwnProfile(userId),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
        Query.equal("userId", [userId]),
        Query.equal("isActive", [true]),
        Query.limit(100),
      ]),
      databases.listDocuments(DATABASE_ID, COLLECTIONS.USER_DESIGNATIONS, [
        Query.equal("userId", [userId]),
        Query.equal("isActive", [true]),
        Query.limit(100),
      ]),
      databases
        .listDocuments(DATABASE_ID, COLLECTIONS.MEMBERSHIPS, [Query.equal("userId", [userId]), Query.limit(1)])
        .catch(() => ({ documents: [] })),
      databases
        .listDocuments(DATABASE_ID, COLLECTIONS.TICKETS, [
          Query.equal("userId", [userId]),
          Query.orderDesc("$createdAt"),
          Query.limit(100),
        ])
        .catch(() => ({ documents: [] })),
    ]);

    const departmentIds = userDepartments.documents
      .map((item) => (item as Record<string, unknown>).departmentId)
      .filter((id): id is string => typeof id === "string");
    const designationIds = userDesignations.documents
      .map((item) => (item as Record<string, unknown>).designationId)
      .filter((id): id is string => typeof id === "string");

    const [departments, designations] = await Promise.all([
      departmentIds.length
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [Query.equal("$id", departmentIds), Query.limit(100)])
        : Promise.resolve({ documents: [] }),
      designationIds.length
        ? databases.listDocuments(DATABASE_ID, COLLECTIONS.DESIGNATIONS, [Query.equal("$id", designationIds), Query.limit(100)])
        : Promise.resolve({ documents: [] }),
    ]);

    const departmentMap = new Map(departments.documents.map((item) => [item.$id, item]));
    const designationMap = new Map(designations.documents.map((item) => [item.$id, item]));
    const enrichedDepartments = userDepartments.documents.map((item) => ({
      ...item,
      departmentName: departmentMap.get(String((item as Record<string, unknown>).departmentId))?.name || "Unknown",
    }));
    const enrichedDesignations = userDesignations.documents.map((item) => {
      const designation = designationMap.get(String((item as Record<string, unknown>).designationId));
      return {
        ...item,
        designationName: designation?.name || "Unknown",
        designationLevel: designation?.level || 1,
        designationColor: designation?.badgeColor,
        designationIcon: designation?.badgeIcon,
      };
    });

    return ok({
      profile,
      membership: memberships.documents[0] || null,
      // Curated ticket subset (matches /api/events/register GET) — no
      // invalidatedReason/checkedInBy internals.
      tickets: (tickets as { documents: Array<Record<string, unknown>> }).documents.map((t) => ({
        $id: t.$id,
        eventId: t.eventId,
        ticketCode: t.ticketCode,
        status: t.status,
        issuedAt: t.issuedAt,
      })),
      departments: enrichedDepartments,
      designations: enrichedDesignations,
      membershipStatus: await getMembershipStatus(authenticated.user),
    });
  } catch (error) {
    console.error("Profile lookup error:", error);
    return fail("INTERNAL", "Unable to load profile", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  // Restricted accounts are read-only for profile writes/uploads.
  if (RESTRICTED.has(await getMembershipStatus(authenticated.user))) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_PROFILE_IMAGE_TYPES.has(file.type) || file.size > MAX_PROFILE_IMAGE_SIZE) {
      return fail("VALIDATION", "Invalid image. Use JPG, PNG, or WebP under 5MB.", 400);
    }

    const { storage, databases } = createAdminClient();
    const existing = await getOwnProfile(authenticated.user.$id);
    const previousFileId = extractFileIdFromUrl((existing as Record<string, unknown> | null)?.avatar);

    // Respect profile visibility: private/members_only avatars must not be world-readable.
    const visibility = String((existing as Record<string, unknown> | null)?.profileVisibility ?? "public");
    const perms = visibility === "public" ? PUBLIC_FILE_PERMISSIONS : MEMBER_FILE_PERMISSIONS;
    const uploaded = await storage.createFile(PROFILE_IMAGE_BUCKET_ID, ID.unique(), file, perms);
    const avatar = storage.getFileView(PROFILE_IMAGE_BUCKET_ID, uploaded.$id).toString();
    const profile = existing
      ? await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROFILES, existing.$id, { avatar })
      : await databases.createDocument(DATABASE_ID, COLLECTIONS.PROFILES, ID.unique(), {
        userId: authenticated.user.$id,
        avatar,
      });

    // Best-effort cleanup: a leftover file is harmless, a failed upload is not.
    if (previousFileId && previousFileId !== uploaded.$id) {
      await storage.deleteFile(PROFILE_IMAGE_BUCKET_ID, previousFileId).catch(() => undefined);
    }

    return ok({ profile, avatar }, 201);
  } catch (error) {
    console.error("Profile image upload error:", error);
    return fail("INTERNAL", "Unable to upload profile image", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  if (RESTRICTED.has(await getMembershipStatus(authenticated.user))) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return fail("VALIDATION", "Invalid request body", 400);
    }

    const validated = validateProfilePatch(body);
    if ("error" in validated) return fail("VALIDATION", validated.error, 400);
    if (Object.keys(validated.data).length === 0) {
      return fail("VALIDATION", "No profile fields supplied", 400);
    }

    const { databases } = createAdminClient();
    const existing = await getOwnProfile(authenticated.user.$id);
    const profile = existing
      ? await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROFILES, existing.$id, validated.data)
      : await databases.createDocument(DATABASE_ID, COLLECTIONS.PROFILES, ID.unique(), {
        userId: authenticated.user.$id,
        ...validated.data,
      });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "profile.update",
      entityType: "profile",
      entityId: profile.$id,
      details: { fields: Object.keys(validated.data) },
    });
    return ok({ profile });
  } catch (error) {
    console.error("Profile update error:", error);
    return fail("INTERNAL", "Unable to update profile", 500);
  }
}
