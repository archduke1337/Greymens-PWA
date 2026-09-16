import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { isRecord } from "@/lib/validation";
import { ok, fail, ApiError } from "@/lib/api";

/**
 * Record a page view for a published post.
 *
 * Reading a blog is public, so this endpoint is unauthenticated. It is also the
 * only write in the blog feature that anonymous visitors cause, so it is
 * deliberately narrow: it can only ever increment `views` on a post that is
 * already approved, by exactly one, and only a limited number of times per
 * address. The previous implementation incremented the counter from the reader's
 * browser, which both failed (the table grants no client write) and, had it
 * worked, let any client write an arbitrary value.
 */
export async function POST(request: NextRequest) {
  const limit = consumeRateLimit(`blog-view:${getClientAddress(request)}`, 120, 60 * 60 * 1000);
  if (!limit.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (!isRecord(body)) return fail("VALIDATION", "Invalid request body", 400);

  const blogId = typeof body.blogId === "string" ? body.blogId.trim() : "";
  if (!blogId) return fail("VALIDATION", "blogId is required", 400);

  try {
    const { databases } = createAdminClient();
    // Uniform negative: missing and unpublished both answer `recorded: false`
    // so the endpoint cannot be used to probe for draft posts.
    const blog = await databases.getDocument(DATABASE_ID, COLLECTIONS.BLOGS, blogId).catch(() => null);
    if (!blog || blog.status !== "approved") {
      return ok({ recorded: false });
    }

    await databases.incrementDocumentAttribute(DATABASE_ID, COLLECTIONS.BLOGS, blogId, "views", 1);
    return ok({ recorded: true });
  } catch (error) {
    console.error("Blog view error:", error);
    return fail("INTERNAL", "Unable to record the view", 500);
  }
}
