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
import { consumeRateLimit } from "@/lib/rate-limit";
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
    let response: { documents: unknown[]; total: number };
    try {
      response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.RESOURCES, [
        Query.equal("isActive", [true]),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
    } catch {
      // Column missing on old DBs — fetch and filter in code
      const fallback = await databases.listDocuments(DATABASE_ID, COLLECTIONS.RESOURCES, [
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ]);
      response = {
        documents: (fallback.documents as unknown[]).filter(
          (r) => (r as Record<string, unknown>).isActive !== false,
        ),
        total: fallback.total,
      } as typeof fallback;
    }

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
  if (
    !consumeRateLimit(
      `resource-moderate:${authenticated.user.$id}`,
      60,
      10 * 60 * 1000,
    ).allowed
  ) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = (await request.json()) as {
      resourceId?: unknown;
      resourceIds?: unknown;
      action?: unknown;
      reason?: unknown;
    };
    const action = body.action;
    const actionValid = action === "approve" || action === "reject";
    // Bulk form: an array of ids decides many rows in one pass. A single id
    // keeps working unchanged — both normalise to the same id list.
    const rawIds = Array.isArray(body.resourceIds)
      ? body.resourceIds
      : body.resourceId !== undefined
        ? [body.resourceId]
        : [];
    const resourceIds = [
      ...new Set(
        rawIds
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ].slice(0, 100);

    if (resourceIds.length === 0 || !actionValid) {
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
            // Clear previous rejection — use null so Appwrite clears the optional string column.
            // Gallery uses same pattern and succeeds; keep null not "" so a prior reason is removed not blanked.
            rejectionReason: null,
          }
        : {
            status: "rejected",
            rejectionReason: reason,
            approvedBy: null,
            approvedAt: null,
          };
    // Each row decides independently: one bad id fails alone instead of
    // 500ing the whole batch. Storage flips and uploader notices ride the
    // same loop as the single path.
    const decided: Record<string, unknown>[] = [];
    const failed: Array<{ id: string; error: string }> = [];

    for (const id of resourceIds) {
      try {
        const resource = await databases.updateDocument(
          DATABASE_ID,
          COLLECTIONS.RESOURCES,
          id,
          data,
        );

        // The verdict also decides who may read the stored file: approved
        // material is club property (members), and anything sent back belongs
        // to its uploader alone. Link-only rows have no file of ours to flip.
        // A failure is logged rather than fatal — the decision is saved.
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

        // Close the loop for the submitter: the verdict reaches the person,
        // not just the row and the file.
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
            // The decision is saved; only the notice failed. Log it rather
            // than letting a silent catch imply the submitter was told.
            logError("Resource decision notification failed:", error);
          });
        }

        try {
          await recordAudit({
            request,
            actor: authenticated.user,
            action: `resource.${String(action)}`,
            entityType: "resource",
            entityId: id,
            details: { action: String(action), bulk: resourceIds.length > 1 },
          });
        } catch (auditError) {
          logError("Resource audit failed (non-fatal):", auditError);
        }
        decided.push(resource);
      } catch (rowError) {
        failed.push({
          id,
          error: rowError instanceof Error ? rowError.message : "unknown error",
        });
        logError("Resource bulk row update failed:", rowError);
      }
    }

    if (decided.length === 0) {
      // Surface the row error (e.g. unknown attribute on a pre-moderation DB,
      // missing file, capability misconfig) instead of a generic message —
      // otherwise the console can only report "not working" with no cause.
      const cause = failed[0]?.error ?? "unknown error";
      return fail("INTERNAL", `Unable to update resource: ${cause}`, 500);
    }

    return ok({
      resources: decided,
      decided: decided.length,
      ...(failed.length > 0 ? { failed } : {}),
    });
  } catch (error) {
    logError("Admin resource update error:", error);

    return fail("INTERNAL", "Unable to update resource", 500);
  }
}
