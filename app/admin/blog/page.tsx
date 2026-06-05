// app/admin/blogs/page.tsx
"use client";

import { useState, useEffect } from "react";
import { blogService, Blog } from "@/lib/blog";
import { toast } from "sonner";
import { Avatar, AvatarImage, AvatarFallback, Button, Card, CardContent, CardHeader, Chip, Modal, ModalBackdrop, ModalContainer, ModalDialog, ModalBody, ModalFooter, ModalHeader, Tab, TabListContainer, TabList, TabIndicator, TabPanel, Tabs, TextArea } from "@heroui/react";
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
        onSelectionChange={(key: any) => setSelectedTab(key as string)}
        className="mb-8"
      >
        <TabListContainer>
          <TabList>
            <Tab id="pending">
              <div className="flex items-center gap-2">
                <ClockIcon className="w-4 h-4" />
                <span>Pending ({blogs.filter((b) => b.status === "pending").length})</span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="approved">
              <div className="flex items-center gap-2">
                <CheckIcon className="w-4 h-4" />
                <span>Approved ({blogs.filter((b) => b.status === "approved").length})</span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="rejected">
              <div className="flex items-center gap-2">
                <XIcon className="w-4 h-4" />
                <span>Rejected ({blogs.filter((b) => b.status === "rejected").length})</span>
              </div>
              <TabIndicator />
            </Tab>
            <Tab id="all">
              <span>All ({blogs.length})</span>
              <TabIndicator />
            </Tab>
          </TabList>
        </TabListContainer>
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
                          size="sm"
                        >
                          <AvatarImage src={blog.authorAvatar} alt={blog.authorName} />
                          <AvatarFallback>{blog.authorName?.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span>{blog.authorName}</span>
                      </div>
                      <div>•</div>
                      <div>{blog.category}</div>
                      <div>•</div>
                      <div>{blog.readTime} min read</div>
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
                      {blog.tags.map((tag, i) => (
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
                      Submitted: {blog.$createdAt && formatDate(blog.$createdAt)}
                      {blog.publishedAt && ` • Published: ${formatDate(blog.publishedAt)}`}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="md:col-span-3 flex md:flex-col gap-2">
                    <a
                      href={`/blog/${blog.slug}`}
                      target="_blank"
                      className="flex-1 md:flex-none"
                    >
                      <Button
                        size="sm"
                        variant="primary"
                      >
                        View
                      </Button>
                    </a>

                    {blog.status === "pending" && (
                      <>
                        <Button
                          size="sm"
                          variant="primary"
                          isPending={processingBlog === blog.$id}
                          className="flex-1 md:flex-none"
                          onPress={() => handleApprove(blog.$id!)}
                        >
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="primary"
                          className="flex-1 md:flex-none"
                          onPress={() => openRejectModal(blog)}
                        >
                          Reject
                        </Button>
                      </>
                    )}

                    {blog.status === "approved" && (
                      <Button
                        size="sm"
                        variant="primary"
                        className="flex-1 md:flex-none"
                        onPress={() => toggleFeatured(blog)}
                      >
                        {blog.featured ? "Unfeature" : "Feature"}
                      </Button>
                    )}

                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1 md:flex-none"
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
        <ModalBackdrop isOpen={rejectModalOpen} onOpenChange={(open: boolean) => setRejectModalOpen(open)}>
          <ModalContainer>
            <ModalDialog>
              {({close}: {close: () => void}) => (
                <>
                  <ModalHeader>Reject Blog</ModalHeader>
                  <ModalBody>
                    <p className="mb-4">
                      Please provide a reason for rejecting this blog:
                    </p>
                    <TextArea
                      placeholder="E.g., Content doesn't meet quality standards, inappropriate content, etc."
                      value={rejectionReason}
                      onChange={(e: any) => setRejectionReason(e.target.value)}
                      rows={4}
                    />
                  </ModalBody>
                  <ModalFooter>
                    <Button variant="primary" onPress={() => setRejectModalOpen(false)}>
                      Cancel
                    </Button>
                    <Button onPress={handleReject}
                      isPending={!!processingBlog}
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