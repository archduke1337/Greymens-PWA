// app/blog/page.tsx
"use client";

import type { Blog } from "@/lib/blog";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
} from "@heroui/react";
import {
  PenLine,
  Clock,
  Eye,
  Newspaper,
  Search,
  ArrowRight,
} from "lucide-react";

import { blogService } from "@/lib/blog";
import { blogCategories } from "@/lib/blog-format";
import { useAuth } from "@/context/AuthContext";
import { logError } from "@/lib/logger";

export default function BlogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadBlogs();
  }, []);

  useEffect(() => {
    filterBlogs();
  }, [searchQuery, selectedCategory, blogs]);

  const loadBlogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const publishedBlogs = await blogService.getPublishedBlogs();

      setBlogs(publishedBlogs);
      setFilteredBlogs(publishedBlogs);
    } catch (error) {
      logError("Error loading blogs:", error);
      setError(error instanceof Error ? error.message : "Unable to load blogs");
    } finally {
      setLoading(false);
    }
  };

  const filterBlogs = () => {
    let filtered = blogs;

    if (selectedCategory !== "all") {
      filtered = filtered.filter((blog) => blog.category === selectedCategory);
    }

    if (searchQuery) {
      filtered = filtered.filter(
        (blog) =>
          blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (blog.tags ?? []).some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase()),
          ),
      );
    }

    setFilteredBlogs(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
        <div
          aria-label="Loading blogs"
          className="grid gap-5 md:grid-cols-2 lg:grid-cols-3"
        >
          {[0, 1, 2, 3, 4, 5].map((n) => (
            <Card key={n}>
              <div className="h-44 animate-pulse bg-surface-secondary" />
              <Card.Content className="space-y-3 p-6">
                <div className="h-4 w-3/4 animate-pulse rounded-full bg-surface-tertiary" />
                <div className="h-3 w-full animate-pulse rounded-full bg-surface-secondary" />
                <div className="h-3 w-2/3 animate-pulse rounded-full bg-surface-secondary" />
              </Card.Content>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-10 px-4 py-10 sm:px-6">
      {/* Hero */}
      <header className="mx-auto max-w-xl space-y-3 text-center">
        <Chip size="sm" variant="soft">
          <Newspaper aria-hidden="true" className="h-3.5 w-3.5" />
          The club notebook
        </Chip>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Blog</h1>
        <p className="text-[15px] leading-relaxed text-muted">
          CTF write-ups, workshop recaps, and project notes — written by members
          who did the thing, reviewed before they go up.
        </p>
        {user ? (
          <Button
            className="rounded-full px-6"
            onPress={() => router.push("/blog/write")}
          >
            <PenLine aria-hidden="true" className="h-4 w-4" />
            Write a post
          </Button>
        ) : (
          <p className="text-sm text-muted">
            Members can publish here.{" "}
            <Link
              className="font-medium text-foreground underline underline-offset-4"
              href="/register"
            >
              Join the club
            </Link>{" "}
            to get a byline.
          </p>
        )}
      </header>

      {/* Welcome note — the first thing a reader should meet */}
      <Card>
        <Card.Content className="space-y-2.5 p-6 sm:p-7">
          <h2 className="font-bold tracking-tight">
            Welcome to the Greymens blog
          </h2>
          <div className="max-w-3xl space-y-2.5 text-sm leading-relaxed text-muted">
            <p>
              This is where members write down what they&apos;re learning —
              workshop recaps, CTF write-ups, project notes, half-formed ideas
              defended bravely. If it taught you something, it&apos;ll teach
              someone else.
            </p>
            <p>
              New here? Your first post doesn&apos;t need to be big. Explain one
              thing you figured out this month, in plain words. The editorial
              board reads everything before it goes live, and they&apos;ll help
              with the rest.
            </p>
            <p className="text-foreground">
              Write it down. Someone out there is stuck exactly where you were.
            </p>
            <p>
              And it counts: every published post is recorded as contribution
              toward Active Member standing. Writing is doing.
            </p>
          </div>
        </Card.Content>
      </Card>

      {/* Filters */}
      <Card>
        <Card.Content className="flex flex-col gap-3 p-4 sm:flex-row sm:p-5">
          <div className="relative flex-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
            />
            <label className="sr-only" htmlFor="blog-search">
              Search posts
            </label>
            <Input
              className="pl-9"
              id="blog-search"
              placeholder="Search titles, excerpts, tags…"
              value={searchQuery}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchQuery(e.target.value)
              }
            />
          </div>
          <Select
            className="sm:min-w-[220px]"
            value={selectedCategory}
            onChange={(value) => setSelectedCategory(String(value ?? "all"))}
          >
            <Label className="sr-only">Filter by category</Label>
            <Select.Trigger>
              <Select.Value />
              <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
              <ListBox>
                <ListBox.Item id="all" textValue="All categories">
                  All categories
                  <ListBox.ItemIndicator />
                </ListBox.Item>
                {blogCategories.map((cat) => (
                  <ListBox.Item
                    key={cat.value}
                    id={cat.value}
                    textValue={cat.label}
                  >
                    {cat.label}
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                ))}
              </ListBox>
            </Select.Popover>
          </Select>
        </Card.Content>
      </Card>

      {/* Grid */}
      {error ? (
        <Card>
          <Card.Content className="space-y-3 px-6 py-14 text-center">
            <Image
              alt=""
              aria-hidden="true"
              className="mx-auto h-24 w-24 rounded-3xl border border-default-200/70 object-cover"
              height={192}
              loading="lazy"
              src="/Assets/Media/try-again.webp"
              width={192}
            />
            <h2 className="text-lg font-bold">The blog shelf is unreachable</h2>
            <p className="mx-auto max-w-md text-sm text-muted">{error}</p>
            <Button
              className="rounded-full"
              variant="secondary"
              onPress={loadBlogs}
            >
              Try again
            </Button>
          </Card.Content>
        </Card>
      ) : filteredBlogs.length === 0 ? (
        <Card>
          <Card.Content className="space-y-3 px-6 py-14 text-center">
            <Image
              alt=""
              aria-hidden="true"
              className="mx-auto h-28 w-28 rounded-3xl border border-default-200/70 object-cover"
              height={224}
              loading="lazy"
              src="/Assets/Media/searching.gif"
              width={224}
            />
            <h2 className="text-lg font-bold">
              {searchQuery || selectedCategory !== "all"
                ? "Nothing matches that search"
                : "No posts yet"}
            </h2>
            <p className="mx-auto max-w-md text-sm text-muted">
              {searchQuery || selectedCategory !== "all"
                ? "Try a different keyword or category."
                : user
                  ? "Be the first to publish: a workshop recap, a CTF write-up, a project note."
                  : "Check back soon — new posts land after every major event."}
            </p>
            {user && (
              <Button
                className="rounded-full"
                onPress={() => router.push("/blog/write")}
              >
                <PenLine aria-hidden="true" className="h-4 w-4" />
                Write the first post
              </Button>
            )}
          </Card.Content>
        </Card>
      ) : (
        <>
          <p className="text-sm text-muted" role="status">
            {filteredBlogs.length}{" "}
            {filteredBlogs.length === 1 ? "post" : "posts"}
            {selectedCategory !== "all" &&
              ` in ${blogCategories.find((c) => c.value === selectedCategory)?.label ?? selectedCategory}`}
            {searchQuery && ` matching “${searchQuery}”`}
          </p>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {filteredBlogs.map((blog) => (
              <Link
                key={blog.$id}
                className="group rounded-3xl focus-visible:outline-2 focus-visible:outline-accent"
                href={`/blog/${blog.slug}`}
              >
                <Card className="h-full overflow-hidden transition-shadow duration-200 hover:shadow-lg">
                  <div className="relative h-44 overflow-hidden bg-surface-secondary">
                    {blog.coverImage ? (
                      <Image
                        fill
                        unoptimized
                        alt=""
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105 motion-reduce:transform-none"
                        loading="lazy"
                        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                        src={blog.coverImage}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center">
                        <Newspaper
                          aria-hidden="true"
                          className="h-10 w-10 text-muted"
                        />
                      </span>
                    )}
                    <div className="absolute left-3 top-3 flex gap-1.5">
                      {blog.featured && (
                        <Chip color="warning" size="sm" variant="primary">
                          Featured
                        </Chip>
                      )}
                      <Chip
                        className="bg-black/55 text-white"
                        size="sm"
                        variant="primary"
                      >
                        {(blog.category || "other").replace("-", " ")}
                      </Chip>
                    </div>
                  </div>

                  <Card.Content className="space-y-3 p-5">
                    <h2 className="line-clamp-2 font-bold leading-snug transition-colors group-hover:text-accent">
                      {blog.title}
                    </h2>
                    <p className="line-clamp-3 text-sm leading-relaxed text-muted">
                      {blog.excerpt}
                    </p>
                    {(blog.tags ?? []).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {(blog.tags ?? []).slice(0, 3).map((tag) => (
                          <Chip key={tag} size="sm" variant="soft">
                            #{tag}
                          </Chip>
                        ))}
                      </div>
                    )}
                  </Card.Content>

                  <Card.Footer className="items-center justify-between px-5 pb-5">
                    <span className="flex min-w-0 items-center gap-2">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage alt="" src={blog.authorAvatar} />
                        <AvatarFallback>
                          {blog.authorName?.charAt(0) || "A"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate text-[13px] font-medium">
                          {blog.authorName}
                        </span>
                        <span className="text-xs text-muted">
                          {blog.publishedAt
                            ? formatDate(blog.publishedAt)
                            : "Draft"}
                        </span>
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Clock aria-hidden="true" className="h-3.5 w-3.5" />
                        {blog.readTime} min
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Eye aria-hidden="true" className="h-3.5 w-3.5" />
                        {blog.views}
                      </span>
                    </span>
                  </Card.Footer>
                </Card>
              </Link>
            ))}
          </div>
        </>
      )}

      <p className="flex items-center justify-center gap-1.5 text-center text-sm text-muted">
        Want to write? Read the
        <Link
          className="inline-flex items-center gap-1 font-medium text-foreground underline underline-offset-4"
          href="/docs"
        >
          contributor guide
          <ArrowRight aria-hidden="true" className="h-3.5 w-3.5" />
        </Link>
      </p>
    </div>
  );
}
