// lib/blogs.ts
import { ID, Query } from "appwrite";
import { databases, storage } from "./appwrite";
import { DATABASE_ID } from "./database";

// Collection IDs
export const BLOGS_COLLECTION_ID = "blogs";
export const BLOG_IMAGES_BUCKET_ID = "blog-images";

// Blog Interface
export interface Blog {
  $id?: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  coverImage: string;
  category: string;
  tags: string[];
  authorId: string;
  authorName: string;
  authorEmail: string;
  authorAvatar?: string;
  status: "draft" | "pending" | "approved" | "rejected";
  rejectionReason?: string;
  publishedAt?: string;
  views: number;
  likes: number;
  featured: boolean;
  readTime: number; // in minutes
  $createdAt?: string;
  $updatedAt?: string;
}

// Blog Service
export const blogService = {
  // Get all approved blogs (public)
  async getPublishedBlogs(limit: number = 50) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("status", "approved"),
          Query.orderDesc("publishedAt"),
          Query.limit(limit),
        ]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching published blogs:", error);
      return [];
    }
  },

  // Get featured blogs
  async getFeaturedBlogs(limit: number = 3) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("status", "approved"),
          Query.equal("featured", true),
          Query.orderDesc("publishedAt"),
          Query.limit(limit),
        ]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching featured blogs:", error);
      return [];
    }
  },

  // Get blogs by category
  async getBlogsByCategory(category: string, limit: number = 20) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("status", "approved"),
          Query.equal("category", category),
          Query.orderDesc("publishedAt"),
          Query.limit(limit),
        ]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching blogs by category:", error);
      return [];
    }
  },

  // Get blog by slug
  async getBlogBySlug(slug: string) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("slug", slug),
          Query.equal("status", "approved"),
          Query.limit(1),
        ]
      );
      return response.documents[0] as unknown as Blog;
    } catch (error) {
      console.error("Error fetching blog by slug:", error);
      throw error;
    }
  },

  // Get user's blogs
  async getUserBlogs(userId: string) {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("authorId", userId),
          Query.orderDesc("$createdAt"),
        ]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching user blogs:", error);
      return [];
    }
  },

  // Get all blogs (admin only)
  async getAllBlogs() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [Query.orderDesc("$createdAt"), Query.limit(100)]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching all blogs:", error);
      return [];
    }
  },

  // Get pending blogs (admin only)
  async getPendingBlogs() {
    try {
      const response = await databases.listDocuments(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        [
          Query.equal("status", "pending"),
          Query.orderDesc("$createdAt"),
        ]
      );
      return response.documents as unknown as Blog[];
    } catch (error) {
      console.error("Error fetching pending blogs:", error);
      return [];
    }
  },

  // Create blog (user submission)
  async createBlog(blogData: Omit<Blog, "$id" | "$createdAt" | "$updatedAt">) {
    try {
      const response = await databases.createDocument(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        ID.unique(),
        {
          ...blogData,
          status: "pending", // Always starts as pending
          views: 0,
          likes: 0,
        }
      );
      return response as unknown as Blog;
    } catch (error) {
      console.error("Error creating blog:", error);
      throw error;
    }
  },

  // Update blog
  async updateBlog(blogId: string, blogData: Partial<Blog>) {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        blogId,
        blogData
      );
      return response as unknown as Blog;
    } catch (error) {
      console.error("Error updating blog:", error);
      throw error;
    }
  },

  // Approve blog (admin only)
  async approveBlog(blogId: string) {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        blogId,
        {
          status: "approved",
          publishedAt: new Date().toISOString(),
        }
      );
      return response as unknown as Blog;
    } catch (error) {
      console.error("Error approving blog:", error);
      throw error;
    }
  },

  // Reject blog (admin only)
  async rejectBlog(blogId: string, reason: string) {
    try {
      const response = await databases.updateDocument(
        DATABASE_ID,
        BLOGS_COLLECTION_ID,
        blogId,
        {
          status: "rejected",
          rejectionReason: reason,
        }
      );
      return response as unknown as Blog;
    } catch (error) {
      console.error("Error rejecting blog:", error);
      throw error;
    }
  },

  // Delete blog
  async deleteBlog(blogId: string) {
    try {
      await databases.deleteDocument(DATABASE_ID, BLOGS_COLLECTION_ID, blogId);
      return true;
    } catch (error) {
      console.error("Error deleting blog:", error);
      throw error;
    }
  },

  // Increment views
  async incrementViews(blogId: string, currentViews: number) {
    try {
      await databases.updateDocument(DATABASE_ID, BLOGS_COLLECTION_ID, blogId, {
        views: currentViews + 1,
      });
    } catch (error) {
      console.error("Error incrementing views:", error);
    }
  },

  // Upload blog image
  async uploadBlogImage(file: File) {
    try {
      const response = await storage.createFile(
        BLOG_IMAGES_BUCKET_ID,
        ID.unique(),
        file
      );
      const fileUrl = storage.getFileView(BLOG_IMAGES_BUCKET_ID, response.$id);
      return fileUrl.toString();
    } catch (error) {
      console.error("Error uploading blog image:", error);
      throw error;
    }
  },

  // Generate slug from title
  generateSlug(title: string): string {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  },

  // Calculate read time (words per minute)
  calculateReadTime(content: string): number {
    const wordsPerMinute = 200;
    const wordCount = content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
  },
};

// Blog Categories
export const blogCategories = [
  { value: "technology", label: "Technology" },
  { value: "ai-ml", label: "AI & Machine Learning" },
  { value: "web-dev", label: "Web Development" },
  { value: "mobile-dev", label: "Mobile Development" },
  { value: "data-science", label: "Data Science" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "design", label: "Design" },
  { value: "career", label: "Career & Growth" },
  { value: "tutorial", label: "Tutorial" },
  { value: "news", label: "News & Updates" },
  { value: "other", label: "Other" },
];