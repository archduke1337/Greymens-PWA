// app/admin/blogs/page.tsx
"use client";

import type { Blog } from "@/lib/blog-format";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Avatar,
  AvatarImage,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  Chip,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  Tab,
  TabListContainer,
  TabList,
  TabIndicator,
  Tabs,
  TextArea,
} from "@heroui/react";
import { CheckIcon, XIcon, ClockIcon, StarIcon } from "lucide-react";

import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

export default function AdminBlogsPage() {
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [filteredBlogs, setFilteredBlogs] = useState<Blog[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTab, setSelectedTab] = useState("pending");
  const [processingBlog, setProcessingBlog] = useState<string | null>(null);

  // Rejection modal
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectingBlog, setRejectingBlog] = useState<Blog | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  useEffect(() => {
    loadBlogs();
  }, []);

  useEffect(() => {
    filterBlogsByTab();
  }, [selectedTab, blogs]);

  const loadBlogs = async () => {
    try {
      const response = await fetch("/api/blogs?scope=all", {
        cache: "no-store",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        blogs?: Blog[];
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Failed to load blogs"));
      setBlogs(payload?.blogs ?? []);
    } catch (error) {
      logError("Error loading blogs:", error);
      toast.error(getErrorMessage(error) || "Failed to load blogs");
    } finally {
      setLoading(false);
    }
  };

  /**
   * Review decisions are applied by the server, which re-checks the capability
   * each action needs and records an audit entry. The browser cannot write to the
   * blogs table, so these calls previously always failed.
   */
  const applyBlogAction = async (
    blogId: string,
    action: string,
    body: Record<string, unknown> = {},
  ) => {
    const response = await fetch("/api/blogs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blogId, action, ...body }),
    });
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    if (!response.ok)
      throw new Error(readApiError(payload, "The change could not be applied"));
  };

  const filterBlogsByTab = () => {
    let filtered = blogs;

    switch (selectedTab) {
      case "pending":
        filtered = blogs.filter((b) => b.status === "pending");
        break;
      case "approved":
        filtered = blogs.filter((b) => b.status === "approved");
        break;
      case "rejected":
        filtered = blogs.filter((b) => b.status === "rejected");
        break;
      default:
        filtered = blogs;
    }

    setFilteredBlogs(filtered);
  };

  const handleApprove = async (blogId: string) => {
    if (
      !confirm("Approve this post? It becomes publicly readable immediately.")
    )
      return;
    setProcessingBlog(blogId);
    try {
      await applyBlogAction(blogId, "approve");
      toast.success("Post published");
      await loadBlogs();
    } catch (error) {
      logError("Error approving blog:", error);
      toast.error(getErrorMessage(error) || "Failed to approve blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const openRejectModal = (blog: Blog) => {
    setRejectingBlog(blog);
    setRejectionReason("");
    setRejectModalOpen(true);
  };

  const handleReject = async () => {
    if (!rejectingBlog) return;
    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");

      return;
    }

    setProcessingBlog(rejectingBlog.$id!);
    try {
      await applyBlogAction(rejectingBlog.$id!, "reject", {
        reason: rejectionReason.trim(),
      });
      toast.success("Post rejected", {
        description: "The reason is visible to the author.",
      });
      await loadBlogs();
      setRejectModalOpen(false);
    } catch (error) {
      logError("Error rejecting blog:", error);
      toast.error(getErrorMessage(error) || "Failed to reject blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const handleDelete = async (blogId: string) => {
    if (!confirm("Permanently delete this post? This cannot be undone."))
      return;
    setProcessingBlog(blogId);
    try {
      const response = await fetch(
        `/api/blogs?blogId=${encodeURIComponent(blogId)}`,
        { method: "DELETE" },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Failed to delete blog"));
      toast.success("Post deleted");
      await loadBlogs();
    } catch (error) {
      logError("Error deleting blog:", error);
      toast.error(getErrorMessage(error) || "Failed to delete blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const toggleFeatured = async (blog: Blog) => {
    if (!blog.$id) return;
    setProcessingBlog(blog.$id);
    try {
      await applyBlogAction(blog.$id, blog.featured ? "unfeature" : "feature");
      toast.success(blog.featured ? "Post unfeatured" : "Post featured");
      await loadBlogs();
    } catch (error) {
      logError("Error toggling featured:", error);
      toast.error(getErrorMessage(error) || "Failed to update blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading blogs"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner size="lg" />
          <p className="text-default-500">Loading blogs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Blog Management</h1>
        <p className="text-default-600 mt-2">
          Review and manage blog submissions
        </p>
      </div>

      {/* Tabs */}
      <Tabs
        className="mb-8"
        selectedKey={selectedTab}
        onSelectionChange={(key: any) => setSelectedTab(key as string)}
      >
        <TabListContainer>
          <TabList>
            <Tab id="pending">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span className="tabular-nums">
                  Pending ({blogs.filter((b) => b.status === "pending").length})
                </span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="approved">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4" />
                <span className="tabular-nums">
                  Approved (
                  {blogs.filter((b) => b.status === "approved").length})
                </span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="rejected">
              <div className="flex items-center gap-2">
                <XIcon className="w-4 h-4" />
                <span className="tabular-nums">
                  Rejected (
                  {blogs.filter((b) => b.status === "rejected").length})
                </span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="all">
              <span className="tabular-nums">All ({blogs.length})</span>
              <TabIndicator />
            </Tab>
          </TabList>
        </TabListContainer>
      </Tabs>

      {/* Blog List */}
      <div className="space-y-6">
        {filteredBlogs.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12 space-y-2">
              <p className="text-lg text-default-600">
                {blogs.length === 0
                  ? "No blog posts exist yet"
                  : "No blogs in this category"}
              </p>
              {blogs.length === 0 && (
                <p className="text-sm text-default-500">
                  New submissions from /blog/write appear here for review.
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          filteredBlogs.map((blog) => (
            <Card key={blog.$id} className="border-2">
              <CardContent className="p-6">
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Cover Image */}
                  <div className="md:col-span-3">
                    <Image
                      unoptimized
                      alt={blog.title}
                      className="w-full h-32 object-cover rounded-lg"
                      height={128}
                      src={blog.coverImage}
                      width={480}
                    />
                  </div>

                  {/* Content */}
                  <div className="md:col-span-6 space-y-3">
                    {/* Title & Status */}
                    <div className="flex items-start justify-between gap-4">
                      <h3 className="font-bold text-xl flex-1">{blog.title}</h3>
                      <Chip
                        color={
                          blog.status === "approved"
                            ? "success"
                            : blog.status === "rejected"
                              ? "danger"
                              : "warning"
                        }
                        variant="primary"
                      >
                        {blog.status}
                      </Chip>
                    </div>

                    {/* Excerpt */}
                    <p className="text-sm text-default-600 line-clamp-2">
                      {blog.excerpt}
                    </p>

                    {/* Meta */}
                    <div className="flex items-center gap-4 text-sm text-default-500">
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          <AvatarImage
                            alt={blog.authorName}
                            src={blog.authorAvatar}
                          />
                          <AvatarFallback>
                            {blog.authorName
                              ?.split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()
                              .slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{blog.authorName}</span>
                      </div>
                      <div>•</div>
                      <div>{blog.category}</div>
                      <div>•</div>
                      <div className="tabular-nums">
                        {blog.readTime} min read
                      </div>
                      {blog.featured && (
                        <>
                          <div>•</div>
                          <Chip size="sm">
                            <StarIcon className="w-3 h-3" /> Featured
                          </Chip>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {(blog.tags ?? []).map((tag, i) => (
                        <Chip key={i} size="sm" variant="primary">
                          #{tag}
                        </Chip>
                      ))}
                    </div>

                    {/* Rejection Reason */}
                    {blog.status === "rejected" && blog.rejectionReason && (
                      <div className="bg-danger/10 border border-danger/20 rounded-lg p-3">
                        <p className="text-sm font-semibold text-danger">
                          Rejection Reason:
                        </p>
                        <p className="text-sm text-default-600">
                          {blog.rejectionReason}
                        </p>
                      </div>
                    )}

                    {/* Dates */}
                    <div className="text-xs text-default-400">
                      Submitted:{" "}
                      {blog.$createdAt && formatDate(blog.$createdAt)}
                      {blog.publishedAt &&
                        ` • Published: ${formatDate(blog.publishedAt)}`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-3 flex md:flex-col gap-2">
                    <a
                      className="flex-1 md:flex-none"
                      href={`/blog/${blog.slug}`}
                      target="_blank"
                    >
                      <Button size="sm" variant="primary">
                        View
                      </Button>
                    </a>

                    <a
                      className="flex-1 md:flex-none"
                      href={`/blog/write?edit=${blog.$id}`}
                    >
                      <Button size="sm" variant="secondary">
                        Edit
                      </Button>
                    </a>

                    {blog.status === "pending" && (
                      <>
                        <Button
                          className="flex-1 md:flex-none"
                          isPending={processingBlog === blog.$id}
                          size="sm"
                          variant="primary"
                          onPress={() => handleApprove(blog.$id!)}
                        >
                          Approve
                        </Button>
                        <Button
                          className="flex-1 md:flex-none"
                          size="sm"
                          variant="secondary"
                          onPress={() => openRejectModal(blog)}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {blog.status === "approved" && (
                      <Button
                        className="flex-1 md:flex-none"
                        isPending={processingBlog === blog.$id}
                        size="sm"
                        variant="primary"
                        onPress={() => toggleFeatured(blog)}
                      >
                        {blog.featured ? "Unfeature" : "Feature"}
                      </Button>
                    )}

                    <Button
                      className="flex-1 md:flex-none"
                      isPending={processingBlog === blog.$id}
                      size="sm"
                      variant="danger-soft"
                      onPress={() => handleDelete(blog.$id!)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Rejection Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={rejectModalOpen}
          onOpenChange={(open: boolean) => setRejectModalOpen(open)}
        >
          <ModalContainer>
            <ModalDialog>
              {() => (
                <>
                  <ModalHeader>Reject Blog</ModalHeader>
                  <ModalBody>
                    <p className="mb-4">
                      Please provide a reason for rejecting this blog:
                    </p>
                    <TextArea
                      placeholder="E.g., Content doesn't meet quality standards, inappropriate content, etc."
                      rows={4}
                      value={rejectionReason}
                      onChange={(e: any) => setRejectionReason(e.target.value)}
                    />
                  </ModalBody>
                  <ModalFooter>
                    <Button
                      variant="secondary"
                      onPress={() => setRejectModalOpen(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      isPending={processingBlog === rejectingBlog?.$id}
                      variant="danger-soft"
                      onPress={handleReject}
                    >
                      Reject Blog
                    </Button>
                  </ModalFooter>
                </>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
