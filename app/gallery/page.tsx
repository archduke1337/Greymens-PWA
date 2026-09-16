"use client";

import type { GalleryImage } from "@/lib/gallery";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  Chip,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalBody,
  ModalDialog,
  ModalFooter,
  Input,
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
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
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
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [mineOnly, setMineOnly] = useState(false);
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [uploading, setUploading] = useState(false);

  const canUpload = hasPermission("upload_gallery");
  const canApprove = hasPermission("approve_gallery");

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
      toast.error("Failed to load gallery images");
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
        <div className="flex items-center justify-center py-20">
          <Loader2
            aria-label="Loading gallery"
            className="h-8 w-8 animate-spin text-muted-foreground"
          />
        </div>
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
            <div
              key={image.$id}
              className="cursor-pointer group hover:scale-105 transition-all duration-300"
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
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
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
            </div>
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
                    <CardContent className="p-0 overflow-hidden">
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
                    <label className="text-sm font-medium mb-1 block">
                      Title
                    </label>
                    <Input
                      placeholder="Photo title"
                      value={uploadForm.title}
                      onChange={(e: any) =>
                        setUploadForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Description
                    </label>
                    <TextArea
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
                    <label className="text-sm font-medium mb-1 block">
                      Category
                    </label>
                    <select
                      className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
                      value={uploadForm.category}
                      onChange={(e) =>
                        setUploadForm((p) => ({
                          ...p,
                          category: e.target.value as GalleryImage["category"],
                        }))
                      }
                    >
                      <option value="events">Events</option>
                      <option value="workshops">Workshops</option>
                      <option value="hackathons">Hackathons</option>
                      <option value="team">Team</option>
                      <option value="projects">Projects</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Image URL (optional if uploading file)
                    </label>
                    <Input
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
                    <label className="text-sm font-medium mb-1 block">
                      Or upload a file
                    </label>
                    <input
                      accept="image/*"
                      className="w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                      type="file"
                      onChange={(e) =>
                        setUploadFile(e.target.files?.[0] || null)
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Tags (comma separated)
                    </label>
                    <Input
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
            Join Mind Mesh and create unforgettable memories while building
            amazing projects
          </p>
          <Button
            className="bg-white text-primary font-semibold hover:scale-105 transition-transform"
            size="lg"
            onPress={() => (window.location.href = "/register")}
          >
            Join Our Community
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
