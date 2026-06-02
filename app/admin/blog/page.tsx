// app/admin/blogs/page.tsx
"use client";

import { Card, CardContent, CardHeader, Button, Chip, Avatar, Tabs, Tab, Modal, ModalDialog, ModalHeader, ModalBody, ModalFooter, TextArea } from "@heroui/react";
import { useState, useEffect } from "react";
import { blogService, Blog } from "@/lib/blog";
import { toast } from "sonner";
import {
  CheckIcon,
  XIcon,
  EyeIcon,
  TrashIcon,
  ClockIcon,
  StarIcon } from "lucide-react";

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
      toast.success("Blog approved successfully!");
      await loadBlogs();
    } catch (error) {
      console.error("Error approving blog:", error);
      toast.error("Failed to approve blog");
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
      await blogService.rejectBlog(rejectingBlog.$id!, rejectionReason);
      toast.success("Blog rejected");
      await loadBlogs();
      setRejectModalOpen(false);
    } catch (error) {
      console.error("Error rejecting blog:", error);
      toast.error("Failed to reject blog");
    } finally {
      setProcessingBlog(null);
    }
  };

  const handleDelete = async (blogId: string) => {
    if (!confirm("Permanently delete this blog? This cannot be undone.")) return;
    try {
      await blogService.deleteBlog(blogId);
      toast.success("Blog deleted successfully!");
      await loadBlogs();
    } catch (error) {
      console.error("Error deleting blog:", error);
      toast.error("Failed to delete blog");
    }
  };

  const toggleFeatured = async (blog: Blog) => {
    try {
      await blogService.updateBlog(blog.$id!, { featured: !blog.featured });
      toast.success(`Blog ${!blog.featured ? "featured" : "unfeatured"} successfully!`);
      await loadBlogs();
    } catch (error) {
      console.error("Error toggling featured:", error);
      toast.error("Failed to update blog");
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit" });
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
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600">
                No blogs in this category
              </p>
            </CardContent>
          </Card>
        ) : (
          filteredBlogs.map((blog) => (
            <Card key={blog.$id} className="border-2">
              <CardContent className="p-6">
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
                        variant="primary"
              onPress={handleReject}
              isLoading={!!processingBlog}
            >
              Reject Blog
            </Button>
          </ModalFooter>
        </ModalDialog>
      </Modal>
    </div>
  );
}