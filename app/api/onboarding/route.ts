import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/appwrite";
import { DATABASE_ID, COLLECTIONS } from "@/lib/database";
import { ID, Query } from "appwrite";
import { RESTRICTED_STATUSES, getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, ApiError } from "@/lib/api";

const PROFILE_FIELDS = [
  "phone",
  "urn",
  "dateOfBirth",
  "gender",
  "address",
  "pronouns",
  "program",
  "branch",
  "year",
  "semester",
  "githubUrl",
  "linkedinUrl",
  "portfolioUrl",
  "bio",
  "whyJoin",
  "experience",
  "availability",
  "profileVisibility",
] as const;

const PROFILE_ARRAY_FIELDS = ["skills", "interests"] as const;

const LONG_TEXT_PROFILE_FIELDS = new Set([
  "address",
  "bio",
  "whyJoin",
  "experience",
]);

const PROFILE_ENUM_FIELDS: Record<string, readonly string[]> = {
  gender: ["male", "female", "other", "prefer_not_to_say"],
  availability: ["full", "partial", "event_only"],
  profileVisibility: ["public", "members_only", "private"],
};

const APPLICATION_FIELDS = [
  "oathAccepted",
  "termsAccepted",
  "constitutionAccepted",
  "preferredDepartments",
  "submittedAt",
] as const;

function isString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.length <= maxLength;
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === "boolean";
}

function isStringArray(value: unknown, maxItems: number, maxItemLength: number): value is string[] {
  return Array.isArray(value)
    && value.length <= maxItems
    && value.every((item) => typeof item === "string" && item.length <= maxItemLength);
}

function pickFields(source: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.filter((field) => source[field] !== undefined).map((field) => [field, source[field]]));
}

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createAdminClient();
    const applications = await databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    return ok({ exists: applications.documents.length > 0 });
  } catch (error) {
    console.error("Onboarding status error:", error);
    return fail("INTERNAL", "Unable to check application status", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  // Restricted accounts cannot (re)apply while banned, suspended, or
  // deactivated — otherwise a ban would be sidestepped with a fresh row.
  const callerStatus = await getMembershipStatus(authenticated.user);
  if (RESTRICTED_STATUSES.has(callerStatus)) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  const limited = consumeRateLimit(`onboarding:${authenticated.user.$id}`, 5, 60 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = await request.json() as {
      profile?: Record<string, unknown>;
      application?: Record<string, unknown>;
    };
    const profileInput = body.profile;
    const applicationInput = body.application;

    if (!profileInput || !applicationInput) {
      return fail("VALIDATION", "Profile and application are required", 400);
    }

    const requiredProfileFields = ["phone", "urn", "dateOfBirth", "gender", "program", "branch", "year", "semester", "whyJoin", "availability"];
    if (!requiredProfileFields.every((field) => isString(profileInput[field], 65535) && String(profileInput[field]).trim())) {
      return fail("VALIDATION", "Please complete all required profile fields", 400);
    }

    for (const field of PROFILE_FIELDS) {
      const value = profileInput[field];
      if (value === undefined) continue;
      if (!isString(value, LONG_TEXT_PROFILE_FIELDS.has(field) ? 4000 : 500)) {
        return fail("VALIDATION", `Invalid profile field: ${field}`, 400);
      }
      const allowed = PROFILE_ENUM_FIELDS[field];
      if (allowed && value && !allowed.includes(value)) {
        return fail("VALIDATION", `Invalid value for ${field}`, 400);
      }
    }

    for (const field of PROFILE_ARRAY_FIELDS) {
      const value = profileInput[field];
      if (value !== undefined && !isStringArray(value, 50, 100)) {
        return fail("VALIDATION", `Invalid profile field: ${field}`, 400);
      }
    }

    for (const field of ["oathAccepted", "termsAccepted", "constitutionAccepted"]) {
      if (!isBoolean(applicationInput[field]) || applicationInput[field] !== true) {
        return fail("VALIDATION", "All acknowledgements are required", 400);
      }
    }

    if (!isStringArray(applicationInput.preferredDepartments, 10, 100) || applicationInput.preferredDepartments.length === 0) {
      return fail("VALIDATION", "Select at least one department", 400);
    }

    const { databases } = createAdminClient();
    const existingApplications = await databases.listDocuments(DATABASE_ID, COLLECTIONS.APPLICATIONS, [
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);

    // Reapply path: rejected applicants may resubmit (pending/reapplied flow).
    // Only block when an active pending/reapplied/approved application exists.
    const existing = existingApplications.documents[0] as Record<string, unknown> | undefined;
    const existingStatus = existing ? String(existing.status ?? "") : "";
    if (existing && ["pending", "reapplied", "approved"].includes(existingStatus)) {
      return fail("CONFLICT", "An application already exists for this account", 409);
    }

    // Validate department IDs to avoid storing orphan references.
    const requestedDepts = Array.isArray(applicationInput.preferredDepartments)
      ? (applicationInput.preferredDepartments as unknown[]).filter((v): v is string => typeof v === "string")
      : [];
    if (requestedDepts.length > 0) {
      const deptCheck = await databases.listDocuments(DATABASE_ID, COLLECTIONS.DEPARTMENTS, [
        Query.equal("$id", requestedDepts),
        Query.limit(50),
      ]).catch(() => ({ documents: [] as unknown[] }));
      const found = new Set((deptCheck as { documents: Array<{ $id: string }> }).documents.map((d) => d.$id));
      const invalid = requestedDepts.filter((id) => !found.has(id));
      if (invalid.length > 0) {
        return fail("VALIDATION", `Unknown departments: ${invalid.slice(0, 3).join(", ")}`, 400);
      }
    }

    const existingProfiles = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROFILES, [
      Query.equal("userId", [authenticated.user.$id]),
      Query.limit(1),
    ]);
    const profileData = {
      ...pickFields(profileInput, PROFILE_FIELDS),
      ...pickFields(profileInput, PROFILE_ARRAY_FIELDS),
      userId: authenticated.user.$id,
    };

    const profile = existingProfiles.documents[0]
      ? await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROFILES, existingProfiles.documents[0].$id, profileData)
      : await databases.createDocument(DATABASE_ID, COLLECTIONS.PROFILES, ID.unique(), profileData);

    const application = existing && existingStatus === "rejected"
      ? await databases.updateDocument(DATABASE_ID, COLLECTIONS.APPLICATIONS, String(existing.$id ?? ""), {
        ...pickFields(applicationInput, APPLICATION_FIELDS),
        profileId: profile.$id,
        status: "pending",
        submittedAt: new Date().toISOString(),
      })
      : await databases.createDocument(DATABASE_ID, COLLECTIONS.APPLICATIONS, ID.unique(), {
      ...pickFields(applicationInput, APPLICATION_FIELDS),
      userId: authenticated.user.$id,
      profileId: profile.$id,
      status: "pending",
      submittedAt: new Date().toISOString(),
    });

    await recordAudit({
      request,
      actor: authenticated.user,
      action: existing && existingStatus === "rejected" ? "application.reapply" : "application.submit",
      entityType: "application",
      entityId: application.$id,
      details: {},
    });

    return ok({ success: true, profile, application }, 201);
  } catch (error) {
    // Submit race: two concurrent taps can both pass the pre-check, and the
    // loser hits the unique applications(userId) index. The caller HAS an
    // application — return it instead of a 500 that reads as failure.
    if (
      typeof error === "object" &&
      error !== null &&
      (error as { code?: unknown }).code === 409
    ) {
      try {
        const { databases: retryDb } = createAdminClient();
        const existing = await retryDb.listDocuments(
          DATABASE_ID,
          COLLECTIONS.APPLICATIONS,
          [
            Query.equal("userId", [authenticated.user.$id]),
            Query.limit(1),
          ],
        );
        const row = existing.documents[0];
        if (row) return ok({ success: true, application: row }, 200);
      } catch {
        // Fall through to the generic failure below.
      }
    }
    console.error("Onboarding submission error:", error);
    return fail("INTERNAL", "Failed to submit application", 500);
  }
}
