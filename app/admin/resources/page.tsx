"use client";

import type { Resource, Department } from "@/lib/types";

import { useRouter } from "next/navigation";
import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  ListBox,
  Select,
  TextArea,
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
import {
  FileText,
  Link as LinkIcon,
  Video,
  FolderOpen,
  Newspaper,
  Plus,
  Trash2,
  Edit,
  CheckCircle,
  XCircle,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";
import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

const RESOURCE_TYPES = [
  { value: "document", label: "Document", icon: FileText },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "file", label: "File", icon: FolderOpen },
  { value: "newsletter", label: "Newsletter", icon: Newspaper },
  // NOTE: no "announcement" option — the legacy type survives in stored rows
  // and the public list, but new uploads are document/link/video/file/
  // newsletter and the server allowlist rejects anything else.
] as const;

type StatusTab = "pending" | "approved" | "rejected";

// Rows written before moderation existed carry no status — read them as
// approved everywhere the console groups by status.
function resourceStatus(resource: Resource): StatusTab {
  if (resource.status === "pending" || resource.status === "rejected")
    return resource.status;

  return "approved";
}

const LAYERS = [
  { value: "common", label: "Common Library" },
  { value: "department", label: "Department" },
  { value: "role", label: "Role-Specific" },
] as const;

// Role-gated visibility is an exact status match ("Leads" does not include
// "Heads") — mirror the server's MEMBER_STATUSES vocabulary one-to-one so the
// form cannot submit a value the API would reject.
const ROLE_OPTIONS = [
  { value: "member", label: "Members" },
  { value: "core_member", label: "Core members" },
  { value: "lead", label: "Leads" },
  { value: "head", label: "Heads" },
  { value: "admin", label: "Admins" },
  { value: "dev", label: "Developers" },
] as const;

export default function AdminResourcesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<StatusTab>("pending");
  const { isOpen, open, close } = useOverlayState();
  const {
    isOpen: isRejectOpen,
    open: openReject,
    close: closeReject,
  } = useOverlayState();
  const [editTarget, setEditTarget] = useState<Resource | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Resource | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Create-only attachment: PATCH edits metadata, the upload lane is POST.
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: "document" as Resource["type"],
    url: "",
    layer: "common" as Resource["layer"],
    departmentId: "",
    requiredRole: "",
    tags: "",
  });

  const loadData = useCallback(async () => {
    try {
      // The review queue lives behind resources.manage — the same gate the
      // approve/reject actions require — so a manager who can see this page
      // can act on everything it lists.
      const [resourceResponse, departmentResponse] = await Promise.all([
        fetch("/api/admin/resources", { credentials: "include" }),
        fetch("/api/departments", { credentials: "include" }),
      ]);

      if (!resourceResponse.ok || !departmentResponse.ok)
        throw new Error("Unable to load resource data");
      const resourcePayload = (await resourceResponse.json()) as {
        resources?: Resource[];
      };
      const departmentPayload = (await departmentResponse.json()) as {
        departments?: Department[];
      };

      setResources(resourcePayload.resources ?? []);
      setDepartments(departmentPayload.departments ?? []);
    } catch (error) {
      logError("Error loading resources:", error);
      toast.error("Failed to load resources");
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

  const handleSave = async () => {
    if (!user) return;
    if (!form.title.trim()) {
      toast.error("Title is required");

      return;
    }
    if (form.layer === "department" && !form.departmentId) {
      toast.error("Choose the department this resource belongs to");

      return;
    }
    if (form.layer === "role" && !form.requiredRole) {
      toast.error("Choose which members can see this resource");

      return;
    }
    const url = form.url.trim();

    // The server requires a URL or an uploaded file on create, and the
    // modal previously offered neither check nor picker — every URL-less
    // create 400d. File uploads only exist on the create lane.
    if (!editTarget?.$id && !url && !file) {
      toast.error("Add a URL or attach a file");

      return;
    }
    if (url) {
      try {
        const parsed = new URL(url);

        if (!["http:", "https:"].includes(parsed.protocol)) throw new Error();
      } catch {
        toast.error("URL must start with http(s)://");

        return;
      }
    }
    setSaving(true);
    try {
      const data = {
        title: form.title.trim(),
        description: form.description,
        type: form.type,
        url: url || undefined,
        layer: form.layer,
        // Explicit null clears a previously linked department; undefined
        // would be dropped from the JSON and the old link would persist.
        departmentId:
          form.layer === "department" ? form.departmentId || undefined : null,
        // Role-gated visibility compares an exact status. Clearing the field
        // (or leaving the role layer) must clear the stored value, otherwise
        // an old requiredRole would keep hiding the resource.
        requiredRole: form.layer === "role" ? form.requiredRole || null : null,
        tags: form.tags
          ? form.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean)
          : [],
        // Never flip activation as a side effect of editing metadata.
        isActive: editTarget?.$id ? (editTarget.isActive ?? true) : true,
      };

      const response = await fetch("/api/resources", {
        method: editTarget?.$id ? "PATCH" : "POST",
        // PATCH sends JSON; POST sends FormData, so the browser must set the
        // multipart boundary itself — a manual Content-Type would corrupt it.
        headers: editTarget?.$id
          ? { "Content-Type": "application/json" }
          : undefined,
        credentials: "include",
        body: editTarget?.$id
          ? JSON.stringify({ resourceId: editTarget.$id, ...data })
          : (() => {
              const formData = new FormData();

              Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) formData.set(key, value.join(","));
                else if (value !== undefined && value !== null)
                  formData.set(key, String(value));
              });
              if (file) formData.set("file", file);

              return formData;
            })(),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to save resource"));
      toast.success(editTarget ? "Resource updated" : "Resource created");

      close();
      setEditTarget(null);
      setForm({
        title: "",
        description: "",
        type: "document",
        url: "",
        layer: "common",
        departmentId: "",
        requiredRole: "",
        tags: "",
      });
      await loadData();
    } catch (error) {
      logError("Error saving resource:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to save resource",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (resource: Resource) => {
    if (!user || !resource.$id) return;
    setApprovingId(resource.$id);
    try {
      const response = await fetch("/api/admin/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceId: resource.$id, action: "approve" }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to approve resource"));
      toast.success(
        resourceStatus(resource) === "rejected"
          ? "Resource re-approved"
          : "Resource approved",
      );
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to approve resource",
      );
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async () => {
    if (!user || !rejectTarget?.$id || !rejectReason.trim()) return;
    setRejecting(true);
    try {
      const response = await fetch("/api/admin/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          resourceId: rejectTarget.$id,
          action: "reject",
          reason: rejectReason.trim(),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to reject resource"));
      toast.success("Resource rejected");
      closeReject();
      setRejectTarget(null);
      setRejectReason("");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reject resource",
      );
    } finally {
      setRejecting(false);
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!resource.$id) return;
    if (!window.confirm(`Delete "${resource.title}"?`)) return;
    setDeletingId(resource.$id);
    try {
      const response = await fetch("/api/resources", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ resourceId: resource.$id }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to delete resource"));
      toast.success("Resource deleted");
      await loadData();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to delete resource",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const openEdit = (resource: Resource) => {
    setEditTarget(resource);
    setFile(null);
    setForm({
      title: resource.title,
      description: resource.description || "",
      type: resource.type,
      url: resource.url || "",
      layer: resource.layer,
      departmentId: resource.departmentId || "",
      requiredRole: resource.requiredRole || "",
      tags: resource.tags?.join(", ") || "",
    });
    open();
  };

  const openCreate = () => {
    setEditTarget(null);
    setFile(null);
    setForm({
      title: "",
      description: "",
      type: "document",
      url: "",
      layer: "common",
      departmentId: "",
      requiredRole: "",
      tags: "",
    });
    open();
  };

  const counts = {
    pending: resources.filter((r) => resourceStatus(r) === "pending").length,
    approved: resources.filter((r) => resourceStatus(r) === "approved").length,
    rejected: resources.filter((r) => resourceStatus(r) === "rejected").length,
  };

  const filtered = resources.filter((r) => {
    const matchesTab = resourceStatus(r) === activeTab;
    const matchesLayer = layerFilter === "all" || r.layer === layerFilter;
    const matchesSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesTab && matchesLayer && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    const found = RESOURCE_TYPES.find((t) => t.value === type);

    return found ? found.icon : FileText;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div aria-label="Loading resources" role="status">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Resource Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Manage club resources across departments and roles
          </p>
        </div>{" "}
        <Button variant="primary" onPress={openCreate}>
          <Plus aria-hidden="true" className="w-4 h-4" />
          Add Resource
        </Button>
      </div>

      {/* Review queue tabs + filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div
            aria-label="Filter by review status"
            className="flex flex-wrap gap-2 mb-4"
            role="group"
          >
            {(["pending", "approved", "rejected"] as StatusTab[]).map((tab) => (
              <Button
                key={tab}
                size="sm"
                variant={activeTab === tab ? "primary" : "secondary"}
                onPress={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
                {counts[tab] > 0 && (
                  <Chip
                    className="ml-1 tabular-nums"
                    color={
                      tab === "approved"
                        ? "success"
                        : tab === "rejected"
                          ? "danger"
                          : "warning"
                    }
                    size="sm"
                    variant="soft"
                  >
                    {counts[tab]}
                  </Chip>
                )}
              </Button>
            ))}
          </div>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Input
                placeholder="Search resources..."
                value={searchQuery}
                onChange={(e: any) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button
                key="all"
                size="sm"
                variant={layerFilter === "all" ? "primary" : "secondary"}
                onPress={() => setLayerFilter("all")}
              >
                All
              </Button>
              {LAYERS.map((l) => (
                <Button
                  key={l.value}
                  size="sm"
                  variant={layerFilter === l.value ? "primary" : "secondary"}
                  onPress={() => setLayerFilter(l.value)}
                >
                  {l.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resources List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <FileText
              aria-hidden="true"
              className="w-16 h-16 text-default-300 mx-auto mb-4"
            />
            <h3 className="text-lg font-semibold mb-2">
              No {activeTab} resources
            </h3>
            <p className="text-default-500">
              {searchQuery || layerFilter !== "all"
                ? "Try a different search or filter"
                : activeTab === "pending"
                  ? "All caught up — nothing awaiting review"
                  : `No ${activeTab} resources yet`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((resource) => {
            const TypeIcon = getTypeIcon(resource.type);

            return (
              <Card key={resource.$id}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <TypeIcon
                      aria-hidden="true"
                      className="w-5 h-5 text-primary"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{resource.title}</h3>
                    {resource.uploadedByName && (
                      <p className="text-xs text-default-500">
                        Shared by {resource.uploadedByName}
                      </p>
                    )}
                    {resource.description && (
                      <p className="text-sm text-default-500 truncate">
                        {resource.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Chip
                        color={
                          resourceStatus(resource) === "approved"
                            ? "success"
                            : resourceStatus(resource) === "rejected"
                              ? "danger"
                              : "warning"
                        }
                        size="sm"
                        variant="soft"
                      >
                        {resourceStatus(resource)}
                      </Chip>
                      <Chip size="sm" variant="soft">
                        {resource.type}
                      </Chip>
                      <Chip color="accent" size="sm" variant="soft">
                        {resource.layer}
                      </Chip>
                      {resource.layer === "department" &&
                        resource.departmentId && (
                          <Chip size="sm" variant="soft">
                            {departments.find(
                              (d) => d.$id === resource.departmentId,
                            )?.name || "Unknown department"}
                          </Chip>
                        )}
                      {resource.layer === "role" && resource.requiredRole && (
                        <Chip size="sm" variant="soft">
                          {ROLE_OPTIONS.find(
                            (r) => r.value === resource.requiredRole,
                          )?.label || resource.requiredRole}
                        </Chip>
                      )}
                      {resource.tags?.slice(0, 3).map((tag) => (
                        <Chip key={tag} color="accent" size="sm" variant="soft">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                    {resourceStatus(resource) === "rejected" &&
                      resource.rejectionReason && (
                        <p className="text-xs text-danger mt-1">
                          Rejected: {resource.rejectionReason}
                        </p>
                      )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {resourceStatus(resource) !== "approved" && (
                      <Button
                        isIconOnly
                        aria-label={`Approve ${resource.title}`}
                        isPending={approvingId === resource.$id}
                        size="sm"
                        variant="primary"
                        onPress={() => handleApprove(resource)}
                      >
                        <CheckCircle aria-hidden="true" className="w-4 h-4" />
                      </Button>
                    )}
                    {resourceStatus(resource) === "pending" && (
                      <Button
                        isIconOnly
                        aria-label={`Reject ${resource.title}`}
                        size="sm"
                        variant="danger-soft"
                        onPress={() => {
                          setRejectTarget(resource);
                          setRejectReason("");
                          openReject();
                        }}
                      >
                        <XCircle aria-hidden="true" className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      isIconOnly
                      aria-label={`Edit ${resource.title}`}
                      size="sm"
                      variant="secondary"
                      onPress={() => openEdit(resource)}
                    >
                      <Edit aria-hidden="true" className="w-4 h-4" />
                    </Button>
                    <Button
                      isIconOnly
                      aria-label={`Delete ${resource.title}`}
                      isPending={deletingId === resource.$id}
                      size="sm"
                      variant="danger-soft"
                      onPress={() => handleDelete(resource)}
                    >
                      <Trash2 aria-hidden="true" className="w-4 h-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(o) => {
            if (!o) close();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>
                {editTarget ? "Edit Resource" : "Create Resource"}
              </ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Title{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <Input
                      required
                      placeholder="Resource title"
                      value={form.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Description{" "}
                      <span className="font-normal text-default-400">
                        (optional)
                      </span>
                    </label>
                    <TextArea
                      placeholder="Brief description"
                      rows={2}
                      value={form.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setForm((p) => ({ ...p, description: e.target.value }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Select
                        fullWidth
                        value={form.type}
                        onChange={(value) =>
                          setForm((p) => ({
                            ...p,
                            type: String(
                              value ?? form.type,
                            ) as Resource["type"],
                          }))
                        }
                      >
                        <Label>
                          Type{" "}
                          <span aria-hidden="true" className="text-danger">
                            *
                          </span>
                        </Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {RESOURCE_TYPES.map((t) => (
                              <ListBox.Item
                                key={t.value}
                                id={t.value}
                                textValue={t.label}
                              >
                                {t.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                    <div>
                      <Select
                        fullWidth
                        value={form.layer}
                        onChange={(value) =>
                          setForm((p) => ({
                            ...p,
                            layer: String(
                              value ?? form.layer,
                            ) as Resource["layer"],
                          }))
                        }
                      >
                        <Label>
                          Layer{" "}
                          <span aria-hidden="true" className="text-danger">
                            *
                          </span>
                        </Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {LAYERS.map((l) => (
                              <ListBox.Item
                                key={l.value}
                                id={l.value}
                                textValue={l.label}
                              >
                                {l.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  </div>
                  {form.layer === "department" && (
                    <div>
                      <Select
                        fullWidth
                        placeholder="Select department"
                        value={
                          form.departmentId === "" ? null : form.departmentId
                        }
                        onChange={(value) =>
                          setForm((p) => ({
                            ...p,
                            departmentId: String(value ?? ""),
                          }))
                        }
                      >
                        <Label>
                          Department{" "}
                          <span aria-hidden="true" className="text-danger">
                            *
                          </span>
                        </Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {departments.map((d) => (
                              <ListBox.Item
                                key={d.$id}
                                id={d.$id}
                                textValue={d.name}
                              >
                                {d.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  )}
                  {form.layer === "role" && (
                    <div>
                      <Select
                        fullWidth
                        placeholder="Select who can see this"
                        value={
                          form.requiredRole === "" ? null : form.requiredRole
                        }
                        onChange={(value) =>
                          setForm((p) => ({
                            ...p,
                            requiredRole: String(value ?? ""),
                          }))
                        }
                      >
                        <Label>
                          Visible only to{" "}
                          <span aria-hidden="true" className="text-danger">
                            *
                          </span>
                        </Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {ROLE_OPTIONS.map((r) => (
                              <ListBox.Item
                                key={r.value}
                                id={r.value}
                                textValue={r.label}
                              >
                                {r.label}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                      <p className="text-xs text-default-500 mt-1">
                        Exact status match — Leads does not include Heads.
                      </p>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      URL{" "}
                      {!editTarget?.$id && (
                        <span className="font-normal text-default-400">
                          (required unless a file is attached)
                        </span>
                      )}
                    </label>
                    <Input
                      placeholder="https://..."
                      value={form.url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({ ...p, url: e.target.value }))
                      }
                    />
                  </div>
                  {!editTarget?.$id && (
                    <div>
                      <label
                        className="text-sm font-medium mb-1 block"
                        htmlFor="resource-file"
                      >
                        Or attach a file{" "}
                        <span className="font-normal text-default-400">
                          (create only, max 50MB — required unless a URL is
                          given)
                        </span>
                      </label>
                      <input
                        className="block w-full text-sm text-default-600 file:mr-3 file:rounded-lg file:border file:border-default-300 file:bg-default-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                        id="resource-file"
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                      />
                      {file && (
                        <p className="text-xs text-default-500 mt-1">
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Tags{" "}
                      <span className="font-normal text-default-400">
                        (optional, comma separated)
                      </span>
                    </label>
                    <Input
                      placeholder="tag1, tag2, tag3"
                      value={form.tags}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({ ...p, tags: e.target.value }))
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>{" "}
                <Button
                  isPending={saving}
                  variant="primary"
                  onPress={handleSave}
                >
                  {editTarget ? "Update" : "Create"}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>

      {/* Reject Modal */}
      <Modal>
        <ModalBackdrop
          isOpen={isRejectOpen}
          onOpenChange={(o) => {
            if (!o) {
              closeReject();
              setRejectTarget(null);
              setRejectReason("");
            }
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Reject Resource</ModalHeader>
              <ModalBody>
                <p className="text-sm text-default-500">
                  Provide a reason for rejecting &quot;{rejectTarget?.title}
                  &quot; — the submitter sees this.
                </p>
                <div>
                  <label className="text-sm font-medium mb-1 block">
                    Rejection reason{" "}
                    <span aria-hidden="true" className="text-danger">
                      *
                    </span>
                  </label>
                  <Input
                    placeholder="Why is this being rejected?"
                    value={rejectReason}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRejectReason(e.target.value)
                    }
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={closeReject}>
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
