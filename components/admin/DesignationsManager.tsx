// components/admin/DesignationsManager.tsx
"use client";

import { useState } from "react";
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

import { getErrorMessage } from "@/lib/errorHandler";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Modal,
  ModalBackdrop,
  ModalContainer,
  ModalDialog,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  Switch,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import type { Designation, UserDesignation, Profile, Department } from "@/lib/types";

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

export interface DesignationsManagerProps {
  designations: Designation[];
  departments: Department[];
  onChanged: () => Promise<void> | void;
}

export default function DesignationsManager({ designations, departments, onChanged }: DesignationsManagerProps) {
  const { isOpen, open, close } = useOverlayState();
  const [editingDesig, setEditingDesig] = useState<Designation | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

      const response = await fetch("/api/admin/designations", {
        method: editingDesig ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          editingDesig
            ? { designationId: editingDesig.$id, ...payload }
            : payload,
        ),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Failed to save designation");

      if (editingDesig) {
        toast.success("Designation updated successfully!");
      } else {
        toast.success("Designation created successfully!");
      }

      resetForm();
      await onChanged();
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
    setDeletingId(desigId);
    try {
      const response = await fetch(`/api/admin/designations?designationId=${encodeURIComponent(desigId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(result?.error || "Failed to delete designation");
      toast.success("Designation deleted successfully!");
      await onChanged();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error deleting designation:", message);
      toast.error(message || "Failed to delete designation");
    } finally {
      setDeletingId(null);
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
      const response = await fetch(`/api/admin/members/search?q=${encodeURIComponent(searchQuery.trim())}`, {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { profiles?: Profile[]; error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to search users");
      setSearchResults(payload?.profiles ?? []);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error searching users:", message);
      toast.error(message || "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedUser || !assignTarget) return;
    setAssigning(true);
    try {
      const response = await fetch("/api/admin/designations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: selectedUser.userId,
          designationId: assignTarget.$id,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; alreadyAssigned?: boolean } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to assign designation");
      toast.success(
        payload?.alreadyAssigned
          ? `${selectedUser.urn || selectedUser.userId} already holds "${assignTarget.name}".`
          : `Designation "${assignTarget.name}" assigned to ${selectedUser.urn || selectedUser.userId}!`
      );
      closeAssign();
      await onChanged();
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
      const [holdersResponse, profilesResponse] = await Promise.all([
        fetch(`/api/admin/designations/assign?designationId=${encodeURIComponent(desig.$id!)}`, {
          credentials: "include",
        }),
        fetch("/api/admin/users?limit=500", { credentials: "include" }),
      ]);
      const holdersPayload = (await holdersResponse.json().catch(() => null)) as { holders?: UserDesignation[]; error?: string } | null;
      const profilesPayload = (await profilesResponse.json().catch(() => null)) as { users?: Array<{ profile: Profile }> } | null;
      if (!holdersResponse.ok) throw new Error(holdersPayload?.error || "Failed to load holders");

      const profileByUser = new Map(
        (profilesPayload?.users ?? []).map((entry) => [entry.profile.userId, entry.profile]),
      );
      setHolders(
        (holdersPayload?.holders ?? []).map((holder) => ({
          ...holder,
          profile: profileByUser.get(holder.userId) ?? null,
        })),
      );
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error loading holders:", message);
      toast.error(message || "Failed to load designation holders");
    } finally {
      setLoadingHolders(false);
    }
  };

  const handleRevoke = async (userId: string) => {
    if (!revokeTarget) return;
    if (!confirm("Are you sure you want to revoke this designation?")) return;
    setRevokingUserId(userId);
    try {
      const response = await fetch(
        `/api/admin/designations/assign?userId=${encodeURIComponent(userId)}&designationId=${encodeURIComponent(revokeTarget.$id!)}`,
        { method: "DELETE", credentials: "include" },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Failed to revoke designation");
      toast.success("Designation revoked successfully!");
      setHolders((prev) => prev.filter((h) => h.userId !== userId));
      await onChanged();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error revoking designation:", message);
      toast.error(message || "Failed to revoke designation");
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

  return (
    <>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Designation Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Manage club designations, roles, and badges
          </p>
        </div>
        <Button
          onPress={open}
          className="bg-primary"
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
                      isPending={deletingId === desig.$id}
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
                    <h2 className="text-xl font-bold tracking-tight text-foreground">
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
                        <Select
                          fullWidth
                          value={formData.category}
                          onChange={(value) =>
                            setFormData({
                              ...formData,
                              category: String(value ?? "department") as Designation["category"],
                            })
                          }
                        >
                          <Label>Category</Label>
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              {["department", "operations", "executive", "special"].map((category) => (
                                <ListBox.Item key={category} id={category} textValue={category.charAt(0).toUpperCase() + category.slice(1)}>
                                  {category.charAt(0).toUpperCase() + category.slice(1)}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                            </ListBox>
                          </Select.Popover>
                        </Select>
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Level</label>
                        {/*
                          * Levels run 1–9. Level 10 used to be the reserved
                          * "everything" tier, which meant this field alone could
                          * confer full access; seniority now stops at 9 and the
                          * `admin`/`dev` tier comes only from a governance role.
                          * The bounds are enforced again on the server — a number
                          * input is a convenience, not a constraint.
                          */}
                        <Input
                          type="number"
                          min={1}
                          max={9}
                          placeholder="1"
                          value={formData.level.toString()}
                          onChange={(e: any) => {
                            const parsed = parseInt(e.target.value, 10);
                            const level = Number.isFinite(parsed) ? Math.min(9, Math.max(1, parsed)) : 1;
                            setFormData({ ...formData, level });
                          }}
                          required
                        />
                        <p className="text-xs text-default-400 mt-1">
                          1 is entry level, 9 is the most senior. Higher levels grant more oversight.
                        </p>
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
                      <label className="text-sm font-medium mb-1 block">Department (optional)</label>
                      <Select
                        fullWidth
                        aria-label="Linked department"
                        value={formData.departmentId || ""}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            departmentId: String(value ?? "") || undefined,
                          })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="" textValue="None">
                              None
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {departments.map((dept) => (
                              <ListBox.Item key={dept.$id} id={dept.$id!} textValue={dept.name}>
                                {dept.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <Switch
                      isSelected={formData.isActive}
                      onChange={(checked: any) =>
                        setFormData({ ...formData, isActive: checked })
                      }
                    >
                      <Switch.Content>
                        <Switch.Control>
                          <Switch.Thumb />
                        </Switch.Control>
                        Active
                      </Switch.Content>
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
                      className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
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
                      className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
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
    </>
  );
}
