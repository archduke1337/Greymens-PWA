// app/blog/page.tsx
"use client";

import { Card, CardContent, CardFooter, Button, Input, Chip, Avatar } from "@heroui/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { title, subtitle } from "@/components/primitives";
import { blogService, Blog, blogCategories } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";
import {   SearchIcon, 
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

  useEffect(() => {
    loadBlogs();
  }, []);

  useEffect(() => {
    filterBlogs();
  }, [searchQuery, selectedCategory, blogs]);

  const loadBlogs = async () => {
    try {
      const publishedBlogs = await blogService.getPublishedBlogs();
      setBlogs(publishedBlogs);
      setFilteredBlogs(publishedBlogs);
    } catch (error) {
      console.error("Error loading blogs:", error);
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
          blog.tags.some((tag) =>
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
      year: "numeric" });
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
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl animate-pulse" />
        <div className="absolute top-20 right-1/4 w-96 h-96 bg-pink-500/20 rounded-full blur-3xl animate-pulse" />

        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 mb-6">
          <SparklesIcon className="w-5 h-5 text-purple-500" />
          <span className="text-sm font-semibold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
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
            variant="primary">
                          #{tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </CardContent>

                <CardFooter className="px-6 pb-6 pt-0 justify-between">
                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <Avatar
                      src={blog.authorAvatar}
                      name={blog.authorName}
                      size="sm"
                    />
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}