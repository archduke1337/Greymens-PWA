"use client";

import type { GalleryImage } from "@/lib/gallery";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
  ChevronLeft,
  ChevronRight,
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
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

const CATEGORIES = [
  { id: "all", label: "All", Icon: Palette },
  { id: "events", label: "Events", Icon: PartyPopper },
  { id: "workshops", label: "Workshops", Icon: Wrench },
  { id: "hackathons", label: "Hackathons", Icon: Code2 },
  { id: "team", label: "Team", Icon: Users },
  { id: "projects", label: "Projects", Icon: Rocket },
  { id: "other", label: "Other", Icon: Folder },
];

/**
 * Album viewer: one shared title, swipeable photos with a counter and
 * thumbnail strip. Single-photo albums render without any chrome.
 */
function PreviewCarousel({
  album,
  index,
  onIndex,
  onClose,
}: {
  album: GalleryImage[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const current = album[index] ?? album[0];
  const count = album.length;

  return (
    <Card className="border-none">
      <CardContent className="relative p-0 overflow-hidden">
        <Button
          isIconOnly
          aria-label="Close preview"
          className="absolute top-3 right-3 z-10"
          variant="secondary"
          onPress={onClose}
        >
          <XIcon aria-hidden="true" className="w-4 h-4" />
        </Button>
        <Image
          key={current.$id ?? current.imageUrl}
          unoptimized
          alt={current.title}
          className="w-full h-auto max-h-[70vh] object-contain"
          height={800}
          src={current.imageUrl}
          width={1200}
        />
        {count > 1 && (
          <>
            <Button
              isIconOnly
              aria-label="Previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2"
              variant="secondary"
              onPress={() => onIndex((index - 1 + count) % count)}
            >
              <ChevronLeft aria-hidden="true" className="w-5 h-5" />
            </Button>
            <Button
              isIconOnly
              aria-label="Next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2"
              variant="secondary"
              onPress={() => onIndex((index + 1) % count)}
            >
              <ChevronRight aria-hidden="true" className="w-5 h-5" />
            </Button>
            <span className="absolute bottom-3 right-3 rounded-full bg-black/60 px-2.5 py-1 text-xs font-medium text-white tabular-nums">
              {index + 1} / {count}
            </span>
          </>
        )}
      </CardContent>
      <CardFooter className="flex-col items-start gap-3 p-6">
        <div className="flex justify-between items-start w-full">
          <div>
            <h3 className="text-2xl font-bold">{current.title}</h3>
            {current.description && (
              <p className="text-default-600 mt-1">{current.description}</p>
            )}
          </div>
          <Chip size="lg" variant="soft">
            {CATEGORIES.find((c) => c.id === current.category)?.label}
          </Chip>
        </div>
        {current.tags && current.tags.length > 0 && (
          <div className="flex gap-2">
            {current.tags.map((tag) => (
              <Chip key={tag} color="accent" size="sm" variant="soft">
                {tag}
              </Chip>
            ))}
          </div>
        )}
        {count > 1 && (
          <div
            aria-label="Album photos"
            className="flex gap-2 overflow-x-auto w-full pb-1"
            role="tablist"
          >
            {album.map((photo, i) => (
              <button
                key={photo.$id ?? photo.imageUrl}
                aria-label={`Photo ${i + 1}`}
                aria-selected={i === index}
                className={`relative h-14 w-20 flex-shrink-0 overflow-hidden rounded-lg focus-visible:outline-2 focus-visible:outline-primary ${
                  i === index
                    ? "ring-2 ring-primary"
                    : "opacity-60 hover:opacity-100"
                }`}
                role="tab"
                type="button"
                onClick={() => onIndex(i)}
              >
                <Image
                  fill
                  unoptimized
                  alt=""
                  className="object-cover"
                  sizes="80px"
                  src={photo.imageUrl}
                />
              </button>
            ))}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}

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
  const [selectedAlbum, setSelectedAlbum] = useState<GalleryImage[] | null>(
    null,
  );
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [uploading, setUploading] = useState(false);

  // Mirrors the server: POST /api/gallery requires membership (requireMember),
  // and moderation authority is the gallery.manage capability, the same one
  // /api/admin/gallery requires.
  const canUpload = isRoleOrAbove("member");
  const canApprove = hasCapability("gallery.manage");

  // Upload form state. Files share one title/description/category/tags —
  // the server files them as an album under that shared title.
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "events" as GalleryImage["category"],
    imageUrl: "",
    tags: "",
  });
  const [uploadFiles, setUploadFiles] = useState<
    Array<{ file: File; url: string }>
  >([]);

  /** Albums: one card per shared title — rows group by albumId, legacy rows solo. */
  const albums = useMemo(() => {
    const groups = new Map<string, GalleryImage[]>();

    for (const image of images) {
      const key = image.albumId || image.$id || image.imageUrl;

      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(image);
    }

    return [...groups.values()];
  }, [images]);

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
        throw new Error(readApiError(payload, "Unable to load gallery"));
      setImages(payload.images ?? []);
    } catch (error) {
      logError("Error loading gallery:", error);
      setLoadError(getErrorMessage(error) || "Unable to load gallery");
      setImages([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, mineOnly]);

  useEffect(() => {
    loadImages();
  }, [loadImages]);

  const MAX_UPLOAD_FILES = 10;
  const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

  const addUploadFiles = (list: FileList | null) => {
    if (!list) return;
    const incoming = [...list].filter((file) => file.size > 0);

    if (uploadFiles.length + incoming.length > MAX_UPLOAD_FILES) {
      toast.error(`Upload at most ${MAX_UPLOAD_FILES} photos at once`);

      return;
    }
    const rejected = incoming.filter(
      (file) => !file.type.startsWith("image/") || file.size > MAX_UPLOAD_BYTES,
    );

    if (rejected.length > 0) {
      toast.error(
        `${rejected.length} file(s) skipped — images under 10MB only`,
      );
    }
    const accepted = incoming
      .filter(
        (file) =>
          file.type.startsWith("image/") && file.size <= MAX_UPLOAD_BYTES,
      )
      .map((file) => ({ file, url: URL.createObjectURL(file) }));

    setUploadFiles((prev) => [...prev, ...accepted]);
  };

  const removeUploadFile = (url: string) => {
    setUploadFiles((prev) => {
      const target = prev.find((entry) => entry.url === url);

      if (target) URL.revokeObjectURL(target.url);

      return prev.filter((entry) => entry.url !== url);
    });
  };

  const clearUploadFiles = () => {
    setUploadFiles((prev) => {
      for (const entry of prev) URL.revokeObjectURL(entry.url);

      return [];
    });
  };

  const handleUpload = async () => {
    if (!user) return;
    if (!uploadForm.title.trim()) {
      toast.error("Title is required");

      return;
    }

    setUploading(true);
    try {
      if (uploadFiles.length === 0 && !uploadForm.imageUrl.trim()) {
        toast.error("Please provide an image URL or upload files");

        return;
      }

      // The file and the record are both written by the server. Doing either
      // from the browser cannot work: the bucket and the gallery table are both
      // closed to client writes.
      const body = new FormData();

      body.set("title", uploadForm.title.trim());
      body.set("description", uploadForm.description);
      body.set("category", uploadForm.category);
      body.set("tags", uploadForm.tags);
      for (const entry of uploadFiles) body.append("file", entry.file);
      if (uploadFiles.length === 0)
        body.set("imageUrl", uploadForm.imageUrl.trim());

      const response = await fetch("/api/gallery", { method: "POST", body });
      const data = (await response.json().catch(() => ({}))) as {
        images?: GalleryImage[];
        error?: string;
      };

      if (!response.ok)
        throw new Error(readApiError(data, "Failed to upload image"));

      const count = data.images?.length ?? 1;

      toast.success(
        canApprove
          ? count > 1
            ? `${count} photos uploaded and published!`
            : "Image uploaded and published!"
          : count > 1
            ? `${count} photos uploaded! They will be visible after admin approval.`
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
      clearUploadFiles();
      loadImages();
    } catch (error) {
      logError("Upload error:", error);
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
            Our <span className="tracking-tight text-foreground">Gallery</span>
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
                    selectedCategory === category.id && !mineOnly
                      ? "primary"
                      : "secondary"
                  }
                  onPress={() => {
                    setSelectedCategory(category.id);
                    setMineOnly(false);
                  }}
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
        <div
          aria-label="Loading gallery"
          className="flex items-center justify-center py-20"
          role="status"
        >
          <Loader2
            aria-hidden
            className="h-8 w-8 animate-spin text-muted-foreground"
          />
        </div>
      ) : loadError ? (
        <Card>
          <CardContent className="p-12 text-center space-y-4">
            <h3 className="text-xl font-semibold">
              Couldn&apos;t load the gallery
            </h3>
            <p className="text-default-500">{loadError}</p>
            <Button variant="primary" onPress={loadImages}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : albums.length === 0 ? (
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
          {albums.map((album) => {
            const image = album[0];
            const count = album.length;

            return (
              <button
                key={image.$id}
                aria-label={`Open preview: ${image.title}${count > 1 ? ` (${count} photos)` : ""}`}
                className="group block w-full text-left rounded-xl hover:scale-[1.02] focus-visible:scale-[1.02] transition-transform duration-300 focus-visible:outline-2 focus-visible:outline-primary"
                type="button"
                onClick={() => {
                  setSelectedAlbum(album);
                  setSelectedIndex(0);
                  openPreview();
                }}
              >
                <Card className="border-none">
                  <CardContent className="p-0 overflow-hidden">
                    <div className="relative aspect-video overflow-hidden">
                      <Image
                        fill
                        unoptimized
                        alt={image.title}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
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
                      {count > 1 && (
                        <Chip
                          className="tabular-nums"
                          color="accent"
                          size="sm"
                          variant="soft"
                        >
                          {count} photos
                        </Chip>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Chip size="sm" variant="soft">
                        {CATEGORIES.find((c) => c.id === image.category)
                          ?.label || image.category}
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
            );
          })}
        </div>
      )}

      {/* Image Preview Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isPreviewOpen}
          onOpenChange={(open) => {
            if (!open) {
              closePreview();
              setSelectedAlbum(null);
              setSelectedIndex(0);
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalBody className="p-0">
                {selectedAlbum && selectedAlbum[selectedIndex] && (
                  <PreviewCarousel
                    album={selectedAlbum}
                    index={selectedIndex}
                    onClose={() => {
                      closePreview();
                      setSelectedAlbum(null);
                      setSelectedIndex(0);
                    }}
                    onIndex={setSelectedIndex}
                  />
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
            if (!open) {
              closeUpload();
              clearUploadFiles();
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalBody>
                <h2 className="text-xl font-bold">Upload photos</h2>
                <p className="text-sm text-default-500">
                  Select up to {MAX_UPLOAD_FILES} photos — they share one title
                  and appear as a single album.
                </p>
                <div className="space-y-4">
                  <div>
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="gallery-title"
                    >
                      Title{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
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
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="gallery-description"
                    >
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
                          category: String(
                            value ?? "events",
                          ) as GalleryImage["category"],
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
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="gallery-image-url"
                    >
                      Image URL{" "}
                      <span className="font-normal text-default-400">
                        (only when no photos are picked above)
                      </span>
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
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="gallery-file"
                    >
                      Photos{" "}
                      <span className="font-normal text-default-400">
                        (up to {MAX_UPLOAD_FILES}, images under 10MB each)
                      </span>
                    </label>
                    <input
                      multiple
                      accept="image/*"
                      className="w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                      id="gallery-file"
                      type="file"
                      onChange={(e) => {
                        addUploadFiles(e.target.files);
                        e.target.value = "";
                      }}
                    />
                    {uploadFiles.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs text-default-500 mb-2 tabular-nums">
                          {uploadFiles.length} photo
                          {uploadFiles.length === 1 ? "" : "s"} sharing one
                          title
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {uploadFiles.map((entry) => (
                            <div
                              key={entry.url}
                              className="relative aspect-square overflow-hidden rounded-lg border border-default-200"
                            >
                              <Image
                                fill
                                unoptimized
                                alt=""
                                className="object-cover"
                                sizes="120px"
                                src={entry.url}
                              />
                              <button
                                aria-label={`Remove ${entry.file.name}`}
                                className="absolute right-1 top-1 rounded-full bg-black/60 p-1 text-white hover:bg-black/80 focus-visible:outline-2 focus-visible:outline-primary"
                                type="button"
                                onClick={() => removeUploadFile(entry.url)}
                              >
                                <XIcon aria-hidden="true" className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div>
                    <label
                      className="text-sm font-medium mb-1 block"
                      htmlFor="gallery-tags"
                    >
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
                <Button
                  variant="ghost"
                  onPress={() => {
                    closeUpload();
                    clearUploadFiles();
                  }}
                >
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
