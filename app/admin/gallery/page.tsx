"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { galleryService, type GalleryImage } from "@/lib/gallery";
import { profileService } from "@/lib/profiles";
import { auditService } from "@/lib/audit";
import type { Profile } from "@/lib/types";
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
  useOverlayState,
} from "@heroui/react";
import {
  ImagePlus,
  CheckCircle,
  XCircle,
  Clock,
  Trash2,
  Eye,
  Search,
  Loader2,
} from "lucide-react";

type TabKey = "pending" | "approved" | "rejected";

export default function AdminGalleryPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const { isOpen, open, close } = useOverlayState();
  const [rejectTarget, setRejectTarget] = useState<GalleryImage | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [allImages, countData] = await Promise.all([
        galleryService.getAll(),
        galleryService.getCounts(),
      ]);
      setImages(allImages);
      setCounts(countData);

      const uploaders = [...new Set(allImages.map((img) => img.uploadedBy))];
      const profileResults = await Promise.all(
        uploaders.map((id) => profileService.getByUserId(id))
      );
      const profileMap: Record<string, Profile> = {};
      profileResults.forEach((p) => {
        if (p) profileMap[p.userId] = p;
      });
      setProfiles(profileMap);
    } catch (error) {
      console.error("Error loading gallery data:", error);
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
    if (!authLoading && user && (user.prefs as Record<string, unknown>)?.role !== "admin") {
      router.push("/unauthorized");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const handleApprove = async (image: GalleryImage) => {
    if (!user || !image.$id) return;
    setApprovingId(image.$id);
    try {
      await galleryService.approve(image.$id, user.$id);
      await auditService.log({
        actorId: user.$id,
        actorName: user.name || "Admin",
        actorRole: "admin",
        action: "gallery.approve",
        entityType: "gallery",
        entityId: image.$id,
        details: { title: image.title },
      });
      toast.success("Image approved");
      await loadData();
    } catch {
      toast.error("Failed to approve image");
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectTarget?.$id || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      await galleryService.reject(rejectTarget.$id, rejectReason.trim());
      await auditService.log({
        actorId: user.$id,
        actorName: user.name || "Admin",
        actorRole: "admin",
        action: "gallery.reject",
        entityType: "gallery",
        entityId: rejectTarget.$id,
        details: { title: rejectTarget.title, reason: rejectReason.trim() },
      });
      toast.success("Image rejected");
      close();
      setRejectTarget(null);
      setRejectReason("");
      await loadData();
    } catch {
      toast.error("Failed to reject image");
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async (image: GalleryImage) => {
    if (!image.$id) return;
    if (!window.confirm(`Delete "${image.title}"? This cannot be undone.`)) return;
    try {
      await galleryService.delete(image.$id);
      toast.success("Image deleted");
      await loadData();
    } catch {
      toast.error("Failed to delete image");
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
        <Loader2 className="animate-spin h-10 w-10 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
          Gallery Management
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Review, approve, and manage gallery images
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 md:mb-8">
        {[
          { label: "Pending", value: counts.pending, icon: Clock, color: "text-amber-600", bg: "bg-amber-100 dark:bg-amber-900/30" },
          { label: "Approved", value: counts.approved, icon: CheckCircle, color: "text-green-600", bg: "bg-green-100 dark:bg-green-900/30" },
          { label: "Rejected", value: counts.rejected, icon: XCircle, color: "text-red-600", bg: "bg-red-100 dark:bg-red-900/30" },
        ].map((stat) => (
          <Card key={stat.label} className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-default-500">{stat.label}</p>
                  <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                </div>
                <div className={`w-12 h-12 rounded-full ${stat.bg} flex items-center justify-center`}>
                  <stat.icon className={`w-6 h-6 ${stat.color}`} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs + Search */}
      <Card className="border-none shadow-lg mb-6">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="flex gap-2">
              {(["pending", "approved", "rejected"] as TabKey[]).map((tab) => (
                <Button
                  key={tab}
                  variant={activeTab === tab ? "primary" : "ghost"}
                  size="sm"
                  isDisabled={activeTab === tab}
                  onPress={() => setActiveTab(tab)}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  {tab === "pending" && counts.pending > 0 && (
                    <Chip size="sm" color="warning" variant="soft" className="ml-1">
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
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <ImagePlus className="w-16 h-16 text-default-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No {activeTab} images</h3>
            <p className="text-default-500">
              {activeTab === "pending" ? "All caught up!" : `No ${activeTab} images yet.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((image) => (
            <Card key={image.$id} className="border-none shadow-md overflow-hidden">
              <div className="relative aspect-video">
                <img
                  src={image.imageUrl}
                  alt={image.title}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <Chip
                  size="sm"
                  variant="soft"
                  color={
                    image.status === "approved"
                      ? "success"
                      : image.status === "rejected"
                      ? "danger"
                      : "warning"
                  }
                  className="absolute top-2 right-2"
                >
                  {image.status}
                </Chip>
              </div>
              <CardContent className="p-4 space-y-3">
                <h3 className="font-semibold truncate">{image.title}</h3>
                {image.description && (
                  <p className="text-sm text-default-500 line-clamp-2">{image.description}</p>
                )}
                <div className="flex items-center gap-2 text-xs text-default-400">
                  <span>{image.category}</span>
                  {image.uploadedBy && (
                    <>
                      <span>•</span>
                      <span>{profiles[image.uploadedBy]?.urn || image.uploadedBy.slice(0, 8)}</span>
                    </>
                  )}
                </div>
                {image.tags && image.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {image.tags.map((tag) => (
                      <Chip key={tag} size="sm" variant="soft" color="accent">
                        {tag}
                      </Chip>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="px-4 pb-4 flex gap-2">
                {image.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      variant="primary"
                      onPress={() => handleApprove(image)}
                      isPending={approvingId === image.$id}
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      onPress={() => { setRejectTarget(image); open(); }}
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </Button>
                  </>
                )}
                <Button
                  size="sm"
                  variant="danger-soft"
                  onPress={() => handleDelete(image)}
                  isIconOnly
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      <Modal>
        <ModalBackdrop isOpen={isOpen} onOpenChange={(o) => { if (!o) { close(); setRejectTarget(null); setRejectReason(""); } }}>
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Reject Image</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  Provide a reason for rejecting &quot;{rejectTarget?.title}&quot;
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">Rejection Reason</label>
                  <Input
                    placeholder="Why is this being rejected?"
                    value={rejectReason}
                    onChange={(e: any) => setRejectReason(e.target.value)}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={close}>Cancel</Button>
                <Button variant="danger" onPress={handleReject} isPending={rejecting} isDisabled={!rejectReason.trim()}>
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
