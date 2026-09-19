import { NextRequest } from "next/server";
import { Query } from "appwrite";

import {
  createServerDatabases,
  createServerStorage,
} from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import {
  MEMBER_FILE_PERMISSIONS,
  PUBLIC_FILE_PERMISSIONS,
} from "@/lib/storage";
import { requireCapability } from "@/lib/access-control";
import { getAccountNames } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "gallery-images";

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.GALLERY,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );
    // Uploader names live on the auth record — best-effort so a lookup
    // failure never fails the review queue.
    const uploaderIds = [
      ...new Set(
        response.documents
          .map((doc) => String(doc.uploadedBy ?? ""))
          .filter(Boolean),
      ),
    ];
    const accountNames = await getAccountNames(uploaderIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok({
      images: response.documents,
      total: response.total,
      accountNames,
    });
  } catch (error) {
    logError("Admin gallery list error:", error);

    return fail("INTERNAL", "Unable to load gallery", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as {
      imageId?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const imageId = typeof body.imageId === "string" ? body.imageId.trim() : "";
    const action = body.action;

    if (!imageId || (action !== "approve" && action !== "reject")) {
      return fail("VALIDATION", "Invalid gallery action", 400);
    }
    if (
      action === "reject" &&
      (typeof body.reason !== "string" || !body.reason.trim())
    ) {
      return fail("VALIDATION", "A rejection reason is required", 400);
    }

    const { databases } = createServerDatabases();
    // Approving clears a previous rejection and rejecting clears a previous
    // approval, so a re-reviewed image never carries both verdicts at once.
    const data =
      action === "approve"
        ? {
            status: "approved",
            approvedBy: authenticated.user.$id,
            approvedAt: new Date().toISOString(),
            rejectionReason: null,
          }
        : {
            status: "rejected",
            rejectionReason: String(body.reason).slice(0, 2000),
            approvedBy: null,
            approvedAt: null,
          };
    const image = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.GALLERY,
      imageId,
      data,
    );

    // The verdict decides whether the stored file is world-readable. Uploads
    // now land members-only, so approving has to publish the file, and
    // re-rejecting a previously approved image has to un-publish it again.
    // A failure here is logged, not fatal: the moderation decision is already
    // saved, and a link-only row has no file to flip.
    const storageFileId = String(image.storageFileId ?? "");

    if (storageFileId) {
      const { storage } = createServerStorage();

      await storage
        .updateFile({
          bucketId: BUCKET_ID,
          fileId: storageFileId,
          permissions:
            action === "approve"
              ? PUBLIC_FILE_PERMISSIONS
              : MEMBER_FILE_PERMISSIONS,
        })
        .catch((error) => {
          logError("Gallery file permission update failed:", error);
        });
    }

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
    logError("Admin gallery update error:", error);

    return fail("INTERNAL", "Unable to update gallery image", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "gallery.manage");

  if (!authenticated.user) return authenticated.response;

  try {
    const imageId = new URL(request.url).searchParams.get("imageId")?.trim();

    if (!imageId) return fail("VALIDATION", "imageId is required", 400);
    const { databases } = createServerDatabases();

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
    logError("Admin gallery delete error:", error);

    return fail("INTERNAL", "Unable to delete gallery image", 500);
  }
}
