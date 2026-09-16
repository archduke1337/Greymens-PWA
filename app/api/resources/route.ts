import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { getAuthenticatedUser, getMembershipStatus, isMemberStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { MEMBER_FILE_PERMISSIONS } from "@/lib/storage";
import { ok, fail, ApiError } from "@/lib/api";

const BUCKET_ID = "resources";
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "text/plain", "text/csv", "application/zip"]);
const ALLOWED_CATEGORIES = new Set(["common", "department", "role"]);
const ALLOWED_RESOURCE_TYPES = new Set(["document", "link", "video", "file"]);

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.RESOURCES, [
      Query.equal("isActive", [true]),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);

    if (request.nextUrl.searchParams.get("all") === "true") {
      const admin = await requireCapability(request, "resources.manage");
      if (!admin.user) return admin.response;
      return ok({ resources: response.documents });
    }

    if (!user) {
      return ok({ resources: response.documents.filter((resource) => resource.category === "common") });
    }

    const membershipStatus = await getMembershipStatus(user);
    const resources = response.documents.filter((resource) => {
      if (resource.category === "common") return true;
      if (!isMemberStatus(membershipStatus)) return false;
      if (resource.category === "role") {
        return !resource.requiredRole || resource.requiredRole === membershipStatus;
      }
      return true;
    });
    return ok({ resources });
  } catch (error) {
    console.error("Resource list error:", error);
    return fail("INTERNAL", "Unable to load resources", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "resources.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as Record<string, unknown>;
    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    if (!resourceId) return fail("VALIDATION", "resourceId is required", 400);

    const updates: Record<string, unknown> = {};
    for (const field of ["title", "description", "type", "url", "layer", "departmentId", "tags", "isActive"]) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (typeof updates.title !== "string" || !updates.title.trim() || updates.title.length > 255) {
      return fail("VALIDATION", "A valid title is required", 400);
    }
    if (updates.url !== undefined && updates.url !== null && updates.url !== "") {
      if (typeof updates.url !== "string") return fail("VALIDATION", "Invalid resource URL", 400);
      try {
        const parsed = new URL(updates.url);
        if (!["http:", "https:"].includes(parsed.protocol)) return fail("VALIDATION", "Invalid resource URL", 400);
      } catch {
        return fail("VALIDATION", "Invalid resource URL", 400);
      }
    }
    if (updates.type !== undefined && (typeof updates.type !== "string" || !ALLOWED_RESOURCE_TYPES.has(updates.type))) {
      return fail("VALIDATION", "Invalid resource type", 400);
    }
    if (updates.layer !== undefined && (typeof updates.layer !== "string" || !ALLOWED_CATEGORIES.has(updates.layer))) {
      return fail("VALIDATION", "Invalid resource category", 400);
    }
    // The legacy model contains both names for the same classification. Keep
    // them synchronized so public filtering (`category`) and admin display
    // (`layer`) cannot disagree after an edit.
    if (typeof updates.layer === "string") updates.category = updates.layer;
    if (updates.tags !== undefined && (!Array.isArray(updates.tags) || updates.tags.some((tag) => typeof tag !== "string"))) {
      return fail("VALIDATION", "Invalid resource tags", 400);
    }

    const { databases } = createAdminClient();
    const resource = await databases.updateDocument(DATABASE_ID, COLLECTIONS.RESOURCES, resourceId, updates);
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
    console.error("Resource update error:", error);
    return fail("INTERNAL", "Unable to update resource", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "resources.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as { resourceId?: unknown };
    const resourceId = typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    if (!resourceId) return fail("VALIDATION", "resourceId is required", 400);
    const { databases } = createAdminClient();
    await databases.updateDocument(DATABASE_ID, COLLECTIONS.RESOURCES, resourceId, { isActive: false });
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
    console.error("Resource delete error:", error);
    return fail("INTERNAL", "Unable to delete resource", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const status = await getMembershipStatus(authenticated.user);
  if (!isMemberStatus(status) || ["member", "core_member"].includes(status)) {
    return fail("FORBIDDEN", "Resource uploads require lead access", 403);
  }

  try {
    const form = await request.formData();
    const title = text(form.get("title"), 255);
    const description = text(form.get("description"), 5000);
    const category = text(form.get("category") ?? form.get("layer"), 50) || "common";
    const type = text(form.get("type"), 50) || "document";
    const url = text(form.get("url"), 500);
    const tags = text(form.get("tags"), 1000).split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 20);
    const file = form.get("file");
    if (!title) return fail("VALIDATION", "Title is required", 400);
    if (!ALLOWED_CATEGORIES.has(category) || !ALLOWED_RESOURCE_TYPES.has(type)) {
      return fail("VALIDATION", "Invalid resource category or type", 400);
    }
    if (!url && !(file instanceof File)) return fail("VALIDATION", "A URL or file is required", 400);
    if (url) {
      try {
        const parsed = new URL(url);
        if (!["http:", "https:"].includes(parsed.protocol)) return fail("VALIDATION", "Invalid resource URL", 400);
      } catch {
        return fail("VALIDATION", "Invalid resource URL", 400);
      }
    }
    if (file instanceof File && (file.size > MAX_FILE_SIZE || !ALLOWED_TYPES.has(file.type))) {
      return fail("VALIDATION", "Unsupported file type or file exceeds 50MB", 400);
    }

    const { storage, databases } = createAdminClient();
    let fileUrl = url || undefined;
    let fileId: string | null = null;
    if (file instanceof File) {
      const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), file, MEMBER_FILE_PERMISSIONS);
      fileId = uploaded.$id;
      fileUrl = storage.getFileView(BUCKET_ID, uploaded.$id).toString();
    }
    const resource = await databases.createDocument(DATABASE_ID, COLLECTIONS.RESOURCES, ID.unique(), {
      title,
      description,
      category,
      layer: category,
      type,
      url: fileUrl,
      fileId,
      uploadedBy: authenticated.user.$id,
      uploadedByName: authenticated.user.name,
      tags,
      downloads: 0,
      isActive: true,
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "resource.create",
      entityType: "resource",
      entityId: resource.$id,
      details: { title, category, type },
    });
    return ok({ resource }, 201);
  } catch (error) {
    console.error("Resource upload error:", error);
    return fail("INTERNAL", "Unable to upload resource", 500);
  }
}
