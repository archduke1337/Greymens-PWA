// app/admin/sponsors/page.tsx
"use client";

import type { Sponsor } from "@/lib/sponsors";

import { useState, useEffect } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { EditIcon, TrashIcon, CheckIcon, XIcon } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Chip,
  Input,
  ListBox,
  Select,
  Spinner,
  Switch,
  TextArea,
} from "@heroui/react";

import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { usePermissions } from "@/context/PermissionContext";
import { logError } from "@/lib/logger";

const sponsorTiers = {
  platinum: {
    color: "from-slate-300 to-slate-400",
    label: "Platinum Partner",
    size: "large",
    maxWidth: "200px",
  },
  gold: {
    color: "from-yellow-300 to-yellow-500",
    label: "Gold Sponsor",
    size: "medium",
    maxWidth: "160px",
  },
  silver: {
    color: "from-gray-300 to-gray-400",
    label: "Silver Sponsor",
    size: "medium",
    maxWidth: "140px",
  },
  bronze: {
    color: "from-orange-400 to-orange-600",
    label: "Bronze Sponsor",
    size: "small",
    maxWidth: "120px",
  },
  partner: {
    color: "from-blue-400 to-blue-600",
    label: "Community Partner",
    size: "small",
    maxWidth: "100px",
  },
};

export default function AdminSponsorsPage() {
  const { hasCapability } = usePermissions();
  // Deciding the queue is sponsors.approve; creating, editing, and removing a
  // record is sponsors.manage. A full manager passes both.
  const canManage = hasCapability("sponsors.manage");
  const canReview = canManage || hasCapability("sponsors.approve");
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [saving, setSaving] = useState(false);

  // Review queue: member submissions arrive as `pending`; rows predating the
  // intake flow carry no status and read as approved legacy partners.
  type ReviewTab = "all" | "pending" | "approved" | "rejected";
  const [activeTab, setActiveTab] = useState<ReviewTab>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  // Bulk approve (gallery/resources parity): session-scoped selection over
  // pending rows. A real reload clears it — a decided row can never stay
  // checked — but tab switches keep it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const statusOf = (sponsor: Sponsor) => sponsor.status ?? "approved";
  const visibleSponsors = sponsors.filter(
    (sponsor) => activeTab === "all" || statusOf(sponsor) === activeTab,
  );
  const reviewCounts = {
    pending: sponsors.filter((s) => statusOf(s) === "pending").length,
    approved: sponsors.filter((s) => statusOf(s) === "approved").length,
    rejected: sponsors.filter((s) => statusOf(s) === "rejected").length,
  };

  // Form state
  const [formData, setFormData] = useState<Sponsor>({
    name: "",
    logo: "",
    website: "",
    tier: "partner",
    description: "",
    category: "",
    isActive: true,
    displayOrder: 0,
    featured: false,
    startDate: new Date().toISOString().split("T")[0],
    endDate: "",
  });

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const response = await fetch("/api/admin/sponsors", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        sponsors?: Sponsor[];
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load sponsors"));
      setSponsors(payload?.sponsors ?? []);
      // Only a real reload clears the selection: it may have decided rows.
      setSelectedIds(new Set());
    } catch (error) {
      logError("Error loading sponsors:", error);
      toast.error(getErrorMessage(error) || "Failed to load sponsors");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // The server 400s on an empty name and on non-http(s) logo/website
      // URLs — check all three here with the fields in view.
      if (!formData.name.trim()) {
        toast.error("Sponsor name is required");
        setSaving(false);

        return;
      }

      // Validate URL
      if (!formData.logo) {
        toast.error("Logo URL is required");
        setSaving(false);

        return;
      }

      if (!formData.website) {
        toast.error("Website URL is required");
        setSaving(false);

        return;
      }

      for (const [field, label] of [
        ["logo", "Logo URL"],
        ["website", "Website URL"],
      ] as const) {
        const value = formData[field].trim();

        try {
          const parsed = new URL(value);

          if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
        } catch {
          toast.error(`${label} must start with http(s)://`);
          setSaving(false);

          return;
        }
      }

      if (editingSponsor) {
        // Update existing sponsor
        const response = await fetch("/api/admin/sponsors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sponsorId: editingSponsor.$id, ...formData }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok)
          throw new Error(readApiError(payload, "Unable to update sponsor"));
        toast.success("Sponsor updated successfully!");
      } else {
        // Create new sponsor
        const response = await fetch("/api/admin/sponsors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formData),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok)
          throw new Error(readApiError(payload, "Unable to create sponsor"));
        toast.success("Sponsor created successfully!");
      }

      // Reset form and reload
      resetForm();
      await loadSponsors();
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error saving sponsor:", message);
      toast.error(message || "Failed to save sponsor");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (sponsor: Sponsor) => {
    setEditingSponsor(sponsor);
    setFormData({
      name: sponsor.name,
      logo: sponsor.logo,
      website: sponsor.website,
      tier: sponsor.tier,
      description: sponsor.description || "",
      category: sponsor.category || "",
      isActive: sponsor.isActive,
      displayOrder: sponsor.displayOrder,
      featured: sponsor.featured,
      startDate: sponsor.startDate,
      endDate: sponsor.endDate || "",
    });
    setShowForm(true);
  };

  const handleDelete = async (sponsorId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this sponsor? This cannot be undone.",
      )
    )
      return;
    setDeletingId(sponsorId);
    try {
      const response = await fetch(
        `/api/admin/sponsors?sponsorId=${encodeURIComponent(sponsorId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to delete sponsor"));
      toast.success("Sponsor deleted successfully!");
      await loadSponsors();
    } catch (error) {
      logError("Error deleting sponsor:", error);
      toast.error(getErrorMessage(error) || "Failed to delete sponsor");
    } finally {
      setDeletingId(null);
    }
  };

  // Approve every selected pending sponsor in one call, then drop the
  // selection. Rows decide independently server-side; partial failures are
  // reported rather than swallowed.
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || bulkApproving) return;
    if (
      !confirm(
        `Approve ${selectedIds.size} sponsor${selectedIds.size > 1 ? "s" : ""}? Each submitter is notified and each goes live on the wall.`,
      )
    )
      return;
    setBulkApproving(true);
    try {
      const response = await fetch("/api/admin/sponsors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sponsorId: [...selectedIds][0],
          action: "approve",
          sponsorIds: [...selectedIds],
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        approvedCount?: number;
        failedIds?: string[];
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to approve sponsors"));
      const decided = payload?.approvedCount ?? 0;
      const failures = payload?.failedIds?.length ?? 0;

      if (failures > 0) {
        toast.warning(
          `${decided} approved, ${failures} failed — retry the failed ones from the queue`,
        );
      } else {
        toast.success(`${decided} sponsor${decided === 1 ? "" : "s"} approved`);
      }
      setSelectedIds(new Set());
      await loadSponsors();
    } catch (error) {
      logError("Bulk sponsor approval failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve sponsors",
      );
    } finally {
      setBulkApproving(false);
    }
  };

  const handleReview = async (
    sponsor: Sponsor,
    action: "approve" | "reject",
  ) => {
    if (!sponsor.$id) return;
    let reason = "";

    if (action === "reject") {
      const input = window.prompt(
        `Why is "${sponsor.name}" not approved? The submitter sees this.`,
        sponsor.rejectionReason ?? "",
      );

      if (input === null) return;
      reason = input.trim();

      if (!reason) {
        toast.error("A rejection reason is required");

        return;
      }
    } else if (
      !confirm(`Approve "${sponsor.name}"? It goes live on the sponsors wall.`)
    ) {
      return;
    }

    setReviewingId(sponsor.$id);
    try {
      const response = await fetch("/api/admin/sponsors", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          sponsorId: sponsor.$id,
          action,
          reason: reason || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to review sponsor"));
      toast.success(
        action === "approve" ? "Sponsor approved" : "Sponsor sent back",
      );
      await loadSponsors();
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error reviewing sponsor:", message);
      toast.error(`Failed to review sponsor: ${message}`);
    } finally {
      setReviewingId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      logo: "",
      website: "",
      tier: "partner",
      description: "",
      category: "",
      isActive: true,
      displayOrder: 0,
      featured: false,
      startDate: new Date().toISOString().split("T")[0],
      endDate: "",
    });
    setEditingSponsor(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading sponsors"
          className="text-center"
          role="status"
        >
          <Spinner className="mx-auto" size="lg" />
          <p className="mt-4 text-muted">Loading sponsors...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold">Sponsors Management</h1>
          <p className="text-default-600 mt-2">
            Manage your club sponsors and partners
          </p>
        </div>
        {canManage && (
          <Button
            size="lg"
            onPress={() => (showForm ? resetForm() : setShowForm(true))}
          >
            {showForm ? "Cancel" : "Add Sponsor"}
          </Button>
        )}
      </div>

      {/* Form */}
      {showForm && canManage && (
        <Card className="mb-8 border-2 border-primary">
          <CardHeader className="bg-primary/10">
            <h2 className="text-xl font-bold">
              {editingSponsor ? "Edit Sponsor" : "Add New Sponsor"}
            </h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-6" onSubmit={handleSubmit}>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <Input
                  required
                  placeholder="e.g., Google"
                  value={formData.name}
                  onChange={(e: any) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                />

                <Input
                  required
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e: any) =>
                    setFormData({ ...formData, logo: e.target.value })
                  }
                />

                <Input
                  required
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e: any) =>
                    setFormData({ ...formData, website: e.target.value })
                  }
                />

                <Select
                  fullWidth
                  aria-label="Sponsor tier"
                  value={formData.tier}
                  onChange={(value) =>
                    setFormData({
                      ...formData,
                      tier: String(value ?? formData.tier) as Sponsor["tier"],
                    })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {[
                        { value: "platinum", label: "Platinum Partner" },
                        { value: "gold", label: "Gold Sponsor" },
                        { value: "silver", label: "Silver Sponsor" },
                        { value: "bronze", label: "Bronze Sponsor" },
                        { value: "partner", label: "Community Partner" },
                      ].map((tier) => (
                        <ListBox.Item
                          key={tier.value}
                          id={tier.value}
                          textValue={tier.label}
                        >
                          {tier.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Select
                  fullWidth
                  placeholder="Select category"
                  value={formData.category === "" ? null : formData.category}
                  onChange={(value) =>
                    setFormData({ ...formData, category: String(value ?? "") })
                  }
                >
                  <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                  </Select.Trigger>
                  <Select.Popover>
                    <ListBox>
                      {[
                        { value: "tech", label: "Technology" },
                        { value: "education", label: "Education" },
                        { value: "finance", label: "Finance" },
                        { value: "healthcare", label: "Healthcare" },
                        { value: "other", label: "Other" },
                      ].map((cat) => (
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

                <Input
                  placeholder="0"
                  type="number"
                  value={formData.displayOrder.toString()}
                  onChange={(e: any) =>
                    setFormData({
                      ...formData,
                      displayOrder: parseInt(e.target.value) || 0,
                    })
                  }
                />

                <Input
                  required
                  type="date"
                  value={formData.startDate}
                  onChange={(e: any) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                />

                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e: any) =>
                    setFormData({ ...formData, endDate: e.target.value })
                  }
                />
              </div>

              <TextArea
                placeholder="Brief description of the sponsor..."
                rows={3}
                value={formData.description}
                onChange={(e: any) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />

              <div className="flex gap-8">
                <Switch
                  isSelected={formData.isActive}
                  onChange={(value: any) =>
                    setFormData({ ...formData, isActive: value })
                  }
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Active
                  </Switch.Content>
                </Switch>

                <Switch
                  isSelected={formData.featured}
                  onChange={(value: any) =>
                    setFormData({ ...formData, featured: value })
                  }
                >
                  <Switch.Content>
                    <Switch.Control>
                      <Switch.Thumb />
                    </Switch.Control>
                    Featured (Show in footer & homepage)
                  </Switch.Content>
                </Switch>
              </div>

              {/* Logo Preview */}
              {formData.logo && (
                <div className="border-2 border-dashed border-default-300 rounded-lg p-4">
                  <p className="text-sm font-semibold mb-2">Logo Preview:</p>
                  <Image
                    unoptimized
                    alt="Logo preview"
                    className="max-h-32 object-contain"
                    height={128}
                    src={formData.logo}
                    width={320}
                    onError={(e: any) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      toast.error(
                        "Invalid image URL. Please check the logo URL.",
                      );
                    }}
                  />
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <Button
                  isDisabled={saving}
                  variant="secondary"
                  onPress={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  isPending={saving}

                  type="submit"
                >
                  {editingSponsor ? "Update Sponsor" : "Create Sponsor"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Sponsors List */}
      <div className="space-y-4">
        <div
          aria-label="Filter sponsors by review status"
          className="flex flex-wrap items-center gap-2"
          role="group"
        >
          {(
            [
              { value: "all", label: "All" },
              { value: "pending", label: "Needs review" },
              { value: "approved", label: "Published" },
              { value: "rejected", label: "Sent back" },
            ] as const
          ).map((tab) => {
            const count =
              tab.value === "all" ? sponsors.length : reviewCounts[tab.value];
            // Selected-count badge sits on the Pending tab itself so the
            // working set stays visible across tab switches.
            const selectedCount =
              tab.value === "pending" ? selectedIds.size : 0;

            return (
              <Button
                key={tab.value}
                aria-pressed={activeTab === tab.value}
                size="sm"
                variant={activeTab === tab.value ? "primary" : "secondary"}
                onPress={() => setActiveTab(tab.value)}
              >
                {tab.label}
                {selectedCount > 0 && (
                  <Chip className="ml-1 tabular-nums" color="accent" size="sm">
                    {selectedCount} selected
                  </Chip>
                )}
                <Chip
                  className="ml-1 tabular-nums"
                  color={
                    tab.value === "approved"
                      ? "success"
                      : tab.value === "rejected"
                        ? "danger"
                        : tab.value === "pending"
                          ? "warning"
                          : "default"
                  }
                  size="sm"
                  variant="soft"
                >
                  {count}
                </Chip>
              </Button>
            );
          })}
          {activeTab === "pending" &&
            canReview &&
            visibleSponsors.length > 0 && (
              <div className="ml-auto flex items-center gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onPress={() => {
                    const pendingIds = visibleSponsors
                      .filter((s) => statusOf(s) === "pending" && s.$id)
                      .map((s) => s.$id!);
                    const allSelected =
                      pendingIds.length > 0 &&
                      pendingIds.every((id) => selectedIds.has(id));

                    setSelectedIds(
                      allSelected
                        ? new Set()
                        : new Set([...selectedIds, ...pendingIds]),
                    );
                  }}
                >
                  {visibleSponsors.every(
                    (s) =>
                      statusOf(s) !== "pending" ||
                      (s.$id && selectedIds.has(s.$id)),
                  ) && visibleSponsors.length > 0
                    ? "Clear selection"
                    : `Select all (${visibleSponsors.length})`}
                </Button>
                {selectedIds.size > 0 && (
                  <Button
                    isPending={bulkApproving}
                    size="sm"
                    variant="primary"
                    onPress={handleBulkApprove}
                  >
                    <CheckIcon aria-hidden="true" className="w-4 h-4" />
                    Approve {selectedIds.size}
                  </Button>
                )}
              </div>
            )}
        </div>

        {visibleSponsors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600 mb-4">
                {activeTab === "pending"
                  ? "No proposals waiting"
                  : activeTab === "rejected"
                    ? "Nothing sent back"
                    : activeTab === "approved"
                      ? "No published sponsors yet"
                      : "No sponsors yet"}
              </p>
              {canManage &&
                activeTab !== "pending" &&
                activeTab !== "rejected" && (
                  <Button onPress={() => setShowForm(true)}>
                    Add Your First Sponsor
                  </Button>
                )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {visibleSponsors.map((sponsor) => {
              // Unknown tier values (legacy rows, API drift) must degrade to a
              // plain badge — indexing blind would crash the whole grid.
              const tierInfo =
                sponsorTiers[sponsor.tier as keyof typeof sponsorTiers] ??
                sponsorTiers.partner;

              return (
                <Card key={sponsor.$id} className="relative">
                  <CardContent className="space-y-4">
                    {canReview &&
                      statusOf(sponsor) === "pending" &&
                      sponsor.$id && (
                        <label
                          aria-label={`Select ${sponsor.name} for bulk approval`}
                          className="absolute top-2 right-2 z-10 flex cursor-pointer items-center rounded-full bg-black/30 p-1.5"
                        >
                          <input
                            checked={selectedIds.has(sponsor.$id)}
                            className="size-4 cursor-pointer"
                            type="checkbox"
                            onChange={() =>
                              setSelectedIds((current) => {
                                const next = new Set(current);

                                if (next.has(sponsor.$id!))
                                  next.delete(sponsor.$id!);
                                else next.add(sponsor.$id!);

                                return next;
                              })
                            }
                          />
                        </label>
                      )}
                    {/* Status Badges */}
                    <div className="flex gap-2 flex-wrap">
                      <Chip
                        className={`bg-gradient-to-r ${tierInfo.color} text-white`}
                        size="sm"
                      >
                        {tierInfo.label}
                      </Chip>
                      {sponsor.featured && <Chip size="sm">Featured</Chip>}
                      {statusOf(sponsor) === "pending" && (
                        <Chip color="warning" size="sm" variant="soft">
                          Needs review
                        </Chip>
                      )}
                      {statusOf(sponsor) === "rejected" && (
                        <Chip color="danger" size="sm" variant="soft">
                          Sent back
                        </Chip>
                      )}
                      {sponsor.isActive ? (
                        <Chip size="sm">
                          <CheckIcon className="w-3 h-3" />
                          Active
                        </Chip>
                      ) : (
                        <Chip size="sm">
                          <XIcon className="w-3 h-3" />
                          Inactive
                        </Chip>
                      )}
                    </div>

                    {/* Logo */}
                    <div className="flex items-center justify-center h-24 bg-default-100 rounded-lg">
                      <Image
                        unoptimized
                        alt={`${sponsor.name} logo`}
                        className="max-h-20 max-w-full object-contain"
                        height={80}
                        loading="lazy"
                        src={sponsor.logo}
                        width={240}
                      />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-bold text-lg">{sponsor.name}</h3>
                      {sponsor.category && (
                        <p className="text-sm text-default-600 capitalize">
                          {sponsor.category}
                        </p>
                      )}
                      {sponsor.description && (
                        <p className="text-sm text-default-600 mt-2 line-clamp-2">
                          {sponsor.description}
                        </p>
                      )}
                      {sponsor.submittedByName && (
                        <p className="text-xs text-default-400 mt-1">
                          Submitted by {sponsor.submittedByName}
                        </p>
                      )}
                      {statusOf(sponsor) === "rejected" &&
                        sponsor.rejectionReason && (
                          <p className="text-sm text-danger mt-2 line-clamp-2">
                            {sponsor.rejectionReason}
                          </p>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      {canReview && statusOf(sponsor) !== "approved" && (
                        <Button
                          isIconOnly
                          aria-label={`Approve ${sponsor.name}`}
                          isPending={reviewingId === sponsor.$id}
                          size="sm"
                          variant="primary"
                          onPress={() => handleReview(sponsor, "approve")}
                        >
                          <CheckIcon aria-hidden="true" className="w-4 h-4" />
                        </Button>
                      )}
                      {canReview && statusOf(sponsor) === "pending" && (
                        <Button
                          isIconOnly
                          aria-label={`Send back ${sponsor.name}`}
                          isPending={reviewingId === sponsor.$id}
                          size="sm"
                          variant="danger-soft"
                          onPress={() => handleReview(sponsor, "reject")}
                        >
                          <XIcon aria-hidden="true" className="w-4 h-4" />
                        </Button>
                      )}
                      <a
                        className="flex-1"
                        href={sponsor.website}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <Button className="w-full" size="sm" variant="primary">
                          Visit
                        </Button>
                      </a>
                      {canManage && (
                        <Button
                          isIconOnly
                          aria-label={`Edit ${sponsor.name}`}
                          size="sm"
                          variant="secondary"
                          onPress={() => handleEdit(sponsor)}
                        >
                          <EditIcon className="w-4 h-4" />
                        </Button>
                      )}
                      {canManage && (
                        <Button
                          isIconOnly
                          aria-label={`Delete ${sponsor.name}`}
                          isPending={deletingId === sponsor.$id}
                          size="sm"
                          variant="danger-soft"
                          onPress={() => handleDelete(sponsor.$id!)}
                        >
                          <TrashIcon className="w-4 h-4" />
                        </Button>
                      )}
                    </div>

                    {/* Order */}
                    <div className="text-xs text-default-400 tabular-nums">
                      Display Order: {sponsor.displayOrder}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
