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
import { departmentService } from "@/lib/departments";
import { profileService } from "@/lib/profiles";
import { getErrorMessage } from "@/lib/errorHandler";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
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
import type { Department, UserDepartment, Profile } from "@/lib/types";

const CATEGORY_COLORS: Record<string, string> = {
  technical: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  content: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
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
  const [loadingMembers, setLoadingMembers] = useState<string | null>(null);

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
      const allDepts = await departmentService.getAll();
      setDepartments(allDepts);

      // Load member counts
      const counts: Record<string, number> = {};
      await Promise.all(
        allDepts.map(async (dept) => {
          if (dept.$id) {
            const count = await departmentService.getMemberCount(dept.$id);
            counts[dept.$id] = count;
          }
        })
      );
      setMemberCounts(counts);
    } catch (error) {
      console.error("Error loading departments:", error);
      toast.error("Failed to load departments");
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

      // Auto-generate slug from name
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");

      const payload = { ...formData, slug };

      if (editingDept) {
        await departmentService.update(editingDept.$id!, payload);
        toast.success("Department updated successfully!");
      } else {
        await departmentService.create(payload);
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
    if (
      !confirm(
        "Are you sure you want to delete this department? This cannot be undone."
      )
    )
      return;
    try {
      await departmentService.delete(deptId);
      toast.success("Department deleted successfully!");
      await loadDepartments();
    } catch (error) {
      console.error("Error deleting department:", error);
      toast.error("Failed to delete department");
    }
  };

  const handleToggleMembers = async (dept: Department) => {
    if (expandedDept === dept.$id) {
      setExpandedDept(null);
      return;
    }

    setExpandedDept(dept.$id!);

    if (!deptMembers[dept.$id!]) {
      setLoadingMembers(dept.$id!);
      try {
        const members = await departmentService.getDepartmentMembers(dept.$id!);
        const membersWithProfiles = await Promise.all(
          members.map(async (m) => {
            const profile = await profileService.getByUserId(m.userId);
            return { ...m, profile };
          })
        );
        setDeptMembers((prev) => ({ ...prev, [dept.$id!]: membersWithProfiles }));
      } catch (error) {
        console.error("Error loading members:", error);
        toast.error("Failed to load department members");
      } finally {
        setLoadingMembers(null);
      }
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
          <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Department Management
          </h1>
          <p className="text-default-500 mt-1 text-sm md:text-base">
            Manage club departments and their members
          </p>
        </div>
        <Button
          onPress={open}
          className="bg-gradient-to-r from-blue-600 to-purple-600"
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
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
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
                                <div className="w-8 h-8 rounded-full bg-default-200 flex items-center justify-center text-xs font-bold">
                                  {member.profile?.urn?.charAt(0) ||
                                    member.userId.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="text-sm font-medium">
                                    {member.profile?.urn || member.userId}
                                  </p>
                                  {member.profile?.branch && (
                                    <p className="text-xs text-default-400">
                                      {member.profile.branch}
                                    </p>
                                  )}
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
                    <h2 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                      {editingDept ? "Edit Department" : "Create Department"}
                    </h2>
                    <p className="text-sm text-default-500 font-normal">
                      {editingDept
                        ? "Update department details"
                        : "Add a new department to the club"}
                    </p>
                  </ModalHeader>

                  <ModalBody className="py-6 space-y-5">
                    <Input
                      label="Department Name"
                      placeholder="e.g., Web Development"
                      value={formData.name}
                      onChange={(e: any) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      required
                    />

                    <TextArea
                      label="Description"
                      placeholder="Brief description of the department..."
                      value={formData.description}
                      onChange={(e: any) =>
                        setFormData({ ...formData, description: e.target.value })
                      }
                      rows={3}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <select
                        value={formData.category}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            category: e.target.value as Department["category"],
                          })
                        }
                        required
                        className="w-full px-3 py-2.5 rounded-lg border border-default-300 bg-white dark:bg-gray-900 text-sm focus:ring-2 focus:ring-primary focus:border-primary outline-none"
                      >
                        <option value="technical">Technical</option>
                        <option value="content">Content</option>
                        <option value="operations">Operations</option>
                      </select>

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
                      <Input
                        label="Icon"
                        placeholder="Emoji or text (e.g., &#128187;)"
                        value={formData.icon}
                        onChange={(e: any) =>
                          setFormData({ ...formData, icon: e.target.value })
                        }
                      />

                      <Input
                        label="Display Order"
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

                    <Input
                      label="Parent Department ID (optional)"
                      placeholder="Leave empty for top-level department"
                      value={formData.parentId || ""}
                      onChange={(e: any) =>
                        setFormData({
                          ...formData,
                          parentId: e.target.value || undefined,
                        })
                      }
                    />

                    <Input
                      label="Head User ID (optional)"
                      placeholder="User ID of the department head"
                      value={formData.headId || ""}
                      onChange={(e: any) =>
                        setFormData({
                          ...formData,
                          headId: e.target.value || undefined,
                        })
                      }
                    />

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
                      className="w-full sm:w-auto bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold"
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
