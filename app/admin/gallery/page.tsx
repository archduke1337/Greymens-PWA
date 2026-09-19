"use client";

import type { GalleryImage } from "@/lib/gallery";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Spinner,
  useOverlayState,
} from "@heroui/react";
import { ImagePlus, CheckCircle, XCircle, Clock, Trash2 } from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

type TabKey = "pending" | "approved" | "rejected";

export default function AdminGalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [counts, setCounts] = useState({
    pending: 0,
    approved: 0,
    rejected: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open, close } = useOverlayState();
  const [rejectTarget, setRejectTarget] = useState<GalleryImage | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>(
    {},
  );

  // Album sizes for the current list: multi-photo uploads review per image,
  // but the card names the shared title so siblings are recognizable.
  const albumSizes = useMemo(() => {
    const counts = new Map<string, number>();

    for (const image of images) {
      const key = image.albumId || image.$id || image.imageUrl;

      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    return counts;
  }, [images]);

  const albumSizeFor = (image: GalleryImage) =>
    albumSizes.get(image.albumId || image.$id || image.imageUrl) ?? 1;

  const loadData = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/gallery", {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        images?: GalleryImage[];
        accountNames?: Record<string, string>;
        error?: string;
      };

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load gallery"));
      const allImages = payload.images ?? [];

      setImages(allImages);
      setUploaderNames(payload.accountNames ?? {});
      setCounts({
        pending: allImages.filter((image) => image.status === "pending").length,
        approved: allImages.filter((image) => image.status === "approved")
          .length,
        rejected: allImages.filter((image) => image.status === "rejected")
          .length,
      });
    } catch (error) {
      logError("Error loading gallery data:", error);
      toast.error("Failed to load gallery data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");

      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const handleApprove = async (image: GalleryImage) => {
    if (!user || !image.$id) return;
    setApprovingId(image.$id);
    try {
      const response = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ imageId: image.$id, action: "approve" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to approve image"));
      toast.success(
        image.status === "rejected" ? "Image re-approved" : "Image approved",
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve image",
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectTarget?.$id || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const response = await fetch("/api/admin/gallery", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          imageId: rejectTarget.$id,
          action: "reject",
          reason: rejectReason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to reject image"));
      toast.success("Image rejected");
      close();
      setRejectTarget(null);
      setRejectReason("");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject image",
      );
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async (image: GalleryImage) => {
    if (!image.$id) return;
    if (!window.confirm(`Delete "${image.title}"? This cannot be undone.`))
      return;
    setDeletingId(image.$id);
    try {
      const response = await fetch(
        `/api/admin/gallery?imageId=${encodeURIComponent(image.$id)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to delete image"));
      toast.success("Image deleted");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete image",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const filtered = images.filter((img) => {
    const matchesTab = img.status === activeTab;
    const matchesSearch =
      !searchQuery ||
      img.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      img.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesSearch;
  });

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div aria-label="Loading gallery" role="status">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
          Gallery Management
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Review, approve, and manage gallery images
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        {[
          {
            label: "Pending",
            value: counts.pending,
            icon: Clock,
            color: "text-warning",
            bg: "bg-warning/10",
          },
          {
            label: "Approved",
            value: counts.approved,
            icon: CheckCircle,
            color: "text-success",
            bg: "bg-success/10",
          },
          {
            label: "Rejected",
            value: counts.rejected,
            icon: XCircle,
            color: "text-danger",
            bg: "bg-danger/10",
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-default-500">{stat.label}</p>
                  <p
                    className={`text-2xl font-bold tabular-nums ${stat.color}`}
                  >
                    {stat.value}
                  </p>
                </div>
                <div
                  className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}
                >
                  <stat.icon
                    aria-hidden="true"
                    className={`w-6 h-6 ${stat.color}`}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2">
              {(["pending", "approved", "rejected"] as TabKey[]).map((tab) => (
                <Button
                  key={tab}
                  isDisabled={activeTab === tab}
                  size="sm"
                  variant={activeTab === tab ? "primary" : "secondary"}
                  onPress={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "pending" && counts.pending > 0 && (
                    <Chip
                      className="ml-1 tabular-nums"
                      color="warning"
                      size="sm"
                      variant="soft"
                    >
                      {counts.pending}
                    </Chip>
                  )}
                </Button>
              ))}
            </div>
            <div className="w-full md:w-64">
              <Input
                placeholder="Search images..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Images Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <ImagePlus
              aria-hidden="true"
              className="w-16 h-16 text-default-300 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold mb-2">
              No {activeTab} images
            </h3>
            <p className="text-default-500">
              {activeTab === "pending"
                ? "All caught up!"
                : `No ${activeTab} images yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((image) => (
            <Card key={image.$id} className="overflow-hidden">
              <div className="relative aspect-video">
                <Image
                  fill
                  unoptimized
                  alt={image.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  src={image.imageUrl}
                />
                <Chip
                  className="absolute top-2 right-2"
                  color={
                    image.status === "approved"
                      ? "success"
                      : image.status === "rejected"
                        ? "danger"
                        : "warning"
                  }
                  size="sm"
                  variant="soft"
                >
                  {image.status}
                </Chip>
              </div>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold truncate">{image.title}</h3>
                  {albumSizeFor(image) > 1 && (
                    <Chip
                      className="flex-shrink-0 tabular-nums"
                      color="accent"
                      size="sm"
                      title={`${albumSizeFor(image)} photos share this title`}
                      variant="soft"
                    >
                      Album · {albumSizeFor(image)}
                    </Chip>
                  )}
                </div>
                {image.description && (
                  <p className="text-sm text-default-500 line-clamp-2">
                    {image.description}
                  </p>
                )}
                <div className="flex items-center gap-2 text-xs text-default-400">
                  <span>{image.category}</span>
                  {image.uploadedBy && (
                    <>
                      <span>•</span>
                      <span>
                        By {uploaderNames[image.uploadedBy] || image.uploadedBy}
                      </span>
                    </>
                  )}
                </div>
                {image.tags && image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map((tag) => (
                      <Chip key={tag} color="accent" size="sm" variant="soft">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="px-4 pb-4 flex gap-2">
                {image.status !== "approved" && (
                  <Button
                    isPending={approvingId === image.$id}
                    size="sm"
                    variant="primary"
                    onPress={() => handleApprove(image)}
                  >
                    <CheckCircle aria-hidden="true" className="w-4 h-4" />
                    {image.status === "rejected" ? "Re-approve" : "Approve"}
                  </Button>
                )}
                {image.status === "pending" && (
                  <Button
                    size="sm"
                    variant="danger"
                    onPress={() => {
                      setRejectTarget(image);
                      open();
                    }}
                  >
                    <XCircle aria-hidden="true" className="w-4 h-4" />
                    Reject
                  </Button>
                )}
                <Button
                  isIconOnly
                  aria-label={`Delete ${image.title}`}
                  isPending={deletingId === image.$id}
                  size="sm"
                  variant="danger-soft"
                  onPress={() => handleDelete(image)}
                >
                  <Trash2 aria-hidden="true" className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(o) => {
            if (!o) {
              close();
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Reject Image</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  Provide a reason for rejecting &quot;{rejectTarget?.title}
                  &quot;
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Rejection Reason
                  </label>
                  <Input
                    placeholder="Why is this being rejected?"
                    value={rejectReason}
                    onChange={(e: any) => setRejectReason(e.target.value)}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>
                <Button
                  isDisabled={!rejectReason.trim()}
                  isPending={rejecting}
                  variant="danger"
                  onPress={handleReject}
                >
                  Reject
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
