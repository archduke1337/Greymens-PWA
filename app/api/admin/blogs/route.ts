import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { Query } from "appwrite";
import { ok, fail, ApiError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "blog.review");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.BLOGS, [Query.orderDesc("$createdAt"), Query.limit(100)]);
    return ok({ blogs: response.documents, total: response.total });
  } catch (error) {
    console.error("Editorial blog list error:", error);
    return fail("INTERNAL", "Unable to load blogs", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = body?.action;
  const capability = action === "publish" ? "blog.publish" : action === "feature" ? "blog.feature" : action === "reject" ? "blog.review" : "blog.approve";
  const authenticated = await requireCapability(request, capability);
  if (!authenticated.user) return authenticated.response;

  try {
    const blogId = typeof body?.blogId === "string" ? body.blogId.trim() : "";
    if (!blogId || !["approve", "reject", "publish", "feature"].includes(String(action))) {
      return fail("VALIDATION", "Invalid blog action", 400);
    }
    if (action === "reject" && (typeof body?.reason !== "string" || !body.reason.trim())) {
      return fail("VALIDATION", "A rejection reason is required", 400);
    }

    const { databases } = createAdminClient();
    const existing = await databases.getDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId) as Record<string, unknown>;
    if (existing.authorId === authenticated.user.$id && ["approve", "publish", "feature"].includes(String(action))) {
      return fail("FORBIDDEN", "Authors cannot approve, publish, or feature their own work", 403);
    }
    const data = action === "approve"
      ? { status: "approved", approvedBy: authenticated.user.$id, approvedAt: new Date().toISOString() }
      : action === "publish"
        ? { status: "published", publishedAt: new Date().toISOString(), publishedBy: authenticated.user.$id }
        : action === "reject"
          ? { status: "rejected", rejectionReason: String(body?.reason).slice(0, 2000), reviewedBy: authenticated.user.$id }
          : { featured: body?.featured === true };
    const blog = await databases.updateDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: `blog.${String(action)}`,
      entityType: "blog",
      entityId: blogId,
      details: { action: String(action) },
    });
    return ok({ blog });
  } catch (error) {
    console.error("Editorial blog update error:", error);
    return fail("INTERNAL", "Unable to update blog", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "blog.review");
  if (!authenticated.user) return authenticated.response;
  try {
    const blogId = new URL(request.url).searchParams.get("blogId")?.trim();
    if (!blogId) return fail("VALIDATION", "blogId is required", 400);
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "blog.delete",
      entityType: "blog",
      entityId: blogId,
      details: {},
    });
    return ok({ success: true });
  } catch (error) {
    console.error("Admin blog delete error:", error);
    return fail("INTERNAL", "Unable to delete blog", 500);
  }
}
