import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isHttpUrl, isRecord } from "@/lib/validation";
import { blogCategories } from "@/lib/blog-format";
import { ok, fail, ApiError } from "@/lib/api";

const MAX_REASON_LENGTH = 2000;
const MAX_BLOGS = 200;
const BLOG_CATEGORIES = new Set(blogCategories.map((entry) => entry.value));

function stringField(value: unknown, maxLength: number, required = false) {
  if (typeof value !== "string" || value.length > maxLength || (required && !value.trim())) return null;
  return value.trim();
}

async function loadBlog(blogId: string) {
  const { databases } = createServerDatabases();
  try {
    return { databases, blog: await databases.getDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId) };
  } catch {
    return { databases, blog: null };
  }
}

/**
 * Blog reads for the authoring screens.
 *
 *  - `scope=mine`   — the caller's own posts, any status.
 *  - `scope=review` — posts awaiting review.
 *  - `scope=all`    — every post.
 *
 * The public blog list still reads the blogs table directly, which is fine: it
 * is world-readable content. These scopes exist because "my drafts" and
 * "everything including rejected posts" are not public reads, and previously
 * they were performed by the browser against a world-readable table.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  const scope = request.nextUrl.searchParams.get("scope") ?? "mine";

  try {
    const { databases } = createServerDatabases();
    let queries: string[];

    if (scope === "mine") {
      queries = [Query.equal("authorId", [authenticated.user.$id]), Query.orderDesc("$createdAt"), Query.limit(MAX_BLOGS)];
    } else if (scope === "review" || scope === "all") {
      const permitted = await requireCapability(request, "blog.review");
      if (!permitted.user) return permitted.response;
      queries = scope === "review"
        ? [Query.equal("status", ["pending"]), Query.orderDesc("$createdAt"), Query.limit(MAX_BLOGS)]
        : [Query.orderDesc("$createdAt"), Query.limit(MAX_BLOGS)];
    } else {
      return fail("VALIDATION", "Unsupported scope", 400);
    }

    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.BLOGS, queries);
    return ok({ blogs: response.documents, total: response.total });
  } catch (error) {
    console.error("Blog lookup error:", error);
    return fail("INTERNAL", "Unable to load blogs", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "blog.create");
  if (!authenticated.user) return authenticated.response;

  const limited = consumeRateLimit(`blog-submit:${authenticated.user.$id}`, 20, 60 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const title = stringField(body.title, 255, true);
    const slug = stringField(body.slug, 255, true);
    const excerpt = stringField(body.excerpt, 500, true);
    const content = stringField(body.content, 65535, true);
    const coverImage = stringField(body.coverImage, 500, true);
    const category = stringField(body.category, 100, true);
    const tags = Array.isArray(body.tags) && body.tags.length <= 20 && body.tags.every((tag) => typeof tag === "string" && tag.trim().length > 0 && tag.length <= 100)
      ? body.tags.map((tag) => (tag as string).trim())
      : null;
    const readTime = typeof body.readTime === "number" && Number.isInteger(body.readTime)
      ? Math.max(1, Math.min(body.readTime, 1440))
      : 1;

    if (!title || !slug || !excerpt || !content || !coverImage || !category || !tags) {
      return fail("VALIDATION", "Invalid or missing blog fields", 400);
    }
    // Slugs become public URLs: restrict the alphabet so links stay clean and
    // unambiguous. Cover images render to every visitor: allow http(s) only.
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
      return fail("VALIDATION", "Invalid slug format", 400);
    }
    if (!isHttpUrl(coverImage)) {
      return fail("VALIDATION", "Invalid cover image URL", 400);
    }
    // The write screen offers a fixed catalogue select; anything else is
    // taxonomy pollution that breaks category filters.
    if (!BLOG_CATEGORIES.has(category)) {
      return fail("VALIDATION", "Invalid blog category", 400);
    }

    const { databases } = createServerDatabases();
    const duplicate = await databases.listDocuments(DATABASE_ID, COLLECTIONS.BLOGS, [
      Query.equal("slug", [slug]),
      Query.limit(1),
    ]);
    if (duplicate.documents.length > 0) {
      return fail("CONFLICT", "A blog with this title already exists", 409);
    }

    const blog = await databases.createDocument(DATABASE_ID, COLLECTIONS.BLOGS, ID.unique(), {
      title,
      slug,
      excerpt,
      content,
      coverImage,
      category,
      tags,
      authorId: authenticated.user.$id,
      authorName: authenticated.user.name,
      // The author's email is deliberately not copied onto the post: the blogs
      // table is world-readable, so every author's address would be public.
      authorEmail: "",
      authorAvatar: (authenticated.user.prefs as Record<string, unknown> | undefined)?.avatar || undefined,
      status: "pending",
      views: 0,
      likes: 0,
      featured: false,
      readTime,
    });

    return ok({ blog }, 201);
  } catch (error) {
    console.error("Blog submission error:", error);
    return fail("INTERNAL", "Unable to submit blog", 500);
  }
}

/**
 * Review and curation actions.
 *
 * Each action re-checks the capability it needs rather than trusting a single
 * "is reviewer" gate, so publishing, rejecting and featuring can be delegated
 * separately.
 */
export async function PATCH(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (!isRecord(body)) return fail("VALIDATION", "Invalid request body", 400);

  const blogId = typeof body.blogId === "string" ? body.blogId.trim() : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!blogId) return fail("VALIDATION", "blogId is required", 400);

  const capabilityByAction: Record<string, string> = {
    approve: "blog.approve",
    reject: "blog.review",
    feature: "blog.feature",
    unfeature: "blog.feature",
  };
  const capability = capabilityByAction[action];
  if (!capability) return fail("VALIDATION", "Unsupported action", 400);

  const authenticated = await requireCapability(request, capability);
  if (!authenticated.user) return authenticated.response;

  const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, MAX_REASON_LENGTH) : "";
  if (action === "reject" && !reason) {
    return fail("VALIDATION", "A rejection reason is required", 400);
  }

  try {
    const { databases, blog } = await loadBlog(blogId);
    if (!blog) return fail("NOT_FOUND", "Blog not found", 404);

    // Parity with /api/admin/blogs: nobody approves, publishes, or features
    // their own post — authors holding review powers need a second reviewer.
    const isAuthor = String(blog.authorId ?? "") === authenticated.user.$id;
    if (isAuthor && (action === "approve" || action === "feature")) {
      return fail("FORBIDDEN", "Authors cannot approve or feature their own posts", 403);
    }

    const now = new Date().toISOString();
    const updates: Record<string, unknown> =
      action === "approve" ? { status: "approved", publishedAt: blog.publishedAt || now }
      : action === "reject" ? { status: "rejected", rejectionReason: reason, featured: false }
      : { featured: action === "feature" };

    const updated = await databases.updateDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId, updates);

    await recordAudit({
      request,
      actor: authenticated.user,
      action: `blog_${action}`,
      entityType: "blog",
      entityId: blogId,
      details: { authorId: String(blog.authorId ?? ""), status: String(updates.status ?? blog.status), ...(reason ? { reason } : {}) },
    });

    return ok({ blog: updated });
  } catch (error) {
    console.error("Blog action error:", error);
    return fail("INTERNAL", "Unable to apply the change", 500);
  }
}

/**
 * Delete a post.
 *
 * An author may withdraw their own unpublished submission; a reviewer may remove
 * anything. Previously this ran from the browser, where the delete could not
 * succeed and there was no ownership check at all.
 */
export async function DELETE(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;

  const blogId = (request.nextUrl.searchParams.get("blogId") ?? "").trim();
  if (!blogId) return fail("VALIDATION", "blogId is required", 400);

  try {
    const { databases, blog } = await loadBlog(blogId);
    if (!blog) return fail("NOT_FOUND", "Blog not found", 404);

    const isAuthor = String(blog.authorId ?? "") === authenticated.user.$id;
    if (isAuthor && blog.status === "approved") {
      return fail("FORBIDDEN", "A published post cannot be withdrawn by its author. Ask an editor to remove it.", 403);
    }

    if (!isAuthor) {
      const reviewer = await requireCapability(request, "blog.review");
      if (!reviewer.user) return reviewer.response;
    }

    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId);

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "blog_delete",
      entityType: "blog",
      entityId: blogId,
      details: { authorId: String(blog.authorId ?? ""), status: String(blog.status ?? ""), byAuthor: isAuthor },
    });

    return ok({ success: true });
  } catch (error) {
    console.error("Blog delete error:", error);
    return fail("INTERNAL", "Unable to delete the post", 500);
  }
}
