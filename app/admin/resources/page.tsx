"use client";

import { useEffect, useState, useCallback } from "react";
import { readApiError } from "@/lib/errorHandler";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import type { Resource, Department } from "@/lib/types";
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
  useOverlayState,
} from "@heroui/react";
import {
  FileText,
  Link as LinkIcon,
  Video,
  FolderOpen,
  Bell,
  Plus,
  Search,
  Trash2,
  Edit,
  Loader2,
} from "lucide-react";

const RESOURCE_TYPES = [
  { value: "document", label: "Document", icon: FileText },
  { value: "link", label: "Link", icon: LinkIcon },
  { value: "video", label: "Video", icon: Video },
  { value: "file", label: "File", icon: FolderOpen },
  // NOTE: no "announcement" option — the server allowlist is
  // document/link/video/file and rejects anything else.
] as const;

const LAYERS = [
  { value: "common", label: "Common Library" },
  { value: "department", label: "Department" },
  { value: "role", label: "Role-Specific" },
] as const;

export default function AdminResourcesPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [resources, setResources] = useState<Resource[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [layerFilter, setLayerFilter] = useState<string>("all");
  const { isOpen, open, close } = useOverlayState();
  const [editTarget, setEditTarget] = useState<Resource | null>(null);
  const [saving, setSaving] = useState(false);
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
    tags: "",
  });

  const loadData = useCallback(async () => {
    try {
      const [resourceResponse, departmentResponse] = await Promise.all([
        fetch("/api/resources?all=true", { credentials: "include" }),
        fetch("/api/departments", { credentials: "include" }),
      ]);
      if (!resourceResponse.ok || !departmentResponse.ok) throw new Error("Unable to load resource data");
      const resourcePayload = (await resourceResponse.json()) as { resources?: Resource[] };
      const departmentPayload = (await departmentResponse.json()) as { departments?: Department[] };
      setResources(resourcePayload.resources ?? []);
      setDepartments(departmentPayload.departments ?? []);
    } catch (error) {
      console.error("Error loading resources:", error);
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
        departmentId: form.layer === "department" ? form.departmentId || undefined : null,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        // Never flip activation as a side effect of editing metadata.
        isActive: editTarget?.$id ? (editTarget.isActive ?? true) : true,
      };

      const response = await fetch("/api/resources", {
        method: editTarget?.$id ? "PATCH" : "POST",
        // PATCH sends JSON; POST sends FormData, so the browser must set the
        // multipart boundary itself — a manual Content-Type would corrupt it.
        headers: editTarget?.$id ? { "Content-Type": "application/json" } : undefined,
        credentials: "include",
        body: editTarget?.$id
          ? JSON.stringify({ resourceId: editTarget.$id, ...data })
          : (() => {
              const formData = new FormData();
              Object.entries(data).forEach(([key, value]) => {
                if (Array.isArray(value)) formData.set(key, value.join(","));
                else if (value !== undefined && value !== null) formData.set(key, String(value));
              });
              if (file) formData.set("file", file);
              return formData;
            })(),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to save resource"));
      toast.success(editTarget ? "Resource updated" : "Resource created");

      close();
      setEditTarget(null);
      setForm({ title: "", description: "", type: "document", url: "", layer: "common", departmentId: "", tags: "" });
      await loadData();
    } catch (error) {
      console.error("Error saving resource:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save resource");
    } finally {
      setSaving(false);
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
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Unable to delete resource"));
      toast.success("Resource deleted");
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete resource");
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
      tags: resource.tags?.join(", ") || "",
    });
    open();
  };

  const openCreate = () => {
    setEditTarget(null);
    setFile(null);
    setForm({ title: "", description: "", type: "document", url: "", layer: "common", departmentId: "", tags: "" });
    open();
  };

  const filtered = resources.filter((r) => {
    const matchesLayer = layerFilter === "all" || r.layer === layerFilter;
    const matchesSearch =
      !searchQuery ||
      r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesLayer && matchesSearch;
  });

  const getTypeIcon = (type: string) => {
    const found = RESOURCE_TYPES.find((t) => t.value === type);
    return found ? found.icon : FileText;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="animate-spin h-10 w-10 text-primary" />
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
        </div>          <Button variant="primary" onPress={openCreate}>
          <Plus className="w-4 h-4" />
          Add Resource
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-none shadow-md mb-6">
        <CardContent className="p-4">
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
                variant={layerFilter === "all" ? "primary" : "ghost"}
                size="sm"
                onPress={() => setLayerFilter("all")}
              >
                All
              </Button>
              {LAYERS.map((l) => (
                <Button
                  key={l.value}
                  variant={layerFilter === l.value ? "primary" : "ghost"}
                  size="sm"
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
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-default-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No resources found</h3>
            <p className="text-default-500">
              {searchQuery ? "Try a different search" : "Create your first resource"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((resource) => {
            const TypeIcon = getTypeIcon(resource.type);
            return (
              <Card key={resource.$id} className="border-none shadow-md">
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{resource.title}</h3>
                    {resource.description && (
                      <p className="text-sm text-default-500 truncate">{resource.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Chip size="sm" variant="soft">{resource.type}</Chip>
                      <Chip size="sm" variant="soft" color="accent">{resource.layer}</Chip>
                      {resource.layer === "department" && resource.departmentId && (
                        <Chip size="sm" variant="soft">
                          {departments.find((d) => d.$id === resource.departmentId)?.name || "Unknown department"}
                        </Chip>
                      )}
                      {resource.tags?.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="sm" variant="soft" color="accent">{tag}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onPress={() => openEdit(resource)} isIconOnly>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="danger-soft" onPress={() => handleDelete(resource)} isPending={deletingId === resource.$id} isIconOnly>
                      <Trash2 className="w-4 h-4" />
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
        <ModalBackdrop isOpen={isOpen} onOpenChange={(o) => { if (!o) close(); }}>
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>{editTarget ? "Edit Resource" : "Create Resource"}</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-1 block">Title</label>
                    <Input
                      placeholder="Resource title"
                      value={form.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">Description</label>
                    <TextArea
                      placeholder="Brief description"
                      value={form.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setForm((p) => ({ ...p, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Select
                        fullWidth
                        value={form.type}
                        onChange={(value) => setForm((p) => ({ ...p, type: String(value ?? form.type) as Resource["type"] }))}
                      >
                        <Label>Type</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {RESOURCE_TYPES.map((t) => (
                              <ListBox.Item key={t.value} id={t.value} textValue={t.label}>
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
                        onChange={(value) => setForm((p) => ({ ...p, layer: String(value ?? form.layer) as Resource["layer"] }))}
                      >
                        <Label>Layer</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {LAYERS.map((l) => (
                              <ListBox.Item key={l.value} id={l.value} textValue={l.label}>
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
                        value={form.departmentId === "" ? null : form.departmentId}
                        onChange={(value) => setForm((p) => ({ ...p, departmentId: String(value ?? "") }))}
                      >
                        <Label>Department</Label>
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            {departments.map((d) => (
                              <ListBox.Item key={d.$id} id={d.$id} textValue={d.name}>
                                {d.name}
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">URL</label>
                    <Input
                      placeholder="https://..."
                      value={form.url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, url: e.target.value }))}
                    />
                  </div>
                  {!editTarget?.$id && (
                    <div>
                      <label htmlFor="resource-file" className="text-sm font-medium mb-1 block">
                        Or attach a file <span className="font-normal text-default-400">(create only, max 50MB)</span>
                      </label>
                      <input
                        id="resource-file"
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                        className="block w-full text-sm text-default-600 file:mr-3 file:rounded-lg file:border file:border-default-300 file:bg-default-100 file:px-3 file:py-1.5 file:text-sm file:font-medium"
                      />
                      {file && (
                        <p className="text-xs text-default-500 mt-1">
                          {file.name} ({Math.round(file.size / 1024)} KB)
                        </p>
                      )}
                    </div>
                  )}
                  <div>
                    <label className="text-sm font-medium mb-1 block">Tags (comma separated)</label>
                    <Input
                      placeholder="tag1, tag2, tag3"
                      value={form.tags}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setForm((p) => ({ ...p, tags: e.target.value }))}
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={close}>Cancel</Button>                    <Button
                    variant="primary"
                    onPress={handleSave}
                    isPending={saving}
                  >
                  {editTarget ? "Update" : "Create"}
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
