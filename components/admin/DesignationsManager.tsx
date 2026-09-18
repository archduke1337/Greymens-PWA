// components/admin/DesignationsManager.tsx
"use client";

import { useMemo, useState, type ChangeEvent, type KeyboardEvent } from "react";
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

import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import MemberAvatar from "@/components/MemberAvatar";
import { CAPABILITIES } from "@/lib/capabilities";
import {
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Description,
  FieldError,
  Form,
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
  TextField,
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
  const [capabilityQuery, setCapabilityQuery] = useState("");

  // Assign modal state
  const { isOpen: isAssignOpen, open: openAssign, close: closeAssign } = useOverlayState();
  const [assignTarget, setAssignTarget] = useState<Designation | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [manualUserId, setManualUserId] = useState("");
  const [directoryUnavailable, setDirectoryUnavailable] = useState(false);
  const [assigning, setAssigning] = useState(false);

  /**
   * Member search posts to `/api/admin/members/search`, which requires
   * `users.view` — a capability this page's own gate (`designations.assign`)
   * does not imply. An operations_head can therefore administer titles without
   * being able to look members up, so the picker degrades to a pasted user ID
   * instead of dead-ending on a 403.
   */
  const assignUserId = selectedUser?.userId ?? manualUserId.trim();

  // Revoke state
  const { isOpen: isRevokeOpen, open: openRevoke, close: closeRevoke } = useOverlayState();
  const [revokeTarget, setRevokeTarget] = useState<Designation | null>(null);
  const [holders, setHolders] = useState<Array<UserDesignation & { profile?: Profile | null; holderName?: string }>>([]);
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
    capabilities: [],
    isActive: true,
    maxHolders: undefined,
  });

  const visibleCapabilities = useMemo(() => {
    const q = capabilityQuery.trim().toLowerCase();
    return q
      ? CAPABILITIES.filter((capability) => capability.toLowerCase().includes(q))
      : CAPABILITIES;
  }, [capabilityQuery]);

  const toggleCapability = (capability: string) =>
    setFormData((current) => {
      const selected = current.capabilities ?? [];
      return {
        ...current,
        capabilities: selected.includes(capability)
          ? selected.filter((item) => item !== capability)
          : [...selected, capability],
      };
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
      if (!response.ok) throw new Error(readApiError(result, "Failed to save designation"));

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
      capabilities: desig.capabilities ?? [],
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
      if (!response.ok) throw new Error(readApiError(result, "Failed to delete designation"));
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
    setManualUserId("");
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
      if (!response.ok) throw new Error(readApiError(payload, "Failed to search users"));
      setSearchResults(payload?.profiles ?? []);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error searching users:", message);
      if (/forbidden|403/i.test(message)) setDirectoryUnavailable(true);
      toast.error(message || "Failed to search users");
    } finally {
      setSearching(false);
    }
  };

  const handleAssign = async () => {
    if (!assignTarget || !assignUserId) return;
    setAssigning(true);
    try {
      const response = await fetch("/api/admin/designations/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          userId: assignUserId,
          designationId: assignTarget.$id,
        }),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string; alreadyAssigned?: boolean } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to assign designation"));
      const assignee = selectedUser?.urn || assignUserId;
      toast.success(
        payload?.alreadyAssigned
          ? `${assignee} already holds "${assignTarget.name}".`
          : `Designation "${assignTarget.name}" assigned to ${assignee}!`
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
      // Holders arrive joined with profiles and names: one call, no 500-row
      // directory over-fetch per click.
      const holdersResponse = await fetch(`/api/admin/designations/assign?designationId=${encodeURIComponent(desig.$id!)}`, {
        credentials: "include",
      });
      const holdersPayload = (await holdersResponse.json().catch(() => null)) as {
        holders?: Array<UserDesignation & { profile?: Profile | null }>;
        accountNames?: Record<string, string>;
        error?: string;
      } | null;
      if (!holdersResponse.ok) throw new Error(readApiError(holdersPayload, "Failed to load holders"));

      const names = holdersPayload?.accountNames ?? {};
      setHolders(
        (holdersPayload?.holders ?? []).map((holder) => ({
          ...holder,
          profile: holder.profile ?? null,
          holderName: names[holder.userId] || undefined,
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
      if (!response.ok) throw new Error(readApiError(payload, "Failed to revoke designation"));
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
      capabilities: [],
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

                  {/* Capabilities: empty means an honour with no authority */}
                  {desig.capabilities && desig.capabilities.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {desig.capabilities.map((capability) => (
                        <Chip key={capability} size="sm" className="text-xs font-mono">
                          {capability}
                        </Chip>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-default-400">Grants no capabilities</p>
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
          <ModalContainer size="lg">
            <ModalDialog>
              {({ close: dialogClose }: { close: () => void }) => (
                <Form validationBehavior="aria" onSubmit={handleSubmit}>
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
                    <TextField
                      isRequired
                      isDisabled={submitting}
                      name="name"
                      validate={(value) => {
                        const trimmed = value.trim();
                        if (!trimmed) return "Give the designation a name";
                        if (trimmed.length > 100) return "Keep the name under 100 characters";
                        return null;
                      }}
                      value={formData.name}
                      onChange={(value) => setFormData({ ...formData, name: value })}
                    >
                      <Label>Designation Name</Label>
                      <Input
                        maxLength={100}
                        placeholder="e.g., Head of Web Development"
                      />
                      <FieldError />
                    </TextField>

                    <TextField
                      isDisabled={submitting}
                      name="description"
                      validate={(value) =>
                        value.length > 2000 ? "Keep the description under 2000 characters" : null
                      }
                      value={formData.description}
                      onChange={(value) => setFormData({ ...formData, description: value })}
                    >
                      <Label>Description</Label>
                      <TextArea
                        maxLength={2000}
                        placeholder="What does this designation entail?"
                        rows={3}
                      />
                      <FieldError />
                    </TextField>

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
                        {/*
                          * Levels run 1–9. Level 10 used to be the reserved
                          * "everything" tier, which meant this field alone could
                          * confer full access; seniority now stops at 9 and the
                          * `admin`/`dev` tier comes only from a governance role.
                          * The bounds are enforced again on the server — a number
                          * input is a convenience, not a constraint.
                          */}
                        <TextField
                          isRequired
                          isDisabled={submitting}
                          name="level"
                          type="number"
                          validate={(value) => {
                            const parsed = Number(value);
                            return Number.isInteger(parsed) && parsed >= 1 && parsed <= 9
                              ? null
                              : "Level must be a whole number between 1 and 9";
                          }}
                          value={formData.level.toString()}
                          onChange={(value) => {
                            const parsed = parseInt(value, 10);
                            const level = Number.isFinite(parsed) ? Math.min(9, Math.max(1, parsed)) : 1;
                            setFormData({ ...formData, level });
                          }}
                        >
                          <Label>Level</Label>
                          <Input max={9} min={1} placeholder="1" type="number" />
                          <Description>
                            1 is entry level, 9 is the most senior.
                          </Description>
                          <FieldError />
                        </TextField>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <TextField
                        isDisabled={submitting}
                        name="badgeIcon"
                        validate={(value) =>
                          value.length > 100 ? "Keep the badge icon under 100 characters" : null
                        }
                        value={formData.badgeIcon}
                        onChange={(value) => setFormData({ ...formData, badgeIcon: value })}
                      >
                        <Label>Badge Icon</Label>
                        <Input maxLength={100} placeholder="Emoji or text" />
                        <FieldError />
                      </TextField>

                      <div className="flex items-center gap-2">
                        <Label className="text-sm font-medium" htmlFor="desig-badge-color">Badge Color</Label>
                        <input
                          id="desig-badge-color"
                          type="color"
                          value={formData.badgeColor || "#6366f1"}
                          onChange={(e) =>
                            setFormData({ ...formData, badgeColor: e.target.value })
                          }
                          disabled={submitting}
                          className="w-10 h-10 rounded-lg border border-default-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    <TextField
                      isDisabled={submitting}
                      name="maxHolders"
                      type="number"
                      validate={(value) => {
                        if (!value.trim()) return null;
                        const parsed = Number(value);
                        return Number.isInteger(parsed) && parsed >= 1
                          ? null
                          : "Holder limit must be a whole number of at least 1";
                      }}
                      value={formData.maxHolders?.toString() ?? ""}
                      onChange={(value) =>
                        setFormData({
                          ...formData,
                          maxHolders: value
                            ? (() => {
                                const parsed = parseInt(value, 10);
                                return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
                              })()
                            : undefined,
                        })
                      }
                    >
                      <Label>Max Holders (optional)</Label>
                      <Input
                        min={1}
                        placeholder="Leave empty for unlimited"
                        type="number"
                      />
                      <Description>Leave empty for unlimited.</Description>
                      <FieldError />
                    </TextField>

                    <div>
                      <Select
                        fullWidth
                        value={formData.departmentId || ""}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            departmentId: String(value ?? "") || undefined,
                          })
                        }
                      >
                        <Label>Department (optional)</Label>
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

                    <fieldset className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <legend className="text-sm font-medium">Capabilities (optional)</legend>
                        <Input
                          className="max-w-52"
                          placeholder="Filter capabilities..."
                          aria-label="Filter capabilities"
                          value={capabilityQuery}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setCapabilityQuery(e.target.value)}
                        />
                      </div>
                      <p className="text-xs text-default-400">
                        A title grants nothing unless listed here. Anything you add is checked
                        against the capabilities you hold yourself, and it appears in the Access
                        console alongside roles, offices and powers.
                      </p>
                      <div className="grid max-h-56 gap-1.5 overflow-y-auto rounded-lg border border-default-200 p-3 sm:grid-cols-2">
                        {visibleCapabilities.map((capability) => (
                          <Checkbox
                            key={capability}
                            isSelected={(formData.capabilities ?? []).includes(capability)}
                            onChange={() => toggleCapability(capability)}
                          >
                            <Checkbox.Content>
                              <Checkbox.Control>
                                <Checkbox.Indicator />
                              </Checkbox.Control>
                              <span className="text-xs font-mono">{capability}</span>
                            </Checkbox.Content>
                          </Checkbox>
                        ))}
                        {visibleCapabilities.length === 0 && (
                          <p className="text-xs text-default-400">No capability matches “{capabilityQuery}”.</p>
                        )}
                      </div>
                    </fieldset>

                    <Switch
                      isSelected={formData.isActive}
                      onChange={(checked: boolean) =>
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
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onPress={resetForm}
                    >
                      Cancel
                    </Button>
                    <Button
                      className="w-full sm:w-auto bg-primary text-primary-foreground font-semibold transition-opacity hover:opacity-90"
                      isDisabled={submitting}
                      isPending={submitting}
                      type="submit"
                    >
                      {editingDesig
                        ? "Update Designation"
                        : "Create Designation"}
                    </Button>
                  </ModalFooter>
                </Form>
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
                    {/* Search, or a pasted ID when the directory is refused */}
                    {directoryUnavailable ? (
                      <div className="space-y-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
                        <p className="text-xs text-amber-200">
                          Member search needs the users.view capability, which this
                          account does not hold. Paste the member&apos;s user ID
                          instead.
                        </p>
                        <Input
                          placeholder="Appwrite user ID"
                          aria-label="Member user ID"
                          value={manualUserId}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setManualUserId(e.target.value)}
                        />
                      </div>
                    ) : (
                      <div className="flex gap-2">
                        <Input
                          placeholder="Search by URN, branch, or userId..."
                          value={searchQuery}
                          onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                          onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
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
                    )}

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
                            <MemberAvatar
                              src={profile.avatar}
                              name={profile.urn || profile.userId}
                              className="w-8 h-8 text-xs font-bold flex-shrink-0"
                            />
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
                    {assignUserId && (
                      <div className="p-3 bg-primary/10 border border-primary/30 rounded-lg">
                        <p className="text-sm font-semibold">Selected:</p>
                        <p className="text-sm">
                          {selectedUser?.urn || assignUserId}
                        </p>
                      </div>
                    )}
                  </ModalBody>

                  <ModalFooter className="border-t pt-4">
                    <Button
                      variant="secondary"
                      className="w-full sm:w-auto"
                      onPress={closeAssign}
                    >
                      Cancel
                    </Button>
                    <Button
                      isPending={assigning}
                      isDisabled={!assignUserId}
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
                              <MemberAvatar
                                src={holder.profile?.avatar}
                                name={holder.holderName || holder.profile?.urn || holder.userId}
                                className="w-8 h-8 text-xs font-bold flex-shrink-0"
                              />
                              <div>
                                <p className="text-sm font-medium">
                                  {holder.holderName || holder.profile?.urn || holder.userId}
                                </p>
                                <p className="text-xs text-default-400">
                                  {holder.holderName && holder.profile?.urn ? `${holder.profile.urn} · ` : ""}
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
                      variant="secondary"
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
