"use client";

import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { resourceService } from "@/lib/resources";
import { departmentService } from "@/lib/departments";
import { auditService } from "@/lib/audit";
import type { Resource, Department } from "@/lib/types";
import { toast } from "sonner";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
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
  { value: "announcement", label: "Announcement", icon: Bell },
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
      const [allResources, allDepts] = await Promise.all([
        resourceService.getAll(),
        departmentService.getAll(),
      ]);
      setResources(allResources);
      setDepartments(allDepts);
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
    if (!authLoading && user && (user.prefs as Record<string, unknown>)?.role !== "admin") {
      router.push("/unauthorized");
      return;
    }
    loadData();
  }, [user, authLoading, router, loadData]);

  const handleSave = async () => {
    if (!user) return;
    if (!form.title) {
      toast.error("Title is required");
      return;
    }
    try {
      const data = {
        title: form.title,
        description: form.description,
        type: form.type,
        url: form.url || undefined,
        layer: form.layer,
        departmentId: form.layer === "department" ? form.departmentId || undefined : undefined,
        tags: form.tags ? form.tags.split(",").map((t) => t.trim()).filter(Boolean) : [],
        uploadedBy: user.$id,
        isActive: true,
      };

      if (editTarget?.$id) {
        await resourceService.update(editTarget.$id, data);
        toast.success("Resource updated");
      } else {
        await resourceService.create(data);
        toast.success("Resource created");
      }

      await auditService.log({
        actorId: user.$id,
        actorName: user.name || "Admin",
        actorRole: "admin",
        action: editTarget ? "resource.update" : "resource.create",
        entityType: "resource",
        entityId: editTarget?.$id || "new",
        details: { title: form.title },
        timestamp: new Date().toISOString(),
      });

      close();
      setEditTarget(null);
      setForm({ title: "", description: "", type: "document", url: "", layer: "common", departmentId: "", tags: "" });
      await loadData();
    } catch (error) {
      console.error("Error saving resource:", error);
      toast.error("Failed to save resource");
    }
  };

  const handleDelete = async (resource: Resource) => {
    if (!resource.$id) return;
    if (!window.confirm(`Delete "${resource.title}"?`)) return;
    try {
      await resourceService.delete(resource.$id);
      toast.success("Resource deleted");
      await loadData();
    } catch {
      toast.error("Failed to delete resource");
    }
  };

  const openEdit = (resource: Resource) => {
    setEditTarget(resource);
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
        <Loader2 className="animate-spin h-10 w-10 text-purple-500" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto py-6 md:py-8 px-4 md:px-6">
      <div className="flex items-start justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Resource Management
          </h1>
          <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
            Manage club resources across departments and roles
          </p>
        </div>
        <Button variant="primary" onPress={openCreate} startContent={<Plus className="w-4 h-4" />}>
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
                onValueChange={setSearchQuery}
                startContent={<Search className="w-4 h-4 text-default-400" />}
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
                  <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="w-5 h-5 text-purple-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{resource.title}</h3>
                    {resource.description && (
                      <p className="text-sm text-default-500 truncate">{resource.description}</p>
                    )}
                    <div className="flex items-center gap-2 mt-1">
                      <Chip size="sm" variant="soft">{resource.type}</Chip>
                      <Chip size="sm" variant="soft" color="accent">{resource.layer}</Chip>
                      {resource.tags?.slice(0, 3).map((tag) => (
                        <Chip key={tag} size="sm" variant="soft" color="accent">{tag}</Chip>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button size="sm" variant="ghost" onPress={() => openEdit(resource)} isIconOnly>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button size="sm" variant="ghost" color="danger" onPress={() => handleDelete(resource)} isIconOnly>
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
                  <Input
                    label="Title"
                    placeholder="Resource title"
                    value={form.title}
                    onValueChange={(val) => setForm((p) => ({ ...p, title: val }))}
                  />
                  <TextArea
                    label="Description"
                    placeholder="Brief description"
                    value={form.description}
                    onValueChange={(val) => setForm((p) => ({ ...p, description: val }))}
                    minRows={2}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Type</label>
                      <select
                        value={form.type}
                        onChange={(e) => setForm((p) => ({ ...p, type: e.target.value as Resource["type"] }))}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
                      >
                        {RESOURCE_TYPES.map((t) => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">Layer</label>
                      <select
                        value={form.layer}
                        onChange={(e) => setForm((p) => ({ ...p, layer: e.target.value as Resource["layer"] }))}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
                      >
                        {LAYERS.map((l) => (
                          <option key={l.value} value={l.value}>{l.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {form.layer === "department" && (
                    <div>
                      <label className="text-sm font-medium mb-1 block">Department</label>
                      <select
                        value={form.departmentId}
                        onChange={(e) => setForm((p) => ({ ...p, departmentId: e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border bg-background text-foreground"
                      >
                        <option value="">Select department</option>
                        {departments.map((d) => (
                          <option key={d.$id} value={d.$id}>{d.name}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <Input
                    label="URL (optional)"
                    placeholder="https://..."
                    value={form.url}
                    onValueChange={(val) => setForm((p) => ({ ...p, url: val }))}
                  />
                  <Input
                    label="Tags (comma separated)"
                    placeholder="tag1, tag2, tag3"
                    value={form.tags}
                    onValueChange={(val) => setForm((p) => ({ ...p, tags: val }))}
                  />
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="ghost" onPress={close}>Cancel</Button>
                <Button variant="primary" onPress={handleSave}>
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
