// app/blog/write/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { blogService, blogCategories } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";
import { ArrowLeftIcon, SendIcon, ImageIcon } from "lucide-react";

export default function WriteBlogPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "",
    tags: "",
  });

  useEffect(() => {
    if (!user) {
      alert("Please login to write a blog");
      router.push("/login");
    }
  }, [user, router]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert("Image size must be less than 5MB");
      return;
    }

    setUploadingImage(true);
    try {
      const imageUrl = await blogService.uploadBlogImage(file);
      setFormData({ ...formData, coverImage: imageUrl });
      alert("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      alert("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      alert("Please login to submit a blog");
      return;
    }

    // Validation
    if (!formData.title || !formData.content || !formData.category) {
      alert("Please fill in all required fields");
      return;
    }

    if (!formData.coverImage) {
      alert("Please add a cover image");
      return;
    }

    setSubmitting(true);

    try {
      const slug = blogService.generateSlug(formData.title);
      const readTime = blogService.calculateReadTime(formData.content);
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      await blogService.createBlog({
        title: formData.title,
        slug,
        excerpt: formData.excerpt || formData.content.substring(0, 150),
        content: formData.content,
        coverImage: formData.coverImage,
        category: formData.category,
        tags,
        authorId: user.$id,
        authorName: user.name,
        authorEmail: user.email,
        authorAvatar: user.prefs?.avatar,
        status: "pending",
        views: 0,
        likes: 0,
        featured: false,
        readTime,
      });

      alert(
        "Blog submitted successfully! It will be reviewed by our team before publishing."
      );
      router.push("/blog");
    } catch (error: any) {
      console.error("Error submitting blog:", error);
      alert(error.message || "Failed to submit blog");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="light"
          startContent={<ArrowLeftIcon className="w-4 h-4" />}
          onPress={() => router.back()}
          className="mb-4"
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
        <CardHeader className="bg-gradient-to-r from-purple-500/10 to-pink-500/10">
          <h2 className="text-xl font-bold">Blog Details</h2>
        </CardHeader>
        <CardBody className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <Input
              label="Blog Title"
              placeholder="Enter an engaging title..."
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              required
              isRequired
              size="lg"
            />

            {/* Excerpt */}
            <Textarea
              label="Excerpt (Optional)"
              placeholder="Brief summary of your blog..."
              value={formData.excerpt}
              onChange={(e) =>
                setFormData({ ...formData, excerpt: e.target.value })
              }
              rows={3}
              description="If not provided, first 150 characters will be used"
            />

            {/* Category */}
            <Select
              label="Category"
              placeholder="Select a category"
              selectedKeys={formData.category ? [formData.category] : []}
              onChange={(e) =>
                setFormData({ ...formData, category: e.target.value })
              }
              required
              isRequired
            >
              {blogCategories.map((cat) => (
                <SelectItem key={cat.value}>{cat.label}</SelectItem>
              ))}
            </Select>

            {/* Tags */}
            <Input
              label="Tags"
              placeholder="react, javascript, tutorial (comma separated)"
              value={formData.tags}
              onChange={(e) =>
                setFormData({ ...formData, tags: e.target.value })
              }
              description="Add relevant tags separated by commas"
            />

            {/* Cover Image */}
            <div className="space-y-4">
              <label className="text-sm font-medium">
                Cover Image <span className="text-danger">*</span>
              </label>

              <div className="grid md:grid-cols-2 gap-4">
                {/* Upload Button */}
                <div>
                  <input
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
                    as="label"
                    htmlFor="cover-image-upload"
                    variant="flat"
                    color="primary"
                    startContent={<ImageIcon className="w-5 h-5" />}
                    isLoading={uploadingImage}
                    className="w-full"
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
                  onChange={(e) =>
                    setFormData({ ...formData, coverImage: e.target.value })
                  }
                />
              </div>

              {/* Image Preview */}
              {formData.coverImage && (
                <div className="border-2 border-dashed border-default-300 rounded-lg p-4">
                  <p className="text-sm font-medium mb-2">Preview:</p>
                  <img
                    src={formData.coverImage}
                    alt="Cover preview"
                    className="w-full h-48 object-cover rounded-lg"
                    onError={() => {
                      alert("Invalid image URL");
                      setFormData({ ...formData, coverImage: "" });
                    }}
                  />
                </div>
              )}
            </div>

            {/* Content */}
            <Textarea
              label="Blog Content"
              placeholder="Write your blog content here... (Markdown supported)"
              value={formData.content}
              onChange={(e) =>
                setFormData({ ...formData, content: e.target.value })
              }
              required
              isRequired
              rows={15}
              description="Write in plain text or Markdown format"
            />

            {/* Word Count */}
            <div className="text-sm text-default-500">
              {formData.content.split(/\s+/).filter((w) => w).length} words •{" "}
              {blogService.calculateReadTime(formData.content)} min read
            </div>

            {/* Submit Button */}
            <div className="flex gap-4 pt-4">
              <Button
                variant="flat"
                onPress={() => router.back()}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                color="primary"
                isLoading={submitting}
                endContent={<SendIcon className="w-5 h-5" />}
                className="flex-1"
              >
                Submit for Review
              </Button>
            </div>

            {/* Info */}
            <div className="bg-primary/10 rounded-lg p-4 border border-primary/20">
              <p className="text-sm">
                <strong>Note:</strong> Your blog will be reviewed by our team
                before being published. You'll be notified once it's approved!
              </p>
            </div>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}