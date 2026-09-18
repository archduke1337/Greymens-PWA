"use client";

import type { GalleryImage } from "@/lib/gallery";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Chip,
  Label,
  ListBox,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalBody,
  ModalDialog,
  ModalFooter,
  Input,
  Select,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import {
  Upload,
  Camera,
  ImagePlus,
  Loader2,
  Palette,
  PartyPopper,
  Wrench,
  Code2,
  Users,
  Rocket,
  Folder,
  X as XIcon,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { getErrorMessage } from "@/lib/errorHandler";

const CATEGORIES = [
  { id: "all", label: "All", Icon: Palette },
  { id: "events", label: "Events", Icon: PartyPopper },
  { id: "workshops", label: "Workshops", Icon: Wrench },
  { id: "hackathons", label: "Hackathons", Icon: Code2 },
  { id: "team", label: "Team", Icon: Users },
  { id: "projects", label: "Projects", Icon: Rocket },
  { id: "other", label: "Other", Icon: Folder },
];

export default function GalleryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { hasCapability, isRoleOrAbove } = usePermissions();
  const {
    isOpen: isUploadOpen,
    open: openUpload,
    close: closeUpload,
  } = useOverlayState();
  const {
    isOpen: isPreviewOpen,
    open: openPreview,
    close: closePreview,
  } = useOverlayState();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [uploading, setUploading] = useState(false);

  // Mirrors the server: POST /api/gallery requires membership (requireMember),
  // and moderation authority is the gallery.manage capability, the same one
  // /api/admin/gallery requires.
  const canUpload = isRoleOrAbove("member");
  const canApprove = hasCapability("gallery.manage");

  // Upload form state
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "events" as GalleryImage["category"],
    imageUrl: "",
    tags: "",
  });
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  const loadImages = useCallback(async () => {
    try {
      setLoading(true);
      setLoadError(null);
      const params = new URLSearchParams();
      if (mineOnly) params.set("scope", "mine");
      if (selectedCategory !== "all") params.set("category", selectedCategory);
      const query = params.toString() ? `?${params.toString()}` : "";
      const response = await fetch(`/api/gallery${query}`, {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        images?: GalleryImage[];
        error?: string;
      };

      if (!response.ok)
        throw new Error(payload.error || "Unable to load gallery");
      setImages(payload.images ?? []);
    } catch (error) {
      console.error("Error loading gallery:", error);
      setLoadError(getErrorMessage(error) || "Unable to load gallery");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, mineOnly]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const handleUpload = async () => {
    if (!user) return;
    if (!uploadForm.title) {
      toast.error("Title is required");

      return;
    }

    setUploading(true);
    try {
      if (!uploadFile && !uploadForm.imageUrl) {
        toast.error("Please provide an image URL or upload a file");

        return;
      }

      // The file and the record are both written by the server. Doing either
      // from the browser cannot work: the bucket and the gallery table are both
      // closed to client writes.
      const body = new FormData();

      body.set("title", uploadForm.title);
      body.set("description", uploadForm.description);
      body.set("category", uploadForm.category);
      body.set("tags", uploadForm.tags);
      if (uploadFile) body.set("file", uploadFile);
      else body.set("imageUrl", uploadForm.imageUrl);

      const response = await fetch("/api/gallery", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) throw new Error(data.error || "Failed to upload image");

      toast.success(
        canApprove
          ? "Image uploaded and published!"
          : "Image uploaded! It will be visible after admin approval.",
      );
      closeUpload();
      setUploadForm({
        title: "",
        description: "",
        category: "events",
        imageUrl: "",
        tags: "",
      });
      setUploadFile(null);
      loadImages();
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(getErrorMessage(error) || "Failed to upload image");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Hero */}
      <div className="text-center space-y-4 relative">
        <div className="relative z-10">
          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight">
            Our{" "}
            <span className="tracking-tight text-foreground">
              Gallery
            </span>
          </h1>
          <p className="mt-4 max-w-2xl mx-auto text-lg text-default-600">
            Capturing moments of innovation, collaboration, and growth
          </p>
        </div>
      </div>

      {/* Category Filter + Upload Button */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap justify-center gap-2">
              {CATEGORIES.map((category) => (
                <Button
                  key={category.id}
                  variant={
                    selectedCategory === category.id && !mineOnly ? "primary" : "secondary"
                  }
                  onPress={() => { setSelectedCategory(category.id); setMineOnly(false); }}
                >
                  <category.Icon aria-hidden className="w-4 h-4" />
                  {category.label}
                </Button>
              ))}
              {user && (
                <Button
                  variant={mineOnly ? "primary" : "secondary"}
                  onPress={() => setMineOnly((v) => !v)}
                >
                  <Camera aria-hidden className="w-4 h-4" />
                  My uploads
                </Button>
              )}
            </div>
            {canUpload && (
              <Button variant="primary" onPress={openUpload}>
                <ImagePlus aria-hidden className="w-4 h-4" />
                Upload photo
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Gallery Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20" role="status" aria-label="Loading gallery">
          <Loader2
            aria-hidden
            className="h-8 w-8 animate-spin text-muted-foreground"
          />
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <h3 className="text-xl font-semibold">Couldn&apos;t load the gallery</h3>
            <p className="text-default-500">{loadError}</p>
            <Button variant="primary" onPress={loadImages}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : images.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Camera
              aria-hidden
              className="mx-auto mb-4 h-10 w-10 text-muted-foreground"
            />
            <h3 className="text-xl font-semibold mb-2">No photos yet</h3>
            <p className="text-default-500">
              {canUpload
                ? "Be the first to upload a photo."
                : "Check back later for photos from our events."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {images.map((image) => (
            <button
              key={image.$id}
              type="button"
              aria-label={`Open preview: ${image.title}`}
              className="group block w-full text-left rounded-xl hover:scale-[1.02] focus-visible:scale-[1.02] transition-transform duration-300 focus-visible:outline-2 focus-visible:outline-primary"
              onClick={() => {
                setSelectedImage(image);
                openPreview();
              }}
            >
              <Card className="border-none">
                <CardContent className="p-0 overflow-hidden">
                  <div className="relative aspect-video overflow-hidden">
                    <img
                      alt={image.title}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      loading="lazy"
                      src={image.imageUrl}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-100 md:opacity-0 md:group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 md:translate-y-full md:group-hover:translate-y-0 group-focus-within:translate-y-0 transition-transform duration-300">
                      <p className="text-white text-sm font-medium">
                        {image.description}
                      </p>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex-col items-start gap-2 p-4">
                  <div className="flex justify-between items-center w-full gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base md:text-lg font-semibold truncate">
                        {image.title}
                      </h3>
                    </div>
                    {image.status === "pending" && (
                      <Chip size="sm" variant="soft">
                        Pending review
                      </Chip>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <Chip size="sm" variant="soft">
                      {CATEGORIES.find((c) => c.id === image.category)?.label ||
                        image.category}
                    </Chip>
                    {image.tags?.map((tag) => (
                      <Chip key={tag} color="accent" size="sm" variant="soft">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                </CardFooter>
              </Card>
            </button>
          ))}
        </div>
      )}

      {/* Image Preview Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isPreviewOpen}
          onOpenChange={(open) => {
            if (!open) {
              closePreview();
              setSelectedImage(null);
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalBody className="p-0">
                {selectedImage && (
                  <Card className="border-none">
                    <CardContent className="relative p-0 overflow-hidden">
                      <Button
                        isIconOnly
                        variant="secondary"
                        aria-label="Close preview"
                        className="absolute top-3 right-3 z-10"
                        onPress={() => {
                          closePreview();
                          setSelectedImage(null);
                        }}
                      >
                        <XIcon className="w-4 h-4" aria-hidden="true" />
                      </Button>
                      <img
                        alt={selectedImage.title}
                        className="w-full h-auto max-h-[70vh] object-contain"
                        src={selectedImage.imageUrl}
                      />
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-3 p-6">
                      <div className="flex justify-between items-start w-full">
                        <div>
                          <h3 className="text-2xl font-bold">
                            {selectedImage.title}
                          </h3>
                          {selectedImage.description && (
                            <p className="text-default-600 mt-1">
                              {selectedImage.description}
                            </p>
                          )}
                        </div>
                        <Chip size="lg" variant="soft">
                          {
                            CATEGORIES.find(
                              (c) => c.id === selectedImage.category,
                            )?.label
                          }
                        </Chip>
                      </div>
                      {selectedImage.tags && selectedImage.tags.length > 0 && (
                        <div className="flex gap-2">
                          {selectedImage.tags.map((tag) => (
                            <Chip
                              key={tag}
                              color="accent"
                              size="sm"
                              variant="soft"
                            >
                              {tag}
                            </Chip>
                          ))}
                        </div>
                      )}
                    </CardFooter>
                  </Card>
                )}
              </ModalBody>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Upload Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isUploadOpen}
          onOpenChange={(open) => {
            if (!open) closeUpload();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalBody>
                <h2 className="text-xl font-bold">Upload photo</h2>
                <div className="space-y-4">
                  <div>
                    <label htmlFor="gallery-title" className="text-sm font-medium mb-1 block">
                      Title
                    </label>
                    <Input
                      id="gallery-title"
                      placeholder="Photo title"
                      value={uploadForm.title}
                      onChange={(e: any) =>
                        setUploadForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="gallery-description" className="text-sm font-medium mb-1 block">
                      Description
                    </label>
                    <TextArea
                      id="gallery-description"
                      placeholder="Describe this photo..."
                      rows={2}
                      value={uploadForm.description}
                      onChange={(e: any) =>
                        setUploadForm((p) => ({
                          ...p,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <Select
                      fullWidth
                      value={uploadForm.category}
                      onChange={(value) =>
                        setUploadForm((p) => ({
                          ...p,
                          category: String(value ?? "events") as GalleryImage["category"],
                        }))
                      }
                    >
                      <Label>Category</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          <ListBox.Item id="events" textValue="Events">
                            Events
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="workshops" textValue="Workshops">
                            Workshops
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="hackathons" textValue="Hackathons">
                            Hackathons
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="team" textValue="Team">
                            Team
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="projects" textValue="Projects">
                            Projects
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                          <ListBox.Item id="other" textValue="Other">
                            Other
                            <ListBox.ItemIndicator />
                          </ListBox.Item>
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>
                  <div>
                    <label htmlFor="gallery-image-url" className="text-sm font-medium mb-1 block">
                      Image URL (optional if uploading file)
                    </label>
                    <Input
                      id="gallery-image-url"
                      placeholder="https://example.com/photo.jpg"
                      value={uploadForm.imageUrl}
                      onChange={(e: any) =>
                        setUploadForm((p) => ({
                          ...p,
                          imageUrl: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="gallery-file" className="text-sm font-medium mb-1 block">
                      Or upload a file
                    </label>
                    <input
                      id="gallery-file"
                      accept="image/*"
                      className="w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                      type="file"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                  <div>
                    <label htmlFor="gallery-tags" className="text-sm font-medium mb-1 block">
                      Tags (comma separated)
                    </label>
                    <Input
                      id="gallery-tags"
                      placeholder="tech, innovation, workshop"
                      value={uploadForm.tags}
                      onChange={(e: any) =>
                        setUploadForm((p) => ({ ...p, tags: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={closeUpload}>
                  Cancel
                </Button>
                <Button
                  isPending={uploading}
                  variant="primary"
                  onPress={handleUpload}
                >
                  <Upload className="w-4 h-4" />
                  Upload
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* CTA */}
      <Card className="border-none bg-primary text-primary-foreground">
        <CardContent className="p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold mb-3">
            Want to be part of our story?
          </h2>
          <p className="text-primary-foreground/80 mb-6 max-w-2xl mx-auto">
            Join Greymens and create unforgettable memories while building
            amazing projects
          </p>
          <Button
            className="bg-white text-primary font-semibold hover:scale-105 transition-transform"
            size="lg"
            onPress={() => router.push("/register")}
          >
            Join Our Community
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
