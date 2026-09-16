import { NextRequest } from "next/server";
import { Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GALLERY, [
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ]);
    return ok({ images: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin gallery list error:", error);
    return fail("INTERNAL", "Unable to load gallery", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const body = await request.json() as { imageId?: unknown; action?: unknown; reason?: unknown };
    const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
    const action = body.action;
    if (!imageId || (action !== "approve" && action !== "reject")) {
      return fail("VALIDATION", "Invalid gallery action", 400);
    }
    if (action === "reject" && (typeof body.reason !== "string" || !body.reason.trim())) {
      return fail("VALIDATION", "A rejection reason is required", 400);
    }

    const { databases } = createAdminClient();
    const data = action === "approve"
      ? { status: "approved", approvedBy: authenticated.user.$id, approvedAt: new Date().toISOString() }
      : { status: "rejected", rejectionReason: String(body.reason).slice(0, 2000) };
    const image = await databases.updateDocument(DATABASE_ID, COLLECTIONS.GALLERY, imageId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: `gallery.${String(action)}`,
      entityType: "gallery_image",
      entityId: imageId,
      details: { action: String(action) },
    });
    return ok({ image });
  } catch (error) {
    console.error("Admin gallery update error:", error);
    return fail("INTERNAL", "Unable to update gallery image", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");
  if (!authenticated.user) return authenticated.response;

  try {
    const imageId = new URL(request.url).searchParams.get("imageId")?.trim();
    if (!imageId) return fail("VALIDATION", "imageId is required", 400);
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.GALLERY, imageId);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "gallery.delete",
      entityType: "gallery_image",
      entityId: imageId,
      details: {},
    });
    return ok({ success: true });
  } catch (error) {
    console.error("Admin gallery delete error:", error);
    return fail("INTERNAL", "Unable to delete gallery image", 500);
  }
}
