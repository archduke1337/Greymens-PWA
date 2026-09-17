// app/blog/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { title, subtitle } from "@/components/primitives";
import { blogService } from "@/lib/blog";
import type { Blog } from "@/lib/blog";
import { blogCategories } from "@/lib/blog-format";
import { useAuth } from "@/context/AuthContext";
import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent, CardFooter, Chip, Input, Label, ListBox, Select} from "@heroui/react";
import {
  SearchIcon, 
  PenIcon, 
  ClockIcon, 
  EyeIcon, 
  HeartIcon,
  SparklesIcon,
  CalendarIcon
} from "lucide-react";

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
      console.error("Error loading blogs:", error);
      setError(error instanceof Error ? error.message : "Unable to load blogs");
    } finally {
      setLoading(false);
    }
  };

  const filterBlogs = () => {
    let filtered = blogs;

    // Filter by category
    if (selectedCategory !== "all") {
      filtered = filtered.filter((blog) => blog.category === selectedCategory);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        (blog) =>
          blog.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          blog.excerpt.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (blog.tags ?? []).some((tag) =>
            tag.toLowerCase().includes(searchQuery.toLowerCase())
          )
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
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-default-500">Loading blogs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-12 pb-20">
      {/* Hero Section */}
      <div className="text-center space-y-6 relative py-12">

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted border border-border mb-6">
          <SparklesIcon className="w-5 h-5 text-primary" />
          <span className="text-sm font-semibold tracking-tight text-foreground">
            Latest Articles
          </span>
        </div>

        <div className="relative z-10">
          <h1 className={title({ size: "lg" })}>
            Our{" "}
            <span className={title({ color: "violet", size: "lg" })}>
              Blog
            </span>
          </h1>
          <p className={subtitle({ class: "mt-6 max-w-3xl mx-auto text-xl" })}>
            Insights, tutorials, and stories from our community
          </p>
        </div>

        {/* Write Blog Button */}
        {user && (
          <Button
            size="lg"
            className="mt-4"
            onPress={() => router.push("/blog/write")}
          >
            Write a Blog
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="max-w-7xl mx-auto px-6">
        <Card className="border-none shadow-lg bg-white/60 dark:bg-gray-900/60 backdrop-blur-xl">
          <CardContent className="p-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <label htmlFor="blog-search" className="sr-only">
                Search blogs
              </label>
              <Input
                id="blog-search"
                placeholder="Search blogs..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
                className="flex-1"
              />
              <Select
                className="min-w-[200px]"
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
                    <ListBox.Item id="all" textValue="All Categories">
                      All Categories
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                    {blogCategories.map((cat) => (
                      <ListBox.Item key={cat.value} id={cat.value} textValue={cat.label}>
                        {cat.label}
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blog Grid */}
      <div className="max-w-7xl mx-auto px-6">
        {error ? (
          <Card>
            <CardContent className="text-center py-16 space-y-4">
              <h3 className="text-xl font-semibold">Blogs could not be loaded</h3>
              <p className="text-default-500 max-w-md mx-auto">{error}</p>
              <Button onPress={loadBlogs}>
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : filteredBlogs.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4" aria-hidden="true">📝</div>
            <h3 className="text-xl font-semibold mb-2">No blogs found</h3>
            <p className="text-default-500 mb-6">
              {user
                ? "Be the first to write a blog!"
                : "Check back later for new content"}
            </p>
            {user && (
              <Button onPress={() => router.push("/blog/write")}>
                <PenIcon className="w-5 h-5" />
                Write a Blog
              </Button>
            )}
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredBlogs.map((blog) => (
              // Real link, not a div with a key handler: natively keyboard
              // operable, announces as a link, supports open-in-new-tab.
              <Link
                key={blog.$id}
                href={`/blog/${blog.slug}`}
                className="group rounded-xl focus-visible:outline-2 focus-visible:outline-primary"
              >
              <Card
                className="h-full border-none hover:shadow-2xl transition-all duration-300 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl group-hover:border-primary/30"
              >
                <CardContent className="p-0">
                  {/* Cover Image */}
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={blog.coverImage}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 motion-reduce:transform-none"
                    />
                    {blog.featured && (
                      <Chip
                        
                        size="sm"
                        className="absolute top-4 left-4"
                      >
                        Featured
                      </Chip>
                    )}
                    <Chip
                      size="sm"
                      variant="primary"
                      className="absolute top-4 right-4 bg-black/50 text-white"
                    >
                      {(blog.category || "other").replace("-", " ")}
                    </Chip>
                  </div>

                  {/* Content */}
                  <div className="p-6 space-y-4">
                    <h3 className="font-bold text-xl line-clamp-2 group-hover:text-primary transition-colors">
                      {blog.title}
                    </h3>

                    <p className="text-sm text-default-600 line-clamp-3">
                      {blog.excerpt}
                    </p>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {(blog.tags ?? []).slice(0, 3).map((tag, index) => (
                        <Chip key={index} size="sm" variant="primary">
                          #{tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="px-6 pb-6 pt-0 justify-between">
                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8"><AvatarImage src={blog.authorAvatar} alt={blog.authorName} /><AvatarFallback>{blog.authorName?.charAt(0) || 'A'}</AvatarFallback></Avatar>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {blog.authorName}
                      </span>
                      <span className="text-xs text-default-500">
                        {blog.publishedAt && formatDate(blog.publishedAt)}
                      </span>
                    </div>
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-3 text-sm text-default-500">
                    <div className="flex items-center gap-1">
                      <ClockIcon className="w-4 h-4" />
                      <span>{blog.readTime} min</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <EyeIcon className="w-4 h-4" />
                      <span>{blog.views}</span>
                    </div>
                  </div>
                </CardFooter>
              </Card>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}