// app/blog/[slug]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardBody } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { blogService, Blog } from "@/lib/blog";
import {
  ArrowLeftIcon,
  ClockIcon,
  EyeIcon,
  CalendarIcon,
  ShareIcon,
} from "lucide-react";

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
      alert("Blog not found");
      router.push("/blog");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: blog?.title,
        text: blog?.excerpt,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert("Link copied to clipboard!");
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
          <Button color="primary" onPress={() => router.push("/blog")}>
            Back to Blogs
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-20">
      {/* Back Button */}
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <Button
          variant="light"
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
          onPress={() => router.push("/blog")}
        >
          Back to Blogs
        </Button>
      </div>

      {/* Hero Section */}
      <div className="relative h-[400px] mb-12">
        <img
          src={blog.coverImage}
          alt={blog.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />

        {/* Title Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <div className="container mx-auto max-w-4xl">
            <Chip color="primary" variant="solid" className="mb-4">
              {blog.category}
            </Chip>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {blog.title}
            </h1>
            <p className="text-xl text-white/90">{blog.excerpt}</p>
          </div>
        </div>
      </div>

      {/* Content Container */}
      <div className="container mx-auto px-4 max-w-4xl">
        {/* Meta Info */}
        <Card className="mb-8">
          <CardBody className="p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              {/* Author */}
              <div className="flex items-center gap-3">
                <Avatar
                  src={blog.authorAvatar}
                  name={blog.authorName}
                  size="lg"
                />
                <div>
                  <p className="font-semibold">{blog.authorName}</p>
                  <p className="text-sm text-default-500">
                    {blog.publishedAt && formatDate(blog.publishedAt)}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-6 text-sm text-default-600">
                <div className="flex items-center gap-2">
                  <ClockIcon className="w-4 h-4" />
                  <span>{blog.readTime} min read</span>
                </div>
                <div className="flex items-center gap-2">
                  <EyeIcon className="w-4 h-4" />
                  <span>{blog.views} views</span>
                </div>
                <Button
                  size="sm"
                  variant="flat"
                  isIconOnly
                  onPress={handleShare}
                >
                  <ShareIcon className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Blog Content */}
        <Card className="mb-8">
          <CardBody className="p-8 md:p-12">
            <div className="prose prose-lg dark:prose-invert max-w-none">
              {/* Simple content rendering - for Markdown, use a library like react-markdown */}
              <div className="whitespace-pre-wrap">{blog.content}</div>
            </div>
          </CardBody>
        </Card>

        {/* Tags */}
        <Card className="mb-8">
          <CardBody className="p-6">
            <h3 className="font-semibold mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {blog.tags.map((tag, index) => (
                <Chip key={index} variant="flat" color="primary">
                  #{tag}
                </Chip>
              ))}
            </div>
          </CardBody>
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
                  <CardBody className="p-0">
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
                  </CardBody>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}