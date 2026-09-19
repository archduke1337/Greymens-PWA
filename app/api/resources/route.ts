import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import {
  createServerDatabases,
  createServerStorage,
  type ServerDatabases,
  type ServerRow,
} from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  getAuthenticatedUser,
  getMembershipStatus,
  isMemberStatus,
  requireMember,
} from "@/lib/server-auth";
import { hasServerCapability, requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { MEMBER_FILE_PERMISSIONS, getStorageFileViewUrl } from "@/lib/storage";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "resources";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
]);
const ALLOWED_CATEGORIES = new Set(["common", "department", "role"]);
// Announcement is legacy — new uploads are document/link/video/file/
// newsletter, but stored announcement rows render publicly and must stay
// editable, so the allowlist keeps accepting them.
const ALLOWED_RESOURCE_TYPES = new Set([
  "document",
  "link",
  "video",
  "file",
  "newsletter",
  "announcement",
]);
// Membership statuses a role-gated resource may require (compared against the
// viewer's resolved status in GET).
const MEMBER_STATUSES = new Set([
  "member",
  "core_member",
  "lead",
  "head",
  "admin",
  "dev",
]);

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

/**
 * Active-resource read with a degraded fallback.
 *
 * The primary query predicates on `isActive`. If that column is missing or
 * renamed on a given installation the predicate throws — and without a
 * fallback the entire library 500s, which the client renders as its
 * full-page "could not be loaded" error. The retry drops the predicate and
 * filters in code instead, so schema drift degrades to (at worst) showing a
 * soft-deleted row rather than hiding the whole library. Scope filtering
 * below still applies either way: availability degrades open, access stays
 * fail-closed.
 */
async function listActiveResources(databases: ServerDatabases) {
  try {
    return await databases.listDocuments(DATABASE_ID, COLLECTIONS.RESOURCES, [
      Query.equal("isActive", [true]),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
  } catch {
    const fallback = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );

    return {
      ...fallback,
      documents: fallback.documents.filter(
        (resource) => resource.isActive !== false,
      ),
    };
  }
}

/**
 * Locked placeholder for a resource the caller may know exists but must not
 * open. Carries the title and the scope it is restricted to — enough to
 * render a "locked for X department" card — and strips everything that opens
 * or describes the content (url, file, description, tags, uploader, review
 * fields).
 */
function lockStub(resource: ServerRow): ServerRow {
  return {
    $id: resource.$id,
    title: String(resource.title ?? "Untitled resource"),
    type: typeof resource.type === "string" ? resource.type : "document",
    layer: resource.layer ?? resource.category ?? "common",
    category: resource.category ?? resource.layer ?? "common",
    departmentId:
      typeof resource.departmentId === "string" ? resource.departmentId : null,
    requiredRole:
      typeof resource.requiredRole === "string" ? resource.requiredRole : null,
    locked: true,
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { databases } = createServerDatabases();

    // Review queue: managers see every status; everyone else only sees
    // approved records. The capability check runs before any query so a
    // denied caller costs no read.
    if (request.nextUrl.searchParams.get("all") === "true") {
      const admin = await requireCapability(request, "resources.manage");

      if (!admin.user) return admin.response;
      const response = await listActiveResources(databases);

      return ok({ resources: response.documents });
    }

    // Rows written before the moderation columns existed carry no status —
    // treat a missing status as approved so legacy content stays visible
    // instead of vanishing from the library after the upgrade.
    const response = await listActiveResources(databases);
    const approved = response.documents.filter(
      (resource) => resource.status === "approved" || !resource.status,
    );

    if (!user) {
      return ok({
        resources: approved.filter(
          (resource) => resource.category === "common",
        ),
      });
    }

    const membershipStatus = await getMembershipStatus(user);
    // Department-scoped resources require actual department membership — any
    // member must not read every department's files. The assignment lookup is
    // bounded and fails closed (no rows on error).
    let memberDepartmentIds = new Set<string>();

    if (isMemberStatus(membershipStatus)) {
      const assignments = await databases
        .listDocuments(DATABASE_ID, COLLECTIONS.USER_DEPARTMENTS, [
          Query.equal("userId", [user.$id]),
          Query.equal("isActive", [true]),
          Query.limit(100),
        ])
        .catch(() => ({ documents: [] as Array<{ departmentId?: unknown }> }));

      memberDepartmentIds = new Set(
        assignments.documents.map((row) => String(row.departmentId ?? "")),
      );
    }
    // Department/role material the caller may not open is returned as a
    // locked stub (title + scope, no content) instead of being silently
    // dropped — a non-cybersec member sees the cybersec file as "locked for
    // that department" rather than wondering where it went. Pending/rejected
    // items never appear here in any form; they live only in the review queue.
    const resources = approved.flatMap((resource) => {
      if (resource.category === "common") return [resource];
      if (!isMemberStatus(membershipStatus)) return [];
      if (resource.category === "role") {
        if (
          !resource.requiredRole ||
          resource.requiredRole === membershipStatus
        )
          return [resource];

        return [lockStub(resource)];
      }
      if (resource.category === "department") {
        const departmentId =
          typeof resource.departmentId === "string"
            ? resource.departmentId
            : "";

        if (departmentId && memberDepartmentIds.has(departmentId))
          return [resource];

        return [lockStub(resource)];
      }

      return [];
    });

    return ok({ resources });
  } catch (error) {
    logError("Resource list error:", error);

    return fail("INTERNAL", "Unable to load resources", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "resources.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const resourceId =
      typeof body.resourceId === "string" ? body.resourceId.trim() : "";

    if (!resourceId) return fail("VALIDATION", "resourceId is required", 400);

    const updates: Record<string, unknown> = {};

    for (const field of [
      "title",
      "description",
      "type",
      "url",
      "layer",
      "departmentId",
      "tags",
      "isActive",
      "requiredRole",
    ]) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (
      typeof updates.title !== "string" ||
      !updates.title.trim() ||
      updates.title.length > 255
    ) {
      return fail("VALIDATION", "A valid title is required", 400);
    }
    if (
      updates.description !== undefined &&
      (typeof updates.description !== "string" ||
        updates.description.length > 65535)
    ) {
      return fail("VALIDATION", "Invalid description", 400);
    }
    if (
      updates.departmentId !== undefined &&
      updates.departmentId !== null &&
      updates.departmentId !== ""
    ) {
      if (
        typeof updates.departmentId !== "string" ||
        updates.departmentId.length > 36
      ) {
        return fail("VALIDATION", "Invalid department", 400);
      }
    }
    if (
      updates.isActive !== undefined &&
      typeof updates.isActive !== "boolean"
    ) {
      return fail("VALIDATION", "Invalid active flag", 400);
    }
    // Role-gated visibility compares against membership status vocabulary.
    if (
      updates.requiredRole !== undefined &&
      updates.requiredRole !== null &&
      updates.requiredRole !== ""
    ) {
      if (
        typeof updates.requiredRole !== "string" ||
        !MEMBER_STATUSES.has(updates.requiredRole)
      ) {
        return fail("VALIDATION", "Invalid required role", 400);
      }
    }
    if (
      updates.url !== undefined &&
      updates.url !== null &&
      updates.url !== ""
    ) {
      if (typeof updates.url !== "string")
        return fail("VALIDATION", "Invalid resource URL", 400);
      try {
        const parsed = new URL(updates.url);

        if (!["http:", "https:"].includes(parsed.protocol))
          return fail("VALIDATION", "Invalid resource URL", 400);
      } catch {
        return fail("VALIDATION", "Invalid resource URL", 400);
      }
    }
    if (
      updates.type !== undefined &&
      (typeof updates.type !== "string" ||
        !ALLOWED_RESOURCE_TYPES.has(updates.type))
    ) {
      return fail("VALIDATION", "Invalid resource type", 400);
    }
    if (
      updates.layer !== undefined &&
      (typeof updates.layer !== "string" ||
        !ALLOWED_CATEGORIES.has(updates.layer))
    ) {
      return fail("VALIDATION", "Invalid resource category", 400);
    }
    // The legacy model contains both names for the same classification. Keep
    // them synchronized so public filtering (`category`) and admin display
    // (`layer`) cannot disagree after an edit — accepting `category` as an
    // alias keeps older clients editable instead of 400ing them.
    if (typeof updates.layer !== "string" && typeof body.category === "string")
      updates.layer = body.category;
    if (typeof updates.layer === "string") updates.category = updates.layer;
    if (
      updates.tags !== undefined &&
      (!Array.isArray(updates.tags) ||
        updates.tags.some((tag) => typeof tag !== "string" || tag.length > 100))
    ) {
      return fail("VALIDATION", "Invalid resource tags", 400);
    }
    if (Array.isArray(updates.tags) && updates.tags.length > 30) {
      updates.tags = updates.tags.slice(0, 30);
    }

    const { databases } = createServerDatabases();
    const resource = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      resourceId,
      updates,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "resource.update",
      entityType: "resource",
      entityId: resourceId,
      details: { fields: Object.keys(updates) },
    });

    return ok({ resource });
  } catch (error) {
    logError("Resource update error:", error);

    return fail("INTERNAL", "Unable to update resource", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "resources.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    // The id travels on the query string — some proxies and CDNs drop DELETE
    // bodies — with a JSON-body fallback for older clients.
    const queryResourceId = request.nextUrl.searchParams
      .get("resourceId")
      ?.trim();
    let bodyResourceId = "";

    if (!queryResourceId) {
      const body = (await request.json().catch(() => null)) as {
        resourceId?: unknown;
      } | null;

      bodyResourceId =
        typeof body?.resourceId === "string" ? body.resourceId.trim() : "";
    }
    const resourceId = queryResourceId || bodyResourceId;

    if (!resourceId) return fail("VALIDATION", "resourceId is required", 400);
    const { databases } = createServerDatabases();

    await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      resourceId,
      { isActive: false },
    );
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "resource.delete",
      entityType: "resource",
      entityId: resourceId,
      details: { softDeleted: true },
    });

    return ok({ success: true });
  } catch (error) {
    logError("Resource delete error:", error);

    return fail("INTERNAL", "Unable to delete resource", 500);
  }
}

export async function POST(request: NextRequest) {
  // Moderation (gallery/blogs model): any member may submit, which queues the
  // resource as `pending` — but a submission from a resources manager is the
  // moderator's own decision and publishes immediately. The client cannot ask
  // for a status; it is derived from verified authority, not the request body.
  const authenticated = await requireMember(request);

  if (!authenticated.user) return authenticated.response;
  // 50 MB uploads spend storage fast: throttle per uploader.
  const limited = consumeRateLimit(
    `resource-upload:${authenticated.user.$id}`,
    10,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const form = await request.formData();
    const title = text(form.get("title"), 255);
    const description = text(form.get("description"), 5000);
    const category =
      text(form.get("category") ?? form.get("layer"), 50) || "common";
    const type = text(form.get("type"), 50) || "document";
    const url = text(form.get("url"), 500);
    const tags = text(form.get("tags"), 1000)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);
    const departmentId = text(form.get("departmentId"), 36);
    const requiredRole = text(form.get("requiredRole"), 50);
    const file = form.get("file");

    if (!title) return fail("VALIDATION", "Title is required", 400);
    if (
      !ALLOWED_CATEGORIES.has(category) ||
      !ALLOWED_RESOURCE_TYPES.has(type)
    ) {
      return fail("VALIDATION", "Invalid resource category or type", 400);
    }
    // A department-layer resource without a department is visible nowhere it
    // should be and everywhere it shouldn't — require the scope at create.
    if (category === "department" && !departmentId) {
      return fail(
        "VALIDATION",
        "A department is required for department resources",
        400,
      );
    }
    // A role-layer resource without a status is visible to every member —
    // require the scope at create, mirroring the department rule above.
    if (category === "role" && !requiredRole) {
      return fail(
        "VALIDATION",
        "A member status is required for role resources",
        400,
      );
    }
    if (requiredRole && !MEMBER_STATUSES.has(requiredRole)) {
      return fail("VALIDATION", "Invalid required role", 400);
    }
    if (!url && !(file instanceof File))
      return fail("VALIDATION", "A URL or file is required", 400);
    if (url) {
      try {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol))
          return fail("VALIDATION", "Invalid resource URL", 400);
      } catch {
        return fail("VALIDATION", "Invalid resource URL", 400);
      }
    }
    if (
      file instanceof File &&
      (file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.has(file.type))
    ) {
      return fail(
        "VALIDATION",
        "Unsupported file type or file exceeds 50MB",
        400,
      );
    }

    const { storage } = createServerStorage();
    const { databases } = createServerDatabases();
    let fileUrl = url || undefined;
    let fileId: string | null = null;

    if (file instanceof File) {
      const uploaded = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        file,
        MEMBER_FILE_PERMISSIONS,
      );

      fileId = uploaded.$id;
      fileUrl = getStorageFileViewUrl(BUCKET_ID, uploaded.$id);
    }
    const now = new Date().toISOString();
    const canModerate = await hasServerCapability(
      authenticated.user.$id,
      "resources.manage",
    );
    // OAuth profiles sometimes carry no display name — the table requires
    // uploadedByName, so fall back to email before the id rather than 400ing
    // an otherwise valid submission.
    const uploaderName =
      authenticated.user.name?.trim() ||
      authenticated.user.email ||
      authenticated.user.$id;
    const resource = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      ID.unique(),
      {
        title,
        description,
        category,
        layer: category,
        type,
        url: fileUrl ?? null,
        fileId: fileId ?? null,
        departmentId: category === "department" ? departmentId : null,
        requiredRole: category === "role" ? requiredRole : null,
        uploadedBy: authenticated.user.$id,
        uploadedByName: uploaderName,
        tags,
        downloads: 0,
        status: canModerate ? "approved" : "pending",
        isActive: true,
        ...(canModerate
          ? { approvedBy: authenticated.user.$id, approvedAt: now }
          : {}),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "resource.create",
      entityType: "resource",
      entityId: resource.$id,
      details: {
        title,
        category,
        type,
        departmentId: category === "department" ? departmentId : null,
        requiredRole: category === "role" ? requiredRole : null,
        status: canModerate ? "approved" : "pending",
      },
    });

    return ok({ resource }, 201);
  } catch (error) {
    logError("Resource upload error:", error);

    return fail("INTERNAL", "Unable to upload resource", 500);
  }
}
