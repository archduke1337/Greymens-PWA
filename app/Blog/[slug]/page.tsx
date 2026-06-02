// app/blog/[slug]/page.tsx
"use client";

import { Card, CardContent, Button, Chip, Avatar } from "@heroui/react";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { blogService, Blog } from "@/lib/blog";
import { toast } from "sonner";
import {
  ArrowLeftIcon,
  ClockIcon,
  EyeIcon,
  CalendarIcon,
  ShareIcon } from "lucide-react";

export default function BlogPostPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedBlogs, setRelatedBlogs] = useState<Blog[]>([]);

  useEffect(() => {
    if (slug) {
      loadBlog();
    }
  }, [slug]);

  const loadBlog = async () => {
    try {
      const blogData = await blogService.getBlogBySlug(slug);
      setBlog(blogData);

      // Increment views
      if (blogData) {
        blogService.incrementViews(blogData.$id!, blogData.views);
      }

      // Load related blogs
      if (blogData) {
        const related = await blogService.getBlogsByCategory(
          blogData.category,
          4
        );
        setRelatedBlogs(
          related.filter((b) => b.$id !== blogData.$id).slice(0, 3)
        );
      }
    } catch (error) {
      console.error("Error loading blog:", error);
      toast.error("Blog not found");
      router.push("/blog");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric" });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: blog?.title,
        text: blog?.excerpt,
        url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-xl font-semibold mb-4">Blog not found</p>
          <Button variant="primary" color="primary">
                  #{tag}
                </Chip>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Related Blogs */}
        {relatedBlogs.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-bold mb-6">Related Articles</h2>
            <div className="grid md:grid-cols-3 gap-6">
              {relatedBlogs.map((relatedBlog) => (
                <Card
                  key={relatedBlog.$id}
                  isPressable
                  onPress={() => router.push(`/blog/${relatedBlog.slug}`)}
                  className="hover:shadow-xl transition-all"
                >
                  <CardContent className="p-0">
                    <img
                      src={relatedBlog.coverImage}
                      alt={relatedBlog.title}
                      className="w-full h-32 object-cover"
                    />
                    <div className="p-4">
                      <h3 className="font-bold line-clamp-2 mb-2">
                        {relatedBlog.title}
                      </h3>
                      <p className="text-sm text-default-600 line-clamp-2">
                        {relatedBlog.excerpt}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}