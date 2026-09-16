"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { blogService, type Blog } from "@/lib/blog";
import { Button, Card, CardContent, Chip } from "@heroui/react";
import {
  ArrowLeftIcon,
  ClockIcon,
  EyeIcon,
  CalendarIcon,
  TagIcon,
} from "lucide-react";

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

export default function BlogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = params.slug as string;

  useEffect(() => {
    if (!slug) return;
    // A slow first lookup must not overwrite a faster second one when the
    // slug changes quickly (neighbouring-post navigation).
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await blogService.getBlogBySlug(slug);
        if (cancelled) return;
        if (data) {
          setBlog(data);
          // The view counter is written by the server: the blogs table grants no
          // client write permission, and the reader should not be able to set an
          // arbitrary count. Failures here are not worth interrupting a reader.
          void fetch("/api/blogs/views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blogId: data.$id }),
          }).catch(() => undefined);
        } else {
          setBlog(null);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error loading blog:", error);
          setBlog(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4">
          <div className="inline-block w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-default-500">Loading blog...</p>
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md">
          <CardContent className="text-center py-12 space-y-4">
            <p className="text-4xl">📝</p>
            <h2 className="text-xl font-bold">Blog Not Found</h2>
            <p className="text-default-500">This blog post may have been removed or doesn&apos;t exist.</p>
            <Button variant="primary" onPress={() => router.push("/blog")}>
              Browse Blogs
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4 space-y-8">
      <Button
        variant="ghost"
        size="sm"
        onPress={() => router.push("/blog")}
        className="mb-4"
      >
        <ArrowLeftIcon className="w-4 h-4 mr-2" />
        Back to Blogs
      </Button>

      <div className="relative rounded-2xl overflow-hidden">
        <img
          src={blog.coverImage}
          alt={blog.title}
          className="w-full h-64 md:h-96 object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent" />

        <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
          <div className="flex flex-wrap gap-2 mb-3">
            <Chip className="bg-primary text-white font-bold">
              {(blog.category || "other").replace("-", " ")}
            </Chip>
            {blog.featured && (
              <Chip className="bg-yellow-500 text-white font-bold">
                Featured
              </Chip>
            )}
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white">{blog.title}</h1>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 text-sm text-default-500">
        <div className="flex items-center gap-2">
          <img
            src={blog.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.authorName)}`}
            alt={blog.authorName}
            className="w-8 h-8 rounded-full"
          />
          <span className="font-medium text-foreground">{blog.authorName}</span>
        </div>
        <div className="flex items-center gap-1">
          <CalendarIcon className="w-4 h-4" />
          <span>{blog.publishedAt ? formatDate(blog.publishedAt) : "Draft"}</span>
        </div>
        <div className="flex items-center gap-1">
          <ClockIcon className="w-4 h-4" />
          <span>{blog.readTime} min read</span>
        </div>
        <div className="flex items-center gap-1">
          <EyeIcon className="w-4 h-4" />
          <span>{blog.views} views</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(blog.tags ?? []).map((tag, index) => (
          <Chip key={index} size="sm" variant="primary">
            <TagIcon className="w-3 h-3 mr-1" />
            {tag}
          </Chip>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 md:p-8">
          <div className="prose prose-lg max-w-none dark:prose-invert">
            <div className="whitespace-pre-wrap leading-relaxed">
              {blog.content}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6 text-center space-y-4">
          <p className="text-lg font-semibold">Enjoyed this article?</p>
          <p className="text-default-500">Share it with your network</p>
          <div className="flex gap-3 justify-center">
            <Button variant="primary" onPress={() => router.push("/blog")}>
              Read More Blogs
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
