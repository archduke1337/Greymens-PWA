"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import { blogService, type Blog } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { Avatar, AvatarImage, AvatarFallback, Button, Card, Chip } from "@heroui/react";
import {
  ArrowLeft,
  Clock,
  Eye,
  CalendarDays,
  Tag,
  Newspaper,
  ArrowRight,
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
  const { user } = useAuth();
  const { hasCapability } = usePermissions();
  const [blog, setBlog] = useState<Blog | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = params.slug as string;

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      try {
        const data = await blogService.getBlogBySlug(slug);
        if (cancelled) return;
        if (data) {
          setBlog(data);
          void fetch("/api/blogs/views", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ blogId: data.$id }),
          }).catch(() => undefined);
          return;
        }
        // The public lookup only serves approved/published posts. An author
        // or reviewer opening a pending (or rejected) slug — e.g. the admin
        // console's View button — falls back to the privileged scopes and
        // matches by slug, so drafts are previewable instead of "missing".
        // View counts stay publication-only: previews must not inflate them.
        if (user) {
          const fetchScope = async (scope: string) => {
            const response = await fetch(`/api/blogs?scope=${scope}`, {
              cache: "no-store",
              credentials: "include",
            });
            if (!response.ok) return [];
            const payload = (await response.json().catch(() => null)) as {
              blogs?: Blog[];
            } | null;
            return payload?.blogs ?? [];
          };
          let found = (await fetchScope("mine")).find((b) => b.slug === slug);
          if (!found && hasCapability("blog.review")) {
            found = (await fetchScope("all")).find((b) => b.slug === slug);
          }
          if (cancelled) return;
          setBlog(found ?? null);
          return;
        }
        setBlog(null);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, user]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-10 sm:px-6" aria-label="Loading post">
        <div className="h-64 animate-pulse rounded-3xl bg-surface-secondary sm:h-80" />
        <div className="h-8 w-3/4 animate-pulse rounded-full bg-surface-tertiary" />
        <div className="space-y-2.5">
          {[0, 1, 2, 3, 4].map((n) => (
            <div key={n} className="h-3.5 animate-pulse rounded-full bg-surface-secondary" />
          ))}
        </div>
      </div>
    );
  }

  if (!blog) {
    return (
      <div className="mx-auto flex w-full max-w-md px-4 py-16">
        <Card className="w-full">
          <Card.Content className="space-y-3 px-6 py-12 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-secondary">
              <Newspaper className="h-7 w-7 text-muted" aria-hidden="true" />
            </span>
            <h1 className="text-xl font-bold">This post is missing</h1>
            <p className="text-sm text-muted">
              It may have been removed, or the link has a typo. The rest of the
              shelf is intact.
            </p>
            <Button className="rounded-full" onPress={() => router.push("/blog")}>
              Browse all posts
            </Button>
          </Card.Content>
        </Card>
      </div>
    );
  }

  const isPreview = blog?.status !== "approved" && blog?.status !== "published";

  return (
    <article className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onPress={() => router.push("/blog")}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All posts
        </Button>
        {(user?.$id === blog.authorId || hasCapability("blog.review")) && (
          <Link href={`/blog/write?edit=${blog.$id}`}>
            <Button variant="secondary" size="sm" className="rounded-full">
              Edit post
            </Button>
          </Link>
        )}
      </div>

      {isPreview && (
        <p
          role="status"
          className="rounded-2xl border border-default-200/70 bg-surface-secondary px-4 py-3 text-sm text-muted"
        >
          {blog.status === "pending" || blog.status === "draft"
            ? "Awaiting review — visible only to the author and editors, and not counted in views."
            : `Status: ${blog.status} — visible only to the author and editors.`}
        </p>
      )}

      {/* Cover */}
      <div className="relative overflow-hidden rounded-3xl bg-surface-secondary">
        {blog.coverImage ? (
          <img
            src={blog.coverImage}
            alt=""
            className="h-60 w-full object-cover sm:h-80"
          />
        ) : (
          <div className="flex h-48 items-center justify-center sm:h-64">
            <Newspaper className="h-12 w-12 text-muted" aria-hidden="true" />
          </div>
        )}
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/35 to-transparent"
        />
        <div className="absolute inset-x-0 bottom-0 space-y-2.5 p-5 sm:p-7">
          <div className="flex flex-wrap gap-1.5">
            <Chip size="sm" color="accent" variant="primary">
              {(blog.category || "other").replace("-", " ")}
            </Chip>
            {blog.featured && (
              <Chip size="sm" color="warning" variant="primary">
                Featured
              </Chip>
            )}
          </div>
          <h1 className="max-w-2xl text-2xl font-bold leading-tight text-white sm:text-4xl">
            {blog.title}
          </h1>
        </div>
      </div>

      {/* Byline */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2.5 text-sm text-muted">
        <span className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            <AvatarImage
              src={blog.authorAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(blog.authorName)}`}
              alt=""
            />
            <AvatarFallback>{blog.authorName?.charAt(0) || "A"}</AvatarFallback>
          </Avatar>
          <span className="font-medium text-foreground">{blog.authorName}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="h-4 w-4" aria-hidden="true" />
          {blog.publishedAt ? formatDate(blog.publishedAt) : "Draft"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-4 w-4" aria-hidden="true" />
          {blog.readTime} min read
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Eye className="h-4 w-4" aria-hidden="true" />
          {blog.views} views
        </span>
      </div>

      {(blog.tags ?? []).length > 0 && (
        <div className="flex flex-wrap gap-1.5" aria-label="Tags">
          {(blog.tags ?? []).map((tag) => (
            <Chip key={tag} size="sm" variant="soft">
              <Tag className="h-3 w-3" aria-hidden="true" />
              {tag}
            </Chip>
          ))}
        </div>
      )}

      {/* Body — real Markdown (GFM): headings, lists, code, tables. Raw
          HTML is never rendered: react-markdown escapes it by default. */}
      <Card>
        <Card.Content className="p-6 sm:p-9">
          <div className="blog-body">
            <ReactMarkdown remarkPlugins={[remarkGfm, remarkBreaks]}>{blog.content}</ReactMarkdown>
          </div>
        </Card.Content>
      </Card>

      {/* Next step */}
      <Card>
        <Card.Content className="flex flex-col items-center gap-3 p-6 text-center sm:p-8">
          <h2 className="font-bold">Keep reading</h2>
          <p className="max-w-md text-sm text-muted">
            More walkthroughs, write-ups, and project notes from members — or
            write your own and earn a byline.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <Button className="rounded-full" onPress={() => router.push("/blog")}>
              More posts
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Button>
            <Link href="/blog/write">
              <Button variant="secondary" className="rounded-full">
                Write a post
              </Button>
            </Link>
          </div>
        </Card.Content>
      </Card>
    </article>
  );
}
