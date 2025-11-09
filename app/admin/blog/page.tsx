// app/admin/blogs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Chip } from "@heroui/chip";
import { Avatar } from "@heroui/avatar";
import { Tabs, Tab } from "@heroui/tabs";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";
import { Textarea } from "@heroui/input";
import { blogService, Blog } from "@/lib/blog";
import {
  CheckIcon,
  XIcon,
  EyeIcon,
  TrashIcon,
  ClockIcon,
  StarIcon,
} from "lucide-react";

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
      const allBlogs = await blogService.getAllBlogs();
      setBlogs(allBlogs);
    } catch (error) {
      console.error("Error loading blogs:", error);
    } finally {
      setLoading(false);
    }
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
    if (!confirm("Approve this blog for publishing?")) return;

    setProcessingBlog(blogId);
    try {
      await blogService.approveBlog(blogId);
      alert("Blog approved successfully!");
      await loadBlogs();
    } catch (error) {
      console.error("Error approving blog:", error);
      alert("Failed to approve blog");
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
      alert("Please provide a reason for rejection");
      return;
    }

    setProcessingBlog(rejectingBlog.$id!);
    try {
      await blogService.rejectBlog(rejectingBlog.$id!, rejectionReason);
      alert("Blog rejected");
      await loadBlogs();
      setRejectModalOpen(false);
    } catch (error) {
      console.error("Error rejecting blog:", error);
      alert("Failed to reject blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const handleDelete = async (blogId: string) => {
    if (!confirm("Permanently delete this blog? This cannot be undone.")) return;

    try {
      await blogService.deleteBlog(blogId);
      alert("Blog deleted successfully!");
      await loadBlogs();
    } catch (error) {
      console.error("Error deleting blog:", error);
      alert("Failed to delete blog");
    }
  };

  const toggleFeatured = async (blog: Blog) => {
    try {
      await blogService.updateBlog(blog.$id!, { featured: !blog.featured });
      alert(`Blog ${!blog.featured ? "featured" : "unfeatured"} successfully!`);
      await loadBlogs();
    } catch (error) {
      console.error("Error toggling featured:", error);
      alert("Failed to update blog");
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading blogs...</p>
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
        selectedKey={selectedTab}
        onSelectionChange={(key) => setSelectedTab(key as string)}
        size="lg"
        className="mb-8"
      >
        <Tab
          key="pending"
          title={
            <div className="flex items-center gap-2">
              <ClockIcon className="w-4 h-4" />
              <span>Pending ({blogs.filter((b) => b.status === "pending").length})</span>
            </div>
          }
        />
        <Tab
          key="approved"
          title={
            <div className="flex items-center gap-2">
              <CheckIcon className="w-4 h-4" />
              <span>Approved ({blogs.filter((b) => b.status === "approved").length})</span>
            </div>
          }
        />
        <Tab
          key="rejected"
          title={
            <div className="flex items-center gap-2">
              <XIcon className="w-4 h-4" />
              <span>Rejected ({blogs.filter((b) => b.status === "rejected").length})</span>
            </div>
          }
        />
        <Tab
          key="all"
          title={<span>All ({blogs.length})</span>}
        />
      </Tabs>

      {/* Blog List */}
      <div className="space-y-6">
        {filteredBlogs.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <p className="text-lg text-default-600">
                No blogs in this category
              </p>
            </CardBody>
          </Card>
        ) : (
          filteredBlogs.map((blog) => (
            <Card key={blog.$id} className="border-2">
              <CardBody className="p-6">
                <div className="grid md:grid-cols-12 gap-6">
                  {/* Cover Image */}
                  <div className="md:col-span-3">
                    <img
                      src={blog.coverImage}
                      alt={blog.title}
                      className="w-full h-32 object-cover rounded-lg"
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
                        variant="flat"
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
                        <Avatar
                          src={blog.authorAvatar}
                          name={blog.authorName}
                          size="sm"
                        />
                        <span>{blog.authorName}</span>
                      </div>
                      <div>•</div>
                      <div>{blog.category}</div>
                      <div>•</div>
                      <div>{blog.readTime} min read</div>
                      {blog.featured && (
                        <>
                          <div>•</div>
                          <Chip size="sm" color="warning">
                            <StarIcon className="w-3 h-3" /> Featured
                          </Chip>
                        </>
                      )}
                    </div>

                    {/* Tags */}
                    <div className="flex flex-wrap gap-2">
                      {blog.tags.map((tag, i) => (
                        <Chip key={i} size="sm" variant="flat">
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
                      Submitted: {blog.$createdAt && formatDate(blog.$createdAt)}
                      {blog.publishedAt && ` • Published: ${formatDate(blog.publishedAt)}`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-3 flex md:flex-col gap-2">
                    <Button
                      as="a"
                      href={`/blog/${blog.slug}`}
                      target="_blank"
                      size="sm"
                      variant="flat"
                      startContent={<EyeIcon className="w-4 h-4" />}
                      className="flex-1 md:flex-none"
                    >
                      View
                    </Button>

                    {blog.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          color="success"
                          variant="flat"
                          startContent={<CheckIcon className="w-4 h-4" />}
                          onPress={() => handleApprove(blog.$id!)}
                          isLoading={processingBlog === blog.$id}
                          className="flex-1 md:flex-none"
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          color="danger"
                          variant="flat"
                          startContent={<XIcon className="w-4 h-4" />}
                          onPress={() => openRejectModal(blog)}
                          className="flex-1 md:flex-none"
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {blog.status === "approved" && (
                      <Button
                        size="sm"
                        color="warning"
                        variant="flat"
                        startContent={<StarIcon className="w-4 h-4" />}
                        onPress={() => toggleFeatured(blog)}
                        className="flex-1 md:flex-none"
                      >
                        {blog.featured ? "Unfeature" : "Feature"}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      color="danger"
                      variant="flat"
                      startContent={<TrashIcon className="w-4 h-4" />}
                      onPress={() => handleDelete(blog.$id!)}
                      className="flex-1 md:flex-none"
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              </CardBody>
            </Card>
          ))
        )}
      </div>

      {/* Rejection Modal */}
      <Modal isOpen={rejectModalOpen} onClose={() => setRejectModalOpen(false)}>
        <ModalContent>
          <ModalHeader>Reject Blog</ModalHeader>
          <ModalBody>
            <p className="mb-4">
              Please provide a reason for rejecting this blog:
            </p>
            <Textarea
              placeholder="E.g., Content doesn't meet quality standards, inappropriate content, etc."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={4}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={() => setRejectModalOpen(false)}>
              Cancel
            </Button>
            <Button
              color="danger"
              onPress={handleReject}
              isLoading={!!processingBlog}
            >
              Reject Blog
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}