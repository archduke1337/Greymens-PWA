// app/blog/write/page.tsx
"use client";

import type { ExtendedUser } from "@/lib/types";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  Alert,
  Button,
  Card,
  CardContent,
  CardHeader,
  Description,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
  TextField,
} from "@heroui/react";

import {
  blogCategories,
  generateSlug,
  calculateReadTime,
} from "@/lib/blog-format";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";
import { storage, ID } from "@/lib/appwrite";

export default function WriteBlogPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("edit");
  const { user: authUser } = useAuth();
  const user = authUser as unknown as ExtendedUser | null;
  const { hasCapability, loading: permLoading } = usePermissions();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [loadingPost, setLoadingPost] = useState(Boolean(editId));
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
    // Create mode needs blog.create. Edit mode admits any signed-in user:
    // ownership is unknowable until the post loads, and the API enforces
    // owner-or-reviewer — so denying here would lock out authors who can
    // write but hold no blog.create grant, while a stranger only ever sees
    // an empty form that redirects away ("not yours to edit").
    if (!editId && !hasCapability("blog.create")) {
      toast.error("You don't have permission to create blogs");
      router.push("/unauthorized");
    }
  }, [user, permLoading, hasCapability, router, editId]);

  // Edit mode: fetch the post (own posts first, then the review queue for
  // editors) and prefill the form. Slugs never change — links stay stable.
  useEffect(() => {
    if (!editId || permLoading || !user) return;
    let cancelled = false;
    const load = async () => {
      setLoadingPost(true);
      try {
        const fetchScope = async (scope: string) => {
          const response = await fetch(`/api/blogs?scope=${scope}`, {
            cache: "no-store",
            credentials: "include",
          });

          if (!response.ok) return [];
          const payload = (await response.json().catch(() => null)) as {
            blogs?: Array<Record<string, unknown>>;
          } | null;

          return payload?.blogs ?? [];
        };
        let found = (await fetchScope("mine")).find((b) => b.$id === editId);

        if (!found && hasCapability("blog.review")) {
          found = (await fetchScope("all")).find((b) => b.$id === editId);
        }
        if (cancelled) return;
        if (!found) {
          toast.error("Post not found, or not yours to edit");
          router.push("/blog");

          return;
        }
        setFormData({
          title: String(found.title ?? ""),
          excerpt: String(found.excerpt ?? ""),
          content: String(found.content ?? ""),
          coverImage: String(found.coverImage ?? ""),
          category: String(found.category ?? ""),
          tags: Array.isArray(found.tags)
            ? (found.tags as string[]).join(", ")
            : "",
        });
        setEditSlug(typeof found.slug === "string" ? found.slug : null);
        setIsEditing(true);
      } catch (error) {
        if (!cancelled) {
          logError("Error loading post for edit:", error);
          toast.error("Could not load that post for editing");
          router.push("/blog");
        }
      } finally {
        if (!cancelled) setLoadingPost(false);
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [editId, permLoading, user]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (!file) return;

    // Validate file type — mirror the server allowlist (not any image/*).
    const okTypes = new Set([
      "image/jpeg",
      "image/png",
      "image/gif",
      "image/webp",
    ]);

    if (!okTypes.has(file.type)) {
      toast.error("Please select a JPG, PNG, GIF, or WebP image");

      return;
    }

    // Validate file size (max 10MB — matches /api/blogs/image and the bucket)
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image size must be less than 10MB");

      return;
    }

    setUploadingImage(true);
    try {
      // Direct browser → Storage bypasses Vercel 4.5 MB proxy limit for images.
      // Falls back to FormData proxy if bucket perms haven't been reconciled.
      let directFileId: string | null = null;
      try {
        const uploaded = await storage.createFile({
          bucketId: "blog-images",
          fileId: ID.unique(),
          file,
        });
        directFileId = uploaded.$id;
      } catch (directError) {
        logError("Direct blog image upload failed, falling back to proxy:", directError);
        if (file.size > 4.5 * 1024 * 1024) {
          toast.error("Direct upload failed — bucket permissions need reconciling. Run `node scripts/setup-appwrite.js` and redeploy.");
          setUploadingImage(false);
          if (fileInputRef.current) fileInputRef.current.value = "";
          return;
        }
      }

      const response = directFileId
        ? await fetch("/api/blogs/image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ fileId: directFileId }),
          })
        : await fetch("/api/blogs/image", {
            method: "POST",
            credentials: "include",
            body: (() => {
              const body = new FormData();
              body.set("file", file);
              return body;
            })(),
          });
      const payload = (await response.json().catch(() => null)) as {
        url?: string;
        error?: string;
      } | null;

      if (!response.ok || !payload?.url) {
        throw new Error(readApiError(payload, "Failed to upload image"));
      }
      // Functional update: the user may keep typing while the upload is in
      // flight, and a stale formData spread would clobber those edits.
      const coverUrl = payload.url;

      setFormData((prev) => ({ ...prev, coverImage: coverUrl }));
      toast.success("Image uploaded successfully!");
    } catch (error) {
      logError("Error uploading image:", error);
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
      toast.error(
        `Excerpt is ${formData.excerpt.length}/500 characters — please shorten it`,
      );

      return;
    }

    if (!formData.coverImage) {
      toast.error("Please add a cover image");

      return;
    }

    setSubmitting(true);

    try {
      const tags = formData.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter((tag) => tag);

      // Edit mode revises in place (slug stable) instead of filing anew.
      if (isEditing && editId) {
        const response = await fetch("/api/blogs", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            action: "edit",
            blogId: editId,
            title: formData.title,
            excerpt: formData.excerpt,
            content: formData.content,
            coverImage: formData.coverImage,
            category: formData.category,
            tags,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: unknown;
          resetToPending?: boolean;
        } | null;

        if (!response.ok) {
          throw new Error(readApiError(payload, "Failed to save the edit"));
        }
        toast.success(
          payload?.resetToPending
            ? "Saved — a live post goes back for review after an author edit."
            : "Post updated.",
        );
        router.push(editSlug ? `/blog/${editSlug}` : "/blog");

        return;
      }

      const slug = generateSlug(formData.title);
      const readTime = calculateReadTime(formData.content);

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
        "Blog submitted successfully! It will be reviewed by our team before publishing.",
      );
      router.push("/blog");
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error submitting blog:", message);
      toast.error(message || "Failed to submit blog");
    } finally {
      setSubmitting(false);
    }
  };

  if (!user) {
    return (
      <div
        aria-label="Redirecting to login"
        className="container mx-auto px-4 py-16 max-w-4xl text-center"
        role="status"
      >
        <div className="inline-block w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-default-500 mt-4">
          Sign in required — taking you to login...
        </p>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 flex items-center gap-4">
        <Image
          alt=""
          aria-hidden="true"
          className="h-20 w-20 shrink-0 rounded-3xl border border-default-200/70 object-cover"
          height={160}
          loading="lazy"
          src="/Assets/Media/throwing-paper.gif"
          width={160}
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            {isEditing ? "Edit post" : "Write a post"}
          </h1>
          <p className="mt-1 text-[15px] text-muted">
            {isEditing
              ? "Revisions keep the same link. Editing a live post sends it back for review."
              : "Think it through, write it plainly. The editorial board handles the rest."}
          </p>
        </div>
      </div>

      {/* Form */}
      {editId && loadingPost && !isEditing ? (
        <Card>
          <CardContent aria-label="Loading post" className="space-y-3 p-8">
            <div className="h-6 w-1/2 animate-pulse rounded-full bg-surface-secondary" />
            <div className="h-3.5 w-full animate-pulse rounded-full bg-surface-secondary" />
            <div className="h-3.5 w-2/3 animate-pulse rounded-full bg-surface-secondary" />
          </CardContent>
        </Card>
      ) : (
        <Card className="border-none shadow-xl">
          <CardHeader className="bg-muted">
            <h2 className="text-xl font-bold">Blog Details</h2>
          </CardHeader>
          <CardContent className="p-8">
            <Form
              className="space-y-6"
              validationBehavior="aria"
              onSubmit={handleSubmit}
            >
              {/* Title */}
              <TextField
                isRequired
                isDisabled={submitting}
                name="title"
                validate={(value) => {
                  const trimmed = value.trim();

                  if (!trimmed) return "Give the post a title";
                  if (trimmed.length > 255)
                    return "Keep the title under 255 characters";

                  return null;
                }}
                value={formData.title}
                onChange={(value) => setFormData({ ...formData, title: value })}
              >
                <Label>Title</Label>
                <Input
                  maxLength={255}
                  placeholder="Enter an engaging title..."
                />
                <FieldError />
              </TextField>

              {/* Excerpt */}
              <TextField
                isDisabled={submitting}
                name="excerpt"
                validate={(value) =>
                  value.length > 500
                    ? "Shorten the excerpt to 500 characters"
                    : null
                }
                value={formData.excerpt}
                onChange={(value) =>
                  setFormData({ ...formData, excerpt: value })
                }
              >
                <Label>Excerpt</Label>
                <TextArea
                  maxLength={500}
                  placeholder="Brief summary of your blog..."
                  rows={3}
                />
                <Description aria-live="polite">
                  {formData.excerpt.length}/500
                </Description>
                <FieldError />
              </TextField>

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
                  <Label>Category (required)</Label>
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
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
              </div>

              {/* Tags */}
              <TextField
                isDisabled={submitting}
                name="tags"
                value={formData.tags}
                onChange={(value) => setFormData({ ...formData, tags: value })}
              >
                <Label>Tags</Label>
                <Input placeholder="react, javascript, tutorial (comma separated)" />
                <Description>Comma-separated, up to 20.</Description>
              </TextField>

              {/* Cover Image */}
              <fieldset className="space-y-4">
                <legend className="text-sm font-medium">
                  Cover image (required)
                </legend>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Upload Button */}
                  <div>
                    <input
                      ref={fileInputRef}
                      accept="image/jpeg,image/png,image/gif,image/webp"
                      aria-label="Upload cover image"
                      className="sr-only"
                      id="cover-image-upload"
                      title="Upload cover image"
                      type="file"
                      onChange={handleImageUpload}
                    />
                    <Button
                      className="w-full"
                      isDisabled={uploadingImage || submitting}
                      isPending={uploadingImage}
                      type="button"
                      variant="primary"
                      onPress={() => fileInputRef.current?.click()}
                    >
                      {uploadingImage ? "Uploading..." : "Upload Image"}
                    </Button>
                    <p className="text-xs text-default-500 mt-2">
                      Max 5MB (JPG, PNG, WebP)
                    </p>
                  </div>

                  {/* Or URL Input */}
                  <TextField
                    isDisabled={uploadingImage || submitting}
                    name="coverImage"
                    value={formData.coverImage}
                    onChange={(value) =>
                      setFormData({ ...formData, coverImage: value })
                    }
                  >
                    <Label>Paste an image URL instead</Label>
                    <Input placeholder="Or paste image URL" />
                  </TextField>
                </div>

                {/* Image Preview */}
                {formData.coverImage && (
                  <div className="border-2 border-dashed border-default-300 rounded-lg p-4">
                    <p className="text-sm font-medium mb-2">Preview:</p>
                    <Image
                      key={formData.coverImage}
                      unoptimized
                      alt="Cover preview"
                      className="w-full h-48 object-cover rounded-lg"
                      height={192}
                      src={formData.coverImage}
                      width={896}
                      onError={(e) => {
                        // A transient preview failure (hotlink block, flaky
                        // network) must not wipe a valid URL and force a
                        // re-upload. Hide this render; editing the URL remounts
                        // via key and retries.
                        e.currentTarget.style.display = "none";
                        toast.error(
                          "Cover preview failed to load — the URL is kept. Open it in a new tab to check.",
                        );
                      }}
                    />
                  </div>
                )}
              </fieldset>

              {/* Content */}
              <TextField
                isRequired
                isDisabled={submitting}
                name="content"
                validate={(value) =>
                  value.trim() ? null : "Write the post content"
                }
                value={formData.content}
                onChange={(value) =>
                  setFormData({ ...formData, content: value })
                }
              >
                <Label>Content</Label>
                <TextArea
                  placeholder="Write your blog content here... Markdown works: # headings, **bold**, lists, code, tables"
                  rows={15}
                />
                <Description>
                  {formData.content.split(/\s+/).filter((w) => w).length} words
                  • {calculateReadTime(formData.content)} min read
                </Description>
                <FieldError />
              </TextField>

              {/* Submit Button */}
              <div className="flex gap-4 pt-4">
                <Button
                  className="flex-1"
                  type="button"
                  variant="ghost"
                  onPress={() => router.push("/blog")}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  isDisabled={submitting || loadingPost}
                  isPending={submitting}
                  type="submit"
                >
                  {isEditing ? "Save edit" : "Submit for Review"}
                </Button>
              </div>

              {/* Info */}
              <Alert status="accent">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>
                    {isEditing
                      ? "Edits keep the same link"
                      : "Reviewed before publishing"}
                  </Alert.Title>
                  <Alert.Description>
                    {isEditing
                      ? "Author edits to a live post return it to the review queue; reviewer touch-ups keep it live."
                      : "Our team reviews every post. You'll be notified once it's approved."}
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            </Form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
