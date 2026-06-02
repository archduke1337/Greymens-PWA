// app/blog/write/page.tsx
"use client";

import { Card, CardContent, CardHeader, Button, Input, TextArea, Select } from "@heroui/react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { blogService, blogCategories } from "@/lib/blog";
import { useAuth } from "@/context/AuthContext";
import { getErrorMessage } from "@/lib/errorHandler";
import type { ExtendedUser } from "@/lib/types";
import { toast } from "sonner";
import { ArrowLeftIcon, SendIcon, ImageIcon } from "lucide-react";

export default function WriteBlogPage() {
  const router = useRouter();
  const { user: authUser } = useAuth();
  const user = authUser as unknown as ExtendedUser | null;
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    coverImage: "",
    category: "",
    tags: "" });

  useEffect(() => {
    if (!user) {
      toast.error("Please login to write a blog");
      router.push("/login");
    }
  }, [user, router]);

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
      const imageUrl = await blogService.uploadBlogImage(file);
      setFormData({ ...formData, coverImage: imageUrl });
      toast.success("Image uploaded successfully!");
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
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
      toast.error("Please fill in all required fields");
      return;
    }

    if (!formData.coverImage) {
      toast.error("Please add a cover image");
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
        authorAvatar: (user as any).prefs?.avatar,
        status: "pending",
        views: 0,
        likes: 0,
        featured: false,
        readTime });

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
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8">
        <Button
          variant="ghost"
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
        </CardContent>
      </Card>
    </div>
  );
}