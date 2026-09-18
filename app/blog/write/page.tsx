// app/blog/write/page.tsx
"use client";

import { useState, useEffect, useRef, type ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import { blogCategories, generateSlug, calculateReadTime } from "@/lib/blog-format";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import type { ExtendedUser } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeftIcon, SendIcon, ImageIcon } from "lucide-react";
import { Button, Card, CardContent, CardHeader, Input, Label, ListBox, Select, TextArea } from "@heroui/react";

export default function WriteBlogPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const user = authUser as unknown as ExtendedUser | null;
  const { hasCapability, loading: permLoading } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "",
    tags: "",
  });

  useEffect(() => {
    if (permLoading) return;
    if (!user) {
      toast.error("Please login to write a blog");
      router.push("/login");
      return;
    }
    // The server gates POST /api/blogs and /api/blogs/image with
    // requireCapability("blog.create"). Checking the legacy permission
    // vocabulary here resolved to admin-only, so everyone else was bounced
    // from the editor even though the server would have accepted the post.
    if (!hasCapability("blog.create")) {
      toast.error("You don't have permission to create blogs");
      router.push("/unauthorized");
    }
  }, [user, permLoading, hasCapability, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      // The browser cannot write to the blog-images bucket, so the file is
      // validated and stored by the server, which also enforces the
      // `blog.create` capability.
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/blogs/image", { method: "POST", body });
      const payload = await response.json().catch(() => null) as { url?: string; error?: string } | null;
      if (!response.ok || !payload?.url) {
        throw new Error(readApiError(payload, "Failed to upload image"));
      }
      // Functional update: the user may keep typing while the upload is in
      // flight, and a stale formData spread would clobber those edits.
      const coverUrl = payload.url;
      setFormData((prev) => ({ ...prev, coverImage: coverUrl }));
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error(getErrorMessage(error) || "Failed to upload image");
    } finally {
      setUploadingImage(false);
      // Reset the picker so choosing the SAME file again fires onChange.
      // Without this, a re-upload after a failed attempt is silently dead.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      toast.error("Please login to submit a blog");
      router.push("/login");
      return;
    }

    // Validation
    if (!formData.title || !formData.content || !formData.category) {
      toast.error("Please fill in all required fields");
      return;
    }

    // The server caps excerpts at 500 characters — catch it here with the
    // field in view instead of a generic 400 toast after submit.
    if (formData.excerpt.length > 500) {
      toast.error(`Excerpt is ${formData.excerpt.length}/500 characters — please shorten it`);
      return;
    }

    if (!formData.coverImage) {
      toast.error("Please add a cover image");
      return;
    }

    setSubmitting(true);

    try {
      const slug = generateSlug(formData.title);
      const readTime = calculateReadTime(formData.content);
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      const response = await fetch("/api/blogs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: formData.title,
          slug,
          excerpt: formData.excerpt || formData.content.substring(0, 150),
          content: formData.content,
          coverImage: formData.coverImage,
          category: formData.category,
          tags,
          readTime,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(readApiError(data, "Failed to submit blog"));
      }

      toast.success(
        "Blog submitted successfully! It will be reviewed by our team before publishing."
      );
      router.push("/blog");
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error submitting blog:", message);
      toast.error(message || "Failed to submit blog");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-4xl text-center" role="status" aria-label="Redirecting to login">
        <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-default-500 mt-4">Sign in required — taking you to login...</p>
      </div>
    );
  }

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/blog");
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
          className="mb-4"
          onPress={goBack}
        >
          Back
        </Button>
        <h1 className="text-4xl font-bold mb-2">Write a Blog</h1>
        <p className="text-default-600">
          Share your knowledge and insights with the community
        </p>
      </div>

      {/* Form */}
      <Card className="border-none shadow-xl">
        <CardHeader className="bg-muted">
          <h2 className="text-xl font-bold">Blog Details</h2>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="blog-title" className="text-sm font-medium mb-1 block">
                Title <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <Input
                id="blog-title"
                placeholder="Enter an engaging title..."
                value={formData.title}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
              />
            </div>

            {/* Excerpt */}
            <div>
              <label htmlFor="blog-excerpt" className="text-sm font-medium mb-1 block">
                Excerpt
              </label>
              <TextArea
                id="blog-excerpt"
                placeholder="Brief summary of your blog..."
                value={formData.excerpt}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, excerpt: e.target.value })
                }
                rows={3}
                maxLength={500}
              />
              <p className="text-xs text-default-400 mt-1" aria-live="polite">
                {formData.excerpt.length}/500
              </p>
            </div>

            {/* Category */}
            <div>
              <Select
                fullWidth
                placeholder="Select a category"
                value={formData.category === "" ? null : formData.category}
                onChange={(value) =>
                  setFormData({ ...formData, category: String(value ?? "") })
                }
              >
                <Label>Category <span className="text-danger" aria-hidden="true">*</span></Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
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

            {/* Tags */}
            <div>
              <label htmlFor="blog-tags" className="text-sm font-medium mb-1 block">
                Tags
              </label>
              <Input
                id="blog-tags"
                placeholder="react, javascript, tutorial (comma separated)"
                value={formData.tags}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setFormData({ ...formData, tags: e.target.value })
                }
              />
            </div>

            {/* Cover Image */}
            <div className="space-y-4">
              <label className="text-sm font-medium">
                Cover Image <span className="text-danger">*</span>
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Upload Button */}
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="sr-only"
                    id="cover-image-upload"
                    title="Upload cover image"
                    aria-label="Upload cover image"
                    placeholder="Upload cover image"
                  />
                  <Button
                    type="button"
                    variant="primary"
                    isPending={uploadingImage}
                    className="w-full"
                    onPress={() =>
                      document.getElementById("cover-image-upload")?.click()
                    }
                  >
                    {uploadingImage ? "Uploading..." : "Upload Image"}
                  </Button>
                  <p className="text-xs text-default-500 mt-2">
                    Max 5MB (JPG, PNG, WebP)
                  </p>
                </div>

                {/* Or URL Input */}
                <Input
                  placeholder="Or paste image URL"
                  value={formData.coverImage}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setFormData({ ...formData, coverImage: e.target.value })
                  }
                />
              </div>

              {/* Image Preview */}
              {formData.coverImage && (
                <div className="border-2 border-dashed border-default-300 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  <img
                    key={formData.coverImage}
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-48 object-cover rounded-lg"
                    onError={(e) => {
                      // A transient preview failure (hotlink block, flaky
                      // network) must not wipe a valid URL and force a
                      // re-upload. Hide this render; editing the URL remounts
                      // via key and retries.
                      e.currentTarget.style.display = "none";
                      toast.error("Cover preview failed to load — the URL is kept. Open it in a new tab to check.");
                    }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <div>
              <label htmlFor="blog-content" className="text-sm font-medium mb-1 block">
                Content <span className="text-danger" aria-hidden="true">*</span>
              </label>
              <TextArea
                id="blog-content"
                placeholder="Write your blog content here... (Markdown supported)"
                value={formData.content}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                required
                rows={15}
              />
            </div>

            {/* Word Count */}
            <div className="text-sm text-default-500">
              {formData.content.split(/\s+/).filter((w) => w).length} words •{" "}
              {calculateReadTime(formData.content)} min read
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                type="button"
                variant="ghost"
                className="flex-1"
                onPress={() => router.push("/blog")}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                isPending={submitting}
                className="flex-1"
              >
                Submit for Review
              </Button>
            </div>

            {/* Info */}
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <p className="text-sm">
                <strong>Note:</strong> Your blog will be reviewed by our team
                before being published. You&apos;ll be notified once it&apos;s approved!
              </p>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}