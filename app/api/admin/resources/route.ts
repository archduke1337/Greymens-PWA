import { NextRequest } from "next/server";
import { Query } from "appwrite";

import {
  createServerDatabases,
  createServerStorage,
} from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { MEMBER_FILE_PERMISSIONS, ownerFilePermissions } from "@/lib/storage";
import { requireAnyCapability } from "@/lib/access-control";
import { dispatchNotification } from "@/lib/notify";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "resources";

/**
 * Resource review queue.
 *
 * Mirrors `/api/admin/gallery`: member submissions arrive as `pending`
 * (see POST /api/resources) and a `resources.approve` (or `resources.manage`)
 * holder can publish or refuse them. Metadata edits and soft-deletes stay on
 * /api/resources — this route owns moderation only, so the approve/reject
 * vocabulary lives in exactly one place per content type.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAnyCapability(request, [
    "resources.approve",
    "resources.manage",
  ]);

  if (!authenticated.user) return authenticated.response;

  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );

    return ok({ resources: response.documents, total: response.total });
  } catch (error) {
    logError("Admin resource list error:", error);

    return fail("INTERNAL", "Unable to load resources", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireAnyCapability(request, [
    "resources.approve",
    "resources.manage",
  ]);

  if (!authenticated.user) return authenticated.response;

  try {
    const body = (await request.json()) as {
      resourceId?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const resourceId =
      typeof body.resourceId === "string" ? body.resourceId.trim() : "";
    const action = body.action;

    if (!resourceId || (action !== "approve" && action !== "reject")) {
      return fail("VALIDATION", "Invalid resource action", 400);
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
    const resource = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      resourceId,
      data,
    );

    // The verdict also decides who may read the stored file: approved material
    // is club property (members), and anything sent back belongs to its
    // uploader alone. Link-only rows have no file of ours to flip. A failure
    // is logged rather than fatal — the moderation decision is already saved.
    const fileId = String(resource.fileId ?? "");
    const uploaderId = String(resource.uploadedBy ?? "");

    if (fileId) {
      const { storage } = createServerStorage();

      await storage
        .updateFile({
          bucketId: BUCKET_ID,
          fileId,
          permissions:
            action === "approve" || !uploaderId
              ? MEMBER_FILE_PERMISSIONS
              : ownerFilePermissions(uploaderId),
        })
        .catch((error) => {
          logError("Resource file permission update failed:", error);
        });
    }

    // Close the loop for the submitter: the verdict reached the row and the
    // file, but until now nothing reached the person who uploaded it — no
    // in-app row, no mail. They had to reload the library and guess.
    const resourceTitle = String(resource.title ?? "your resource");

    if (uploaderId) {
      await dispatchNotification({
        userId: uploaderId,
        type: "submission_update",
        title:
          action === "approve"
            ? "Resource published"
            : "Resource needs changes",
        body:
          action === "approve"
            ? `"${resourceTitle}" was approved and is now in the resource library.`
            : `"${resourceTitle}" was not approved yet. Reviewer note: ${
                reason || "no reason given"
              }`,
      }).catch((error) => {
        // The decision is saved; only the notice failed. Log it rather than
        // letting a silent catch imply the submitter was told.
        logError("Resource decision notification failed:", error);
      });
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: `resource.${String(action)}`,
      entityType: "resource",
      entityId: resourceId,
      details: { action: String(action) },
    });

    return ok({ resource });
  } catch (error) {
    logError("Admin resource update error:", error);

    return fail("INTERNAL", "Unable to update resource", 500);
  }
}
