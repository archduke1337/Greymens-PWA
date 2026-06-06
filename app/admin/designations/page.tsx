// app/admin/designations/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  PlusIcon,
  EditIcon,
  TrashIcon,
  CheckIcon,
  XIcon,
  ShieldIcon,
  SearchIcon,
  AwardIcon,
} from "lucide-react";
import { designationService } from "@/lib/designations";
import { profileService } from "@/lib/profiles";
import { getErrorMessage } from "@/lib/errorHandler";
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
  Switch,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import type { Designation, UserDesignation, Profile } from "@/lib/types";

const CATEGORY_LABELS: Record<string, string> = {
  department: "Department",
  operations: "Operations",
  executive: "Executive",
  special: "Special",
};

const CATEGORY_COLORS: Record<string, string> = {
  department: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  operations: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  executive: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  special: "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
};

export default function AdminDesignationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOpen, open, close } = useOverlayState();

  const [designations, setDesignations] = useState<Designation[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Assign modal state
  const { isOpen: isAssignOpen, open: openAssign, close: closeAssign } = useOverlayState();
  const [assignTarget, setAssignTarget] = useState<Designation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [assigning, setAssigning] = useState(false);

  // Revoke state
  const { isOpen: isRevokeOpen, open: openRevoke, close: closeRevoke } = useOverlayState();
  const [revokeTarget, setRevokeTarget] = useState<Designation | null>(null);
  const [holders, setHolders] = useState<(UserDesignation & { profile?: Profile | null })[]>([]);
  const [loadingHolders, setLoadingHolders] = useState(false);
  const [revokingUserId, setRevokingUserId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<Omit<Designation, "$id" | "$createdAt" | "$updatedAt">>({
    name: "",
    slug: "",
    description: "",
    level: 1,
    category: "department",
    departmentId: undefined,
    badgeIcon: "",
    badgeColor: "#6366f1",
    isActive: true,
    maxHolders: undefined,
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadDesignations();
  }, [user, authLoading, router]);

  const loadDesignations = async () => {
    try {
      const allDesigs = await designationService.getAll();
      setDesignations(allDesigs);
    } catch (error) {
      console.error("Error loading designations:", error);
      toast.error("Failed to load designations");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.name.trim()) {
        toast.error("Designation name is required");
        setSubmitting(false);
        return;
      }

      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const payload = { ...formData, slug };

      if (editingDesig) {
        await designationService.update(editingDesig.$id!, payload);
        toast.success("Designation updated successfully!");
      } else {
        await designationService.create(payload);
        toast.success("Designation created successfully!");
      }

      resetForm();
      await loadDesignations();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving designation:", message);
      toast.error(message || "Failed to save designation");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (desig: Designation) => {
    setEditingDesig(desig);
    setFormData({
      name: desig.name,
      slug: desig.slug,
      description: desig.description || "",
      level: desig.level,
      category: desig.category,
      departmentId: desig.departmentId,
      badgeIcon: desig.badgeIcon || "",
      badgeColor: desig.badgeColor || "#6366f1",
      isActive: desig.isActive,
      maxHolders: desig.maxHolders,
    });
    open();
  };

  const handleDelete = async (desigId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this designation? This cannot be undone."
      )
    )
      return;
    try {
      await designationService.delete(desigId);
      toast.success("Designation deleted successfully!");
      await loadDesignations();
    } catch (error) {
      console.error("Error deleting designation:", error);
      toast.error("Failed to delete designation");
    }
  };

  // --- Assign Flow ---
  const handleOpenAssign = (desig: Designation) => {
    setAssignTarget(desig);
    setSearchQuery("");
    setSearchResults([]);
    setSelectedUser(null);
    openAssign();
  };

  const handleSearchUsers = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await profileService.search(searchQuery);
      setSearchResults(results);
    } catch (error) {
      console.error("Error searching users:", error);
      toast.error("Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser || !assignTarget || !user) return;
    setAssigning(true);
    try {
      await designationService.assign(
        selectedUser.userId,
        assignTarget.$id!,
        user.$id
      );
      toast.success(
        `Designation "${assignTarget.name}" assigned to ${selectedUser.urn || selectedUser.userId}!`
      );
      closeAssign();
      await loadDesignations();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error assigning designation:", message);
      toast.error(message || "Failed to assign designation");
    } finally {
      setAssigning(false);
    }
  };

  // --- Revoke Flow ---
  const handleOpenRevoke = async (desig: Designation) => {
    setRevokeTarget(desig);
    setLoadingHolders(true);
    openRevoke();
    try {
      const holdersData = await designationService.getDesignationHolders(desig.$id!);
      const holdersWithProfiles = await Promise.all(
        holdersData.map(async (h) => {
          const profile = await profileService.getByUserId(h.userId);
          return { ...h, profile };
        })
      );
      setHolders(holdersWithProfiles);
    } catch (error) {
      console.error("Error loading holders:", error);
      toast.error("Failed to load designation holders");
    } finally {
      setLoadingHolders(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!revokeTarget || !user) return;
    if (!confirm("Are you sure you want to revoke this designation?")) return;
    setRevokingUserId(userId);
    try {
      await designationService.revoke(userId, revokeTarget.$id!, user.$id);
      toast.success("Designation revoked successfully!");
      setHolders((prev) => prev.filter((h) => h.userId !== userId));
      await loadDesignations();
    } catch (error) {
      console.error("Error revoking designation:", error);
      toast.error("Failed to revoke designation");
    } finally {
      setRevokingUserId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      level: 1,
      category: "department",
      departmentId: undefined,
      badgeIcon: "",
      badgeColor: "#6366f1",
      isActive: true,
      maxHolders: undefined,
    });
    setEditingDesig(null);
    close();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading designations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent">
            Designation Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Manage club designations, roles, and badges
          </p>
        </div>
        <Button
          onPress={open}
          className="bg-gradient-to-r from-amber-500 to-rose-500"
          size="lg"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Add Designation</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total</p>
                <p className="text-2xl font-bold">{designations.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <ShieldIcon className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <Card key={key} className="border-none shadow-md">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-default-500">{label}</p>
                  <p className="text-2xl font-bold">
                    {designations.filter((d) => d.category === key).length}
                  </p>
                </div>
                <Chip size="sm" className={CATEGORY_COLORS[key]}>
                  {key.charAt(0).toUpperCase() + key.slice(1)}
                </Chip>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Designations List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">
          All Designations ({designations.length})
        </h2>

        {designations.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600 mb-4">
                No designations yet
              </p>
              <Button onPress={open}>Create First Designation</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {designations.map((desig) => (
              <Card key={desig.$id} className="border-none shadow-md hover:shadow-lg transition-shadow">
                <CardContent className="space-y-4 p-5">
                  {/* Badge & Name */}
                  <div className="flex items-start gap-3">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                      style={{ backgroundColor: desig.badgeColor || "#6366f1" }}
                    >
                      {desig.badgeIcon || desig.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-lg">{desig.name}</h3>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <Chip size="sm" className={CATEGORY_COLORS[desig.category]}>
                          {CATEGORY_LABELS[desig.category]}
                        </Chip>
                        <Chip size="sm" className="bg-default-100 text-default-700">
                          Level {desig.level}
                        </Chip>
                      </div>
                    </div>
                  </div>

                  {/* Description */}
                  {desig.description && (
                    <p className="text-sm text-default-500 line-clamp-2">
                      {desig.description}
                    </p>
                  )}

                  {/* Max Holders */}
                  {desig.maxHolders && (
                    <p className="text-xs text-default-400">
                      Max holders: {desig.maxHolders}
                    </p>
                  )}

                  {/* Status */}
                  <div className="flex items-center gap-2">
                    {desig.isActive ? (
                      <Chip size="sm" className="bg-green-100 text-green-800">
                        <CheckIcon className="w-3 h-3 mr-1" />
                        Active
                      </Chip>
                    ) : (
                      <Chip size="sm" className="bg-red-100 text-red-800">
                        <XIcon className="w-3 h-3 mr-1" />
                        Inactive
                      </Chip>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onPress={() => handleOpenAssign(desig)}
                    >
                      <AwardIcon className="w-4 h-4 mr-1" />
                      Assign
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      className="flex-1"
                      onPress={() => handleOpenRevoke(desig)}
                    >
                      <XIcon className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      isIconOnly
                      onPress={() => handleEdit(desig)}
                    >
                      <EditIcon className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      isIconOnly
                      onPress={() => handleDelete(desig.$id!)}
                    >
                      <TrashIcon className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(open: boolean) => {
            if (!open) resetForm();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <form onSubmit={handleSubmit}>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold bg-gradient-to-r from-amber-500 to-rose-500 bg-clip-text text-transparent">
                      {editingDesig ? "Edit Designation" : "Create Designation"}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      {editingDesig
                        ? "Update designation details"
                        : "Add a new designation to the system"}
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Designation Name</label>
                      <Input
                        placeholder="e.g., Head of Web Development"
                        value={formData.name}
                        onChange={(e: any) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Description</label>
                      <TextArea
                        placeholder="What does this designation entail?"
                        value={formData.description}
                        onChange={(e: any) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-1.5">
                          Category
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              category: e.target.value as Designation["category"],
                            })
                          }
                          required
                          className="w-full px-3 py-2.5 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                        >
                          <option value="department">Department</option>
                          <option value="operations">Operations</option>
                          <option value="executive">Executive</option>
                          <option value="special">Special</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Level</label>
                        <Input
                          type="number"
                          placeholder="1"
                          value={formData.level.toString()}
                          onChange={(e: any) =>
                            setFormData({
                              ...formData,
                              level: parseInt(e.target.value) || 1,
                            })
                          }
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Badge Icon</label>
                        <Input
                          placeholder="Emoji or text"
                          value={formData.badgeIcon}
                          onChange={(e: any) =>
                            setFormData({ ...formData, badgeIcon: e.target.value })
                          }
                        />
                      </div>

                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Badge Color</label>
                        <input
                          type="color"
                          value={formData.badgeColor || "#6366f1"}
                          onChange={(e) =>
                            setFormData({ ...formData, badgeColor: e.target.value })
                          }
                          className="w-10 h-10 rounded-lg border border-default-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Max Holders (optional)</label>
                      <Input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={formData.maxHolders?.toString() || ""}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            maxHolders: e.target.value
                              ? parseInt(e.target.value)
                              : undefined,
                          })
                        }
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Department ID (optional)</label>
                      <Input
                        placeholder="Link to a specific department"
                        value={formData.departmentId || ""}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            departmentId: e.target.value || undefined,
                          })
                        }
                      />
                    </div>

                    <Switch
                      isSelected={formData.isActive}
                      onChange={(checked: any) =>
                        setFormData({ ...formData, isActive: checked })
                      }
                    >
                      Active
                    </Switch>
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      onPress={resetForm}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      isPending={submitting}
                      className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold"
                    >
                      {editingDesig
                        ? "Update Designation"
                        : "Create Designation"}
                    </Button>
                  </ModalFooter>
                </form>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Assign Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isAssignOpen}
          onOpenChange={(open: boolean) => {
            if (!open) closeAssign();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <div>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold">
                      Assign: {assignTarget?.name}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      Search for a user to assign this designation
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6 space-y-4">
                    {/* Search */}
                    <div className="flex gap-2">
                      <Input
                        placeholder="Search by URN, branch, or userId..."
                        value={searchQuery}
                        onChange={(e: any) => setSearchQuery(e.target.value)}
                        onKeyPress={(e: any) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleSearchUsers();
                          }
                        }}
                        className="flex-1"
                      />
                      <Button
                        variant="primary"
                        onPress={handleSearchUsers}
                        isPending={searching}
                      >
                        <SearchIcon className="w-4 h-4" />
                      </Button>
                    </div>

                    {/* Search Results */}
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {searchResults.length === 0 && searchQuery && !searching && (
                        <p className="text-sm text-default-400 text-center py-4">
                          No results found. Try a different search.
                        </p>
                      )}
                      {searchResults.map((profile) => (
                        <button
                          key={profile.userId}
                          type="button"
                          onClick={() => setSelectedUser(profile)}
                          className={`w-full text-left p-3 rounded-lg border transition-colors ${
                            selectedUser?.userId === profile.userId
                              ? "border-primary bg-primary/10"
                              : "border-default-200 hover:bg-default-100"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold">
                              {profile.urn?.charAt(0) ||
                                profile.userId.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="text-sm font-medium">
                                {profile.urn || profile.userId}
                              </p>
                              <p className="text-xs text-default-400">
                                {[profile.branch, profile.program]
                                  .filter(Boolean)
                                  .join(" | ")}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {/* Selected User */}
                    {selectedUser && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-sm font-semibold">Selected:</p>
                        <p className="text-sm">
                          {selectedUser.urn || selectedUser.userId}
                        </p>
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      onPress={closeAssign}
                    >
                      Cancel
                    </Button>
                    <Button
                      isPending={assigning}
                      isDisabled={!selectedUser}
                      className="w-full sm:w-auto bg-gradient-to-r from-amber-500 to-rose-500 text-white font-semibold"
                      onPress={handleAssign}
                    >
                      Assign Designation
                    </Button>
                  </ModalFooter>
                </div>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Revoke Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isRevokeOpen}
          onOpenChange={(open: boolean) => {
            if (!open) {
              setHolders([]);
              closeRevoke();
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <div>
                  <ModalHeader className="flex flex-col gap-1 border-b pb-4">
                    <h2 className="text-xl font-bold">
                      Revoke: {revokeTarget?.name}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      Select a user to revoke this designation from
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6">
                    {loadingHolders ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                      </div>
                    ) : holders.length === 0 ? (
                      <p className="text-sm text-default-400 text-center py-8">
                        No active holders for this designation.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {holders.map((holder) => (
                          <div
                            key={holder.$id}
                            className="flex items-center justify-between p-3 border border-default-200 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold">
                                {holder.profile?.urn?.charAt(0) ||
                                  holder.userId.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-medium">
                                  {holder.profile?.urn || holder.userId}
                                </p>
                                <p className="text-xs text-default-400">
                                  Assigned:{" "}
                                  {new Date(
                                    holder.assignedAt
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              variant="primary"
                              isIconOnly
                              isPending={revokingUserId === holder.userId}
                              onPress={() => handleRevoke(holder.userId)}
                            >
                              <TrashIcon className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="primary"
                      className="w-full sm:w-auto"
                      onPress={() => {
                        setHolders([]);
                        closeRevoke();
                      }}
                    >
                      Close
                    </Button>
                  </ModalFooter>
                </div>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
