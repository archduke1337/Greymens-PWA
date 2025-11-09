// app/admin/sponsors/page.tsx
"use client";

import { useState, useEffect } from "react";
import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { Chip } from "@heroui/chip";
import { 
  PlusIcon, 
  EditIcon, 
  TrashIcon, 
  ExternalLinkIcon,
  CheckIcon,
  XIcon 
} from "lucide-react";
import { Sponsor, sponsorService, sponsorTiers } from "@/lib/sponsors";
import { getErrorMessage } from "@/lib/errorHandler";

export default function AdminSponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [loading, setLoading] = useState(true);
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
      const allSponsors = await sponsorService.getAllSponsors();
      setSponsors(allSponsors);
    } catch (error) {
      console.error("Error loading sponsors:", error);
      alert("Failed to load sponsors");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      // Validate URL
      if (!formData.logo) {
        alert("Logo URL is required");
        setSaving(false);
        return;
      }

      if (!formData.website) {
        alert("Website URL is required");
        setSaving(false);
        return;
      }

      // Validate logo URL format
      if (!sponsorService.validateLogoUrl(formData.logo)) {
        const confirm = window.confirm(
          "The logo URL might not be a valid image. Continue anyway?"
        );
        if (!confirm) {
          setSaving(false);
          return;
        }
      }

      if (editingSponsor) {
        // Update existing sponsor
        await sponsorService.updateSponsor(editingSponsor.$id!, formData);
        alert("Sponsor updated successfully!");
      } else {
        // Create new sponsor
        await sponsorService.createSponsor(formData as any);
        alert("Sponsor created successfully!");
      }

      // Reset form and reload
      resetForm();
      await loadSponsors();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving sponsor:", message);
      alert(message || "Failed to save sponsor");
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
    if (!confirm("Are you sure you want to delete this sponsor?")) return;

    try {
      await sponsorService.deleteSponsor(sponsorId);
      alert("Sponsor deleted successfully!");
      await loadSponsors();
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      alert("Failed to delete sponsor");
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
        <Button
          color="primary"
          size="lg"
          startContent={<PlusIcon className="w-5 h-5" />}
          onPress={() => setShowForm(!showForm)}
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
          <CardBody>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* Basic Info */}
                <Input
                  label="Company Name"
                  placeholder="e.g., Google"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  isRequired
                />

                <Input
                  label="Logo URL"
                  placeholder="https://example.com/logo.png"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  required
                  isRequired
                  description="Direct link to logo image (PNG, JPG, SVG)"
                />

                <Input
                  label="Website URL"
                  placeholder="https://example.com"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  required
                  isRequired
                />

                <Select
                  label="Tier"
                  selectedKeys={[formData.tier]}
                  onChange={(e) => setFormData({ ...formData, tier: e.target.value as Sponsor["tier"] })}
                  isRequired
                >
                  <SelectItem key="platinum">Platinum Partner</SelectItem>
                  <SelectItem key="gold">Gold Sponsor</SelectItem>
                  <SelectItem key="silver">Silver Sponsor</SelectItem>
                  <SelectItem key="bronze">Bronze Sponsor</SelectItem>
                  <SelectItem key="partner">Community Partner</SelectItem>
                </Select>

                <Select
                  label="Category"
                  selectedKeys={formData.category ? [formData.category] : []}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                >
                  <SelectItem key="tech">Technology</SelectItem>
                  <SelectItem key="education">Education</SelectItem>
                  <SelectItem key="finance">Finance</SelectItem>
                  <SelectItem key="healthcare">Healthcare</SelectItem>
                  <SelectItem key="other">Other</SelectItem>
                </Select>

                <Input
                  type="number"
                  label="Display Order"
                  placeholder="0"
                  value={formData.displayOrder.toString()}
                  onChange={(e) => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                  description="Lower numbers appear first"
                />

                <Input
                  type="date"
                  label="Start Date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  required
                  isRequired
                />

                <Input
                  type="date"
                  label="End Date (Optional)"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  description="Leave empty for ongoing sponsorship"
                />
              </div>

              <Textarea
                label="Description (Optional)"
                placeholder="Brief description of the sponsor..."
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />

              <div className="flex gap-8">
                <Switch
                  isSelected={formData.isActive}
                  onValueChange={(value) => setFormData({ ...formData, isActive: value })}
                >
                  Active
                </Switch>

                <Switch
                  isSelected={formData.featured}
                  onValueChange={(value) => setFormData({ ...formData, featured: value })}
                >
                  Featured (Show in footer & homepage)
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
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                      alert("Invalid image URL. Please check the logo URL.");
                    }}
                  />
                </div>
              )}

              <div className="flex gap-4 justify-end">
                <Button
                  variant="flat"
                  onPress={resetForm}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  color="primary"
                  isLoading={saving}
                >
                  {editingSponsor ? "Update Sponsor" : "Create Sponsor"}
                </Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {/* Sponsors List */}
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">
          All Sponsors ({sponsors.length})
        </h2>

        {sponsors.length === 0 ? (
          <Card>
            <CardBody className="text-center py-12">
              <p className="text-lg text-default-600 mb-4">No sponsors yet</p>
              <Button
                color="primary"
                startContent={<PlusIcon className="w-5 h-5" />}
                onPress={() => setShowForm(true)}
              >
                Add Your First Sponsor
              </Button>
            </CardBody>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sponsors.map((sponsor) => {
              const tierInfo = sponsorTiers[sponsor.tier as keyof typeof sponsorTiers];
              
              return (
                <Card key={sponsor.$id} className="relative">
                  <CardBody className="space-y-4">
                    {/* Status Badges */}
                    <div className="flex gap-2 flex-wrap">
                      <Chip
                        className={`bg-gradient-to-r ${tierInfo.color} text-white`}
                        size="sm"
                      >
                        {tierInfo.label}
                      </Chip>
                      {sponsor.featured && (
                        <Chip color="warning" size="sm">Featured</Chip>
                      )}
                      {sponsor.isActive ? (
                        <Chip color="success" size="sm" startContent={<CheckIcon className="w-3 h-3" />}>
                          Active
                        </Chip>
                      ) : (
                        <Chip color="danger" size="sm" startContent={<XIcon className="w-3 h-3" />}>
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
                      <Button
                        as="a"
                        href={sponsor.website}
                        target="_blank"
                        size="sm"
                        variant="flat"
                        className="flex-1"
                        startContent={<ExternalLinkIcon className="w-4 h-4" />}
                      >
                        Visit
                      </Button>
                      <Button
                        size="sm"
                        color="primary"
                        variant="flat"
                        isIconOnly
                        onPress={() => handleEdit(sponsor)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        isIconOnly
                        onPress={() => handleDelete(sponsor.$id!)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Order */}
                    <div className="text-xs text-default-400">
                      Display Order: {sponsor.displayOrder}
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}