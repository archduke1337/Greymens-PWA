// app/admin/sponsors/page.tsx
"use client";

import { Card, CardContent, CardHeader, Button, Input, TextArea, Switch, Chip } from "@heroui/react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {   PlusIcon, 
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
    endDate: "" });

  useEffect(() => {
    loadSponsors();
  }, []);

  const loadSponsors = async () => {
    try {
      const allSponsors = await sponsorService.getAllSponsors();
      setSponsors(allSponsors);
    } catch (error) {
      console.error("Error loading sponsors:", error);
      toast.error("Failed to load sponsors");
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
        toast.error("Logo URL is required");
        setSaving(false);
        return;
      }

      if (!formData.website) {
        toast.error("Website URL is required");
        setSaving(false);
        return;
      }

      if (editingSponsor) {
        // Update existing sponsor
        await sponsorService.updateSponsor(editingSponsor.$id!, formData);
        toast.success("Sponsor updated successfully!");
      } else {
        // Create new sponsor
        await sponsorService.createSponsor(formData as any);
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
      endDate: sponsor.endDate || "" });
    setShowForm(true);
  };

  const handleDelete = async (sponsorId: string) => {
    if (!confirm("Are you sure you want to delete this sponsor? This cannot be undone.")) return;
    try {
      await sponsorService.deleteSponsor(sponsorId);
      toast.success("Sponsor deleted successfully!");
      await loadSponsors();
    } catch (error) {
      console.error("Error deleting sponsor:", error);
      toast.error("Failed to delete sponsor");
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
      endDate: "" });
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
          variant="primary"
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