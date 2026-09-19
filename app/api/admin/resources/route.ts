import { NextRequest } from "next/server";
import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Resource review queue.
 *
 * Mirrors `/api/admin/gallery`: member submissions arrive as `pending`
 * (see POST /api/resources) and only a `resources.manage` holder can publish
 * or refuse them. Metadata edits and soft-deletes stay on /api/resources —
 * this route owns moderation only, so the approve/reject vocabulary lives in
 * exactly one place per content type.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "resources.manage");

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
  const authenticated = await requireCapability(request, "resources.manage");

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
    const resource = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.RESOURCES,
      resourceId,
      data,
    );

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
