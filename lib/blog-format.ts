/**
 * Blog types and pure formatting helpers.
 *
 * Deliberately dependency-free so client components can use them without
 * importing `lib/blog.ts`, which is built around the Appwrite browser SDK.
 */

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
  readTime: number;
  $createdAt?: string;
  $updatedAt?: string;
}

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

export function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function calculateReadTime(content: string): number {
  const wordsPerMinute = 200;
  const wordCount = content.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(wordCount / wordsPerMinute));
}
