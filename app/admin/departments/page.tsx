// app/admin/departments/page.tsx
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
  UsersIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from "lucide-react";

import {getErrorMessage, readApiError} from "@/lib/errorHandler";
import MemberAvatar from "@/components/MemberAvatar";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
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
import type { Department, UserDepartment, Profile } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  content: "bg-muted text-muted-foreground",
  operations: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
};

const ROLE_BADGES: Record<string, string> = {
  member: "bg-default-100 text-default-700",
  core_member: "bg-primary-100 text-primary-700",
  lead: "bg-warning-100 text-warning-700",
};

export default function AdminDepartmentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { isOpen, open, close } = useOverlayState();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingDept, setEditingDept] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Member view state
  const [expandedDept, setExpandedDept] = useState<string | null>(null);
  const [deptMembers, setDeptMembers] = useState<Record<string, (UserDepartment & { profile?: Profile | null })[]>>({});
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);
  const [deletingDeptId, setDeletingDeptId] = useState<string | null>(null);
  const [addingMemberDept, setAddingMemberDept] = useState<string | null>(null);
  const [removingUserId, setRemovingUserId] = useState<string | null>(null);
  const [addMemberForm, setAddMemberForm] = useState({ userId: "", role: "member" });

  // Member counts
  const [memberCounts, setMemberCounts] = useState<Record<string, number>>({});

  // Form state
  const [formData, setFormData] = useState<Omit<Department, "$id" | "$createdAt" | "$updatedAt">>({
    name: "",
    slug: "",
    description: "",
    icon: "",
    color: "#6366f1",
    parentId: undefined,
    headId: undefined,
    isActive: true,
    displayOrder: 0,
    category: "technical",
  });

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");
    }
    loadDepartments();
  }, [user, authLoading, router]);

  const loadDepartments = async () => {
    try {
      const response = await fetch("/api/admin/departments", { credentials: "include" });
      const payload = (await response.json()) as {
        departments?: Department[];
        memberCounts?: Record<string, number>;
        error?: string;
      };
      if (!response.ok) throw new Error(readApiError(payload, "Failed to load departments"));
      setDepartments(payload.departments ?? []);
      setMemberCounts(payload.memberCounts ?? {});
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error loading departments:", message);
      toast.error(message || "Failed to load departments");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (!formData.name.trim()) {
        toast.error("Department name is required");
        setSubmitting(false);
        return;
      }

      // Auto-generate slug from name. A symbol-only name ("!!!")
      // derives to "" and 400s server-side — block it here instead.
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      if (!slug) {
        toast.error("Department name must contain at least one letter or number");
        setSubmitting(false);
        return;
      }

      const payload = { ...formData, slug };

      const response = await fetch("/api/admin/departments", {
        method: editingDept ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(
          editingDept ? { departmentId: editingDept.$id, ...payload } : payload,
        ),
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(result, "Failed to save department"));

      if (editingDept) {
        toast.success("Department updated successfully!");
      } else {
        toast.success("Department created successfully!");
      }

      resetForm();
      await loadDepartments();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving department:", message);
      toast.error(message || "Failed to save department");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (dept: Department) => {
    setEditingDept(dept);
    setFormData({
      name: dept.name,
      slug: dept.slug,
      description: dept.description || "",
      icon: dept.icon || "",
      color: dept.color || "#6366f1",
      parentId: dept.parentId,
      headId: dept.headId,
      isActive: dept.isActive,
      displayOrder: dept.displayOrder || 0,
      category: dept.category,
    });
    open();
  };

  const handleDelete = async (deptId: string) => {
    // Server-side this is a soft delete (isActive=false, audited) — say so,
    // so the admin knows reactivation via Edit is possible.
    if (
      !confirm(
        "Deactivate this department? Members keep their history and it can be reactivated via Edit."
      )
    )
      return;
    setDeletingDeptId(deptId);
    try {
      const response = await fetch(`/api/admin/departments?departmentId=${encodeURIComponent(deptId)}`, {
        method: "DELETE",
        credentials: "include",
      });
      const result = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(result, "Failed to delete department"));
      toast.success("Department deactivated. Reactivate it via Edit.");
      await loadDepartments();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error deleting department:", message);
      toast.error(message || "Failed to delete department");
    } finally {
      setDeletingDeptId(null);
    }
  };

  const handleToggleMembers = async (dept: Department) => {
    if (expandedDept === dept.$id) {
      setExpandedDept(null);
      return;
    }

    setExpandedDept(dept.$id!);
    setAddMemberForm({ userId: "", role: "member" });

    if (!deptMembers[dept.$id!]) {
      setLoadingMembers(dept.$id!);
      try {
        const response = await fetch(`/api/admin/departments/members?departmentId=${encodeURIComponent(dept.$id!)}`, {
          credentials: "include",
        });
        const payload = (await response.json()) as { members?: Array<UserDepartment & { profile?: Profile | null }>; accountNames?: Record<string, string>; error?: string };
        if (!response.ok) throw new Error(readApiError(payload, "Failed to load department members"));
        setDeptMembers((prev) => ({ ...prev, [dept.$id!]: payload.members ?? [] }));
        if (payload.accountNames) setMemberNames((prev) => ({ ...prev, ...payload.accountNames }));
      } catch (error) {
        const message = getErrorMessage(error);
        console.error("Error loading members:", message);
        toast.error(message || "Failed to load department members");
      } finally {
        setLoadingMembers(null);
      }
    }
  };

  const handleAddMember = async (deptId: string) => {
    if (!addMemberForm.userId.trim()) {
      toast.error("Enter the member's user ID");
      return;
    }
    setAddingMemberDept(deptId);
    try {
      const response = await fetch("/api/admin/departments/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ userId: addMemberForm.userId.trim(), departmentId: deptId, role: addMemberForm.role }),
      });
      const payload = (await response.json().catch(() => null)) as { reactivated?: boolean; error?: string } | null;
      // 404 (unknown department) and 409 (already assigned) carry the reason.
      if (!response.ok) throw new Error(readApiError(payload, "Failed to add member"));
      toast.success(payload?.reactivated ? "Member reinstated in department" : "Member added to department");
      setAddMemberForm({ userId: "", role: "member" });
      // Refresh the cached roster for this department.
      setDeptMembers((prev) => {
        const next = { ...prev };
        delete next[deptId];
        return next;
      });
      const dept = departments.find((d) => d.$id === deptId);
      if (dept) await handleToggleMembersRefresh(dept);
      await loadDepartments();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error adding member:", message);
      toast.error(message || "Failed to add member");
    } finally {
      setAddingMemberDept(null);
    }
  };

  const handleToggleMembersRefresh = async (dept: Department) => {
    setLoadingMembers(dept.$id!);
    try {
      const response = await fetch(`/api/admin/departments/members?departmentId=${encodeURIComponent(dept.$id!)}`, {
        credentials: "include",
      });
      const payload = (await response.json()) as { members?: Array<UserDepartment & { profile?: Profile | null }>; accountNames?: Record<string, string>; error?: string };
      if (!response.ok) throw new Error(readApiError(payload, "Failed to load department members"));
      setDeptMembers((prev) => ({ ...prev, [dept.$id!]: payload.members ?? [] }));
      if (payload.accountNames) setMemberNames((prev) => ({ ...prev, ...payload.accountNames }));
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error loading members:", message);
      toast.error(message || "Failed to load department members");
    } finally {
      setLoadingMembers(null);
    }
  };

  const handleRemoveMember = async (deptId: string, userId: string) => {
    const name = memberNames[userId] || userId;
    if (!confirm(`Remove ${name} from this department? Their history is kept and they can be re-added.`)) return;
    setRemovingUserId(userId);
    try {
      const response = await fetch(`/api/admin/departments/members?${new URLSearchParams({ userId, departmentId: deptId })}`, {
        method: "DELETE",
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(readApiError(payload, "Failed to remove member"));
      toast.success(`${name} removed from department`);
      setDeptMembers((prev) => ({
        ...prev,
        [deptId]: (prev[deptId] ?? []).filter((member) => member.userId !== userId),
      }));
      await loadDepartments();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error removing member:", message);
      toast.error(message || "Failed to remove member");
    } finally {
      setRemovingUserId(null);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      slug: "",
      description: "",
      icon: "",
      color: "#6366f1",
      parentId: undefined,
      headId: undefined,
      isActive: true,
      displayOrder: 0,
      category: "technical",
    });
    setEditingDept(null);
    close();
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4">Loading departments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
            Department Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Manage club departments and their members
          </p>
        </div>
        <Button
          onPress={open}
          className="bg-primary"
          size="lg"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="ml-2">Add Department</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Total Departments</p>
                <p className="text-2xl font-bold">{departments.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <UsersIcon className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Technical</p>
                <p className="text-2xl font-bold">
                  {departments.filter((d) => d.category === "technical").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                <span className="text-xl">&#128187;</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Content</p>
                <p className="text-2xl font-bold">
                  {departments.filter((d) => d.category === "content").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <span className="text-xl">&#9998;</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-md">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-default-500">Operations</p>
                <p className="text-2xl font-bold">
                  {departments.filter((d) => d.category === "operations").length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <span className="text-xl">&#9881;</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Departments List */}
      <div className="space-y-4">
        <h2 className="text-xl font-bold">
          All Departments ({departments.length})
        </h2>

        {departments.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-lg text-default-600 mb-4">
                No departments yet
              </p>
              <Button onPress={open}>Create First Department</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {departments.map((dept) => (
              <Card key={dept.$id} className="border-none shadow-md">
                <CardContent className="p-0">
                  {/* Department Row */}
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-4 p-4">
                    {/* Icon & Color */}
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white text-xl flex-shrink-0"
                      style={{ backgroundColor: dept.color || "#6366f1" }}
                    >
                      {dept.icon || dept.name.charAt(0)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-lg">{dept.name}</h3>
                        <Chip size="sm" className={CATEGORY_COLORS[dept.category]}>
                          {dept.category}
                        </Chip>
                        {!dept.isActive && (
                          <Chip size="sm" className="bg-red-100 text-red-800">
                            Inactive
                          </Chip>
                        )}
                      </div>
                      {dept.description && (
                        <p className="text-sm text-default-500 mt-1 line-clamp-1">
                          {dept.description}
                        </p>
                      )}
                    </div>

                    {/* Member Count */}
                    <button
                      onClick={() => handleToggleMembers(dept)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-default-100 hover:bg-default-200 transition-colors cursor-pointer"
                    >
                      <UsersIcon className="w-4 h-4 text-default-500" />
                      <span className="text-sm font-semibold">
                        {memberCounts[dept.$id!] || 0} members
                      </span>
                      {expandedDept === dept.$id ? (
                        <ChevronUpIcon className="w-4 h-4" />
                      ) : (
                        <ChevronDownIcon className="w-4 h-4" />
                      )}
                    </button>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="primary"
                        isIconOnly
                        onPress={() => handleEdit(dept)}
                      >
                        <EditIcon className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        isIconOnly
                        isPending={deletingDeptId === dept.$id}
                        onPress={() => handleDelete(dept.$id!)}
                      >
                        <TrashIcon className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Members View */}
                  {expandedDept === dept.$id && (
                    <div className="border-t p-4 bg-default-50">
                      <h4 className="font-semibold text-sm mb-3">
                        Department Members
                      </h4>
                      <form
                        className="flex flex-col sm:flex-row gap-2 mb-4"
                        onSubmit={(e) => { e.preventDefault(); void handleAddMember(dept.$id!); }}
                      >
                        <Input
                          placeholder="User ID to add"
                          value={addMemberForm.userId}
                          onChange={(e: any) => setAddMemberForm({ ...addMemberForm, userId: e.target.value })}
                          aria-label="User ID to add to department"
                        />
                        <Select
                          fullWidth={false}
                          aria-label="Role for new member"
                          value={addMemberForm.role}
                          onChange={(value) => setAddMemberForm({ ...addMemberForm, role: String(value ?? "member") })}
                        >
                          <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                          </Select.Trigger>
                          <Select.Popover>
                            <ListBox>
                              <ListBox.Item id="member" textValue="Member">
                                Member
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="core_member" textValue="Core member">
                                Core member
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                              <ListBox.Item id="lead" textValue="Lead">
                                Lead
                                <ListBox.ItemIndicator />
                              </ListBox.Item>
                            </ListBox>
                          </Select.Popover>
                        </Select>
                        <Button type="submit" size="sm" variant="primary" isPending={addingMemberDept === dept.$id}>
                          Add
                        </Button>
                      </form>
                      {loadingMembers === dept.$id ? (
                        <div className="flex items-center gap-2 py-4">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
                          <span className="text-sm text-default-500">
                            Loading members...
                          </span>
                        </div>
                      ) : deptMembers[dept.$id!]?.length === 0 ? (
                        <p className="text-sm text-default-400 py-4">
                          No members in this department yet.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {deptMembers[dept.$id!]?.map((member) => (
                            <div
                              key={member.$id}
                              className="flex items-center justify-between p-3 bg-white dark:bg-gray-900 rounded-lg border border-default-200"
                            >
                              <div className="flex items-center gap-3">
                                <MemberAvatar
                                  src={member.profile?.avatar}
                                  name={memberNames[member.userId] || member.profile?.urn || member.userId}
                                  className="w-8 h-8 text-xs font-bold flex-shrink-0"
                                />
                                <div>
                                  <p className="text-sm font-medium">
                                    {memberNames[member.userId] || member.profile?.urn || member.userId}
                                  </p>
                                  {(() => {
                                    const sub = [
                                      memberNames[member.userId] ? member.profile?.urn : null,
                                      member.profile?.branch,
                                    ].filter(Boolean);
                                    return sub.length > 0 ? (
                                      <p className="text-xs text-default-400">{sub.join(" · ")}</p>
                                    ) : null;
                                  })()}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <Chip
                                  size="sm"
                                  className={ROLE_BADGES[member.role]}
                                >
                                  {member.role.replace("_", " ")}
                                </Chip>
                                <span className="text-xs text-default-400">
                                  {new Date(
                                    member.assignedAt
                                  ).toLocaleDateString()}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  isPending={removingUserId === member.userId}
                                  onPress={() => handleRemoveMember(dept.$id!, member.userId)}
                                >
                                  Remove
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
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
                      {editingDept ? "Edit Department" : "Create Department"}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      {editingDept
                        ? "Update department details"
                        : "Add a new department to the club"}
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6 space-y-5">
                    <div>
                      <label className="text-sm font-medium mb-1 block">Department Name</label>
                      <Input
                        placeholder="e.g., Web Development"
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
                        placeholder="Brief description of the department..."
                        value={formData.description}
                        onChange={(e: any) =>
                          setFormData({ ...formData, description: e.target.value })
                        }
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Select
                        fullWidth
                        aria-label="Department category"
                        value={formData.category}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            category: String(value ?? "technical") as Department["category"],
                          })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="technical" textValue="Technical">
                              Technical
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="content" textValue="Content">
                              Content
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            <ListBox.Item id="operations" textValue="Operations">
                              Operations
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          </ListBox>
                        </Select.Popover>
                      </Select>

                      <div className="flex items-center gap-2">
                        <label className="text-sm font-medium">Color</label>
                        <input
                          type="color"
                          value={formData.color || "#6366f1"}
                          onChange={(e) =>
                            setFormData({ ...formData, color: e.target.value })
                          }
                          className="w-10 h-10 rounded-lg border border-default-300 cursor-pointer"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-sm font-medium mb-1 block">Icon</label>
                        <Input
                          placeholder="Emoji or text"
                          value={formData.icon}
                          onChange={(e: any) =>
                            setFormData({ ...formData, icon: e.target.value })
                          }
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-1 block">Display Order</label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={formData.displayOrder?.toString()}
                          onChange={(e: any) =>
                            setFormData({
                              ...formData,
                              displayOrder: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Parent Department (optional)</label>
                      <Select
                        fullWidth
                        aria-label="Parent department"
                        value={formData.parentId || ""}
                        onChange={(value) =>
                          setFormData({
                            ...formData,
                            parentId: String(value ?? "") || undefined,
                          })
                        }
                      >
                        <Select.Trigger>
                          <Select.Value />
                          <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                          <ListBox>
                            <ListBox.Item id="" textValue="None (top-level)">
                              None (top-level)
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {departments
                              .filter((dept) => dept.$id !== editingDept?.$id)
                              .map((dept) => (
                                <ListBox.Item key={dept.$id} id={dept.$id!} textValue={dept.name}>
                                  {dept.name}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-1 block">Head User ID (optional)</label>
                      <Input
                        placeholder="User ID of the department head"
                        value={formData.headId || ""}
                        onChange={(e: any) =>
                          setFormData({
                            ...formData,
                            headId: e.target.value || undefined,
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
                      {editingDept ? "Update Department" : "Create Department"}
                    </Button>
                  </ModalFooter>
                </form>
              )}
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
