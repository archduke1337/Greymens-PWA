// lib/blog.ts
import type { Blog } from "./blog-format";

import { Query } from "appwrite";

import { logError } from "@/lib/logger";

import { databases, APPWRITE_CONFIG } from "./appwrite";

// The Blog type, the category catalogue and the pure formatting helpers live in
// lib/blog-format.ts so client components can use them without pulling in this
// module. Re-exported here for existing call sites.
export type { Blog } from "./blog-format";
export { blogCategories, generateSlug, calculateReadTime } from "./blog-format";

const { databaseId: DATABASE_ID, blogsCollectionId: BLOGS_COLLECTION_ID } =
  APPWRITE_CONFIG;

/**
 * Public blog reads.
 *
 * Only reads remain here. The write methods (`createBlog`, `updateBlog`,
 * `approveBlog`, `rejectBlog`, `deleteBlog`, `uploadBlogImage`,
 * `incrementViews`) have all been removed: each one wrote to Appwrite from the
 * browser, where the blogs table and the blog-images bucket grant no client
 * write permission, so none of them could succeed. They now go through
 * `/api/blogs`, `/api/blogs/image` and `/api/blogs/views`, which validate input
 * and check the caller's capability.
 *
 * The two reads below stay because published posts are world-readable content —
 * serving them straight from the table is the cheapest correct thing to do.
 */
export const blogService = {
  async getPublishedBlogs(limit = 50): Promise<Blog[]> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("status", ["approved", "published"]),
          Query.orderDesc("publishedAt"),
          Query.limit(limit),
        ],
      );

      return response.documents as unknown as Blog[];
    } catch (error) {
      logError("Error fetching published blogs:", error);

      return [];
    }
  },

  async getBlogBySlug(slug: string): Promise<Blog | undefined> {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("slug", slug),
          Query.equal("status", ["approved", "published"]),
          Query.limit(1),
        ],
      );

      return response.documents[0] as unknown as Blog | undefined;
    } catch (error) {
      logError("Error fetching blog by slug:", error);
      throw error;
    }
  },
};
