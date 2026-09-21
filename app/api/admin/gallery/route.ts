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
import { requireAnyCapability, requireCapability } from "@/lib/access-control";
import { dispatchNotification } from "@/lib/notify";
import { getAccountNames } from "@/lib/server-users";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "gallery-images";

export async function GET(request: NextRequest) {
  // Reviewers need the queue; the moderation decisions they make do not grant
  // the delete below, which stays on the full grant.
  const authenticated = await requireAnyCapability(request, [
    "gallery.manage",
    "gallery.approve",
  ]);

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
  const authenticated = await requireAnyCapability(request, [
    "gallery.approve",
    "gallery.manage",
  ]);

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as {
      imageId?: unknown;
      imageIds?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const action = body.action;
    const actionValid = action === "approve" || action === "reject";
    // Bulk form: an array of ids decides many rows in one pass. A single id
    // keeps working unchanged — both normalise to the same id list.
    const rawIds = Array.isArray(body.imageIds)
      ? body.imageIds
      : body.imageId !== undefined
        ? [body.imageId]
        : [];
    const imageIds = [
      ...new Set(
        rawIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ].slice(0, 100);

    if (imageIds.length === 0 || !actionValid) {
      return fail("VALIDATION", "Invalid gallery action", 400);
    }
    if (
      action === "reject" &&
      (typeof body.reason !== "string" || !body.reason.trim())
    ) {
      return fail("VALIDATION", "A rejection reason is required", 400);
    }

    const { databases } = createServerDatabases();
    const reason =
      typeof body.reason === "string" ? body.reason.trim().slice(0, 2000) : "";
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
            rejectionReason: reason,
            approvedBy: null,
            approvedAt: null,
          };
    // Each row decides independently: one bad id (deleted mid-review, typo)
    // fails alone instead of 500ing the whole batch. Storage flips and
    // uploader notices ride the same loop, exactly as the single path does.
    const decided: Record<string, unknown>[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of imageIds) {
      try {
        const image = await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.GALLERY,
          id,
          data,
        );

        // The verdict decides whether the stored file is world-readable.
        // Uploads land members-only, so approving publishes the file and
        // re-rejecting un-publishes it. A failure is logged, not fatal: the
        // decision is saved, and a link-only row has no file to flip.
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

        // Close the loop for the uploader: the verdict reaches the person,
        // not just the row. Bulk-approving a member's album mails one notice
        // per photo, which is noisy but honest; the alternative — batching
        // per uploader — needs grouping the loop buys nothing at queue size.
        const uploaderId = String(image.uploadedBy ?? "");
        const imageTitle = String(image.title ?? "your image");

        if (uploaderId) {
          await dispatchNotification({
            userId: uploaderId,
            type: "submission_update",
            title:
              action === "approve" ? "Photo approved" : "Photo needs changes",
            body:
              action === "approve"
                ? `"${imageTitle}" was approved and is now in the gallery.`
                : `"${imageTitle}" was not approved yet. Reviewer note: ${
                    reason || "no reason given"
                  }`,
          }).catch((error) => {
            // The decision is saved; only the notice failed. Log it rather
            // than letting a silent catch imply the uploader was told.
            logError("Gallery decision notification failed:", error);
          });
        }

        try {
          await recordAudit({
            request,
            actor: authenticated.user,
            action: `gallery.${String(action)}`,
            entityType: "gallery_image",
            entityId: id,
            details: { action: String(action), bulk: imageIds.length > 1 },
          });
        } catch (auditError) {
          logError("Gallery audit failed (non-fatal):", auditError);
        }
        decided.push(image);
      } catch (rowError) {
        failed.push({
          id,
          error: rowError instanceof Error ? rowError.message : "unknown error",
        });
        logError("Gallery bulk row update failed:", rowError);
      }
    }

    if (decided.length === 0) {
      return fail("INTERNAL", "Unable to update gallery image", 500);
    }

    return ok({
      images: decided,
      decided: decided.length,
      ...(failed.length > 0 ? { failed } : {}),
    });
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
