// app/admin/sponsors/page.tsx
"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  ExternalLinkIcon,
  CheckIcon,
  XIcon 
} from "lucide-react";
import type { Sponsor } from "@/lib/sponsors";
const sponsorTiers = {
  platinum: { color: "from-slate-300 to-slate-400", label: "Platinum Partner", size: "large", maxWidth: "200px" },
  gold: { color: "from-yellow-300 to-yellow-500", label: "Gold Sponsor", size: "medium", maxWidth: "160px" },
  silver: { color: "from-gray-300 to-gray-400", label: "Silver Sponsor", size: "medium", maxWidth: "140px" },
  bronze: { color: "from-orange-400 to-orange-600", label: "Bronze Sponsor", size: "small", maxWidth: "120px" },
  partner: { color: "from-blue-400 to-blue-600", label: "Community Partner", size: "small", maxWidth: "100px" },
};
import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import { Button, Card, CardContent, CardHeader, Chip, Input, Label, ListBox, Select, Switch, TextArea } from "@heroui/react";

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingSponsor, setEditingSponsor] = useState<Sponsor | null>(null);
  const [saving, setSaving] = useState(false);

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
    startDate: new Date().toISOString().split('T')[0],
    endDate: "",
  });

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const response = await fetch("/api/admin/sponsors", { credentials: "include" });
      const payload = (await response.json().catch(() => null)) as { sponsors?: Sponsor[]; error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to load sponsors"));
      setSponsors(payload?.sponsors ?? []);
    } catch (error) {
      console.error("Error loading sponsors:", error);
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

      for (const [field, label] of [["logo", "Logo URL"], ["website", "Website URL"]] as const) {
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
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(readApiError(payload, "Unable to update sponsor"));
        toast.success("Sponsor updated successfully!");
      } else {
        // Create new sponsor
        const response = await fetch("/api/admin/sponsors", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(formData),
        });
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        if (!response.ok) throw new Error(readApiError(payload, "Unable to create sponsor"));
        toast.success("Sponsor created successfully!");
      }

      // Reset form and reload
      resetForm();
      await loadSponsors();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving sponsor:", message);
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
    if (!confirm("Are you sure you want to delete this sponsor? This cannot be undone.")) return;
    setDeletingId(sponsorId);
    try {
      const response = await fetch(`/api/admin/sponsors?sponsorId=${encodeURIComponent(sponsorId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to delete sponsor"));
      toast.success("Sponsor deleted successfully!");
      await loadSponsors();
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      toast.error(getErrorMessage(error) || "Failed to delete sponsor");
    } finally {
      setDeletingId(null);
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
      startDate: new Date().toISOString().split('T')[0],
      endDate: "",
    });
    setEditingSponsor(null);
    setShowForm(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading sponsors...</p>
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
        <Button size="lg"
          onPress={() => showForm ? resetForm() : setShowForm(true)}
        >
          {showForm ? "Cancel" : "Add Sponsor"}
        </Button>
      </div>

      {/* Form */}
      {showForm && (
        <Card className="mb-8 border-2 border-primary">
          <CardHeader className="bg-primary/10">
            <h2 className="text-xl font-bold">
              {editingSponsor ? "Edit Sponsor" : "Add New Sponsor"}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <Input
                  placeholder="e.g., Google"
                  value={formData.name}
                  onChange={(e: any) => setFormData({ ...formData, name: e.target.value })}
                  required
                />

                <Input
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e: any) => setFormData({ ...formData, logo: e.target.value })}
                  required
                />

                <Input
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e: any) => setFormData({ ...formData, website: e.target.value })}
                  required
                />

                <Select
                  fullWidth
                  aria-label="Sponsor tier"
                  value={formData.tier}
                  onChange={(value) => setFormData({ ...formData, tier: String(value ?? formData.tier) as Sponsor["tier"] })}
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
                        <ListBox.Item key={tier.value} id={tier.value} textValue={tier.label}>
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
                  onChange={(value) => setFormData({ ...formData, category: String(value ?? "") })}
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
                        <ListBox.Item key={cat.value} id={cat.value} textValue={cat.label}>
                          {cat.label}
                          <ListBox.ItemIndicator />
                        </ListBox.Item>
                      ))}
                    </ListBox>
                  </Select.Popover>
                </Select>

                <Input
                  type="number"
                  placeholder="0"
                  value={formData.displayOrder.toString()}
                  onChange={(e: any) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                />

                <Input
                  type="date"
                  value={formData.startDate}
                  onChange={(e: any) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                />

                <Input
                  type="date"
                  value={formData.endDate}
                  onChange={(e: any) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>

              <TextArea
                placeholder="Brief description of the sponsor..."
                value={formData.description}
                onChange={(e: any) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />

              <div className="flex gap-8">
                <Switch
                  isSelected={formData.isActive}
                  onChange={(value: any) => setFormData({ ...formData, isActive: value })}
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
                  onChange={(value: any) => setFormData({ ...formData, featured: value })}
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
                  <img 
                    src={formData.logo} 
                    alt="Logo preview" 
                    className="max-h-32 object-contain"
                    onError={(e: any) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      toast.error("Invalid image URL. Please check the logo URL.");
                    }}
                  />
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <Button
                  variant="primary"
                  isDisabled={saving}
                  onPress={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  
                  isPending={saving}
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
        <h2 className="text-2xl font-bold">
          All Sponsors ({sponsors.length})
        </h2>

        {sponsors.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600 mb-4">No sponsors yet</p>
              <Button
                onPress={() => setShowForm(true)}
              >
                Add Your First Sponsor
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sponsors.map((sponsor) => {
              // Unknown tier values (legacy rows, API drift) must degrade to a
              // plain badge — indexing blind would crash the whole grid.
              const tierInfo = (sponsorTiers[sponsor.tier as keyof typeof sponsorTiers] ?? sponsorTiers.partner);
              
              return (
                <Card key={sponsor.$id} className="relative">
                  <CardContent className="space-y-4">
                    {/* Status Badges */}
                    <div className="flex gap-2 flex-wrap">
                      <Chip
                        className={`bg-gradient-to-r ${tierInfo.color} text-white`}
                        size="sm"
                      >
                        {tierInfo.label}
                      </Chip>
                      {sponsor.featured && (
                        <Chip  size="sm">Featured</Chip>
                      )}
                      {sponsor.isActive ? (
                        <Chip
                        size="sm"
                      >
                        <CheckIcon className="w-3 h-3" />
                        Active
                      </Chip>
                      ) : (
                        <Chip
                        size="sm"
                      >
                        <XIcon className="w-3 h-3" />
                        Inactive
                      </Chip>
                      )}
                    </div>

                    {/* Logo */}
                    <div className="flex items-center justify-center h-24 bg-default-100 rounded-lg">
                      <img
                        src={sponsor.logo}
                        alt={sponsor.name}
                        className="max-h-20 max-w-full object-contain"
                      />
                    </div>

                    {/* Info */}
                    <div>
                      <h3 className="font-bold text-lg">{sponsor.name}</h3>
                      {sponsor.category && (
                        <p className="text-sm text-default-600 capitalize">{sponsor.category}</p>
                      )}
                      {sponsor.description && (
                        <p className="text-sm text-default-600 mt-2 line-clamp-2">
                          {sponsor.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <a href={sponsor.website} target="_blank" rel="noopener noreferrer" className="flex-1">
                        <Button
                          size="sm"
                          variant="primary"
                          className="w-full"
                        >
                          Visit
                        </Button>
                      </a>
                      <Button
                        size="sm"
                        
                        variant="primary"
                        isIconOnly
                        onPress={() => handleEdit(sponsor)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        
                        variant="primary"
                        isIconOnly
                        isPending={deletingId === sponsor.$id}
                        onPress={() => handleDelete(sponsor.$id!)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Order */}
                    <div className="text-xs text-default-400">
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