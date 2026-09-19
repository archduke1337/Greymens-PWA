"use client";

import type { Project } from "@/lib/types";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import {
  PlusIcon,
  Edit2Icon,
  TrashIcon,
  Loader2Icon,
  ImageIcon,
  StarIcon,
  FolderIcon,
  LightbulbIcon,
  CheckIcon,
  XIcon,
} from "lucide-react";
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
  Slider,
  Spinner,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableContent,
  TableScrollContainer,
  TableRow,
  TextArea,
  useOverlayState,
} from "@heroui/react";

import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/context/PermissionContext";
import { logError } from "@/lib/logger";

export default function AdminProjectsPage() {
  const { user, loading: authLoading } = useAuth();
  const { hasCapability } = usePermissions();
  const router = useRouter();
  const canManage = hasCapability("projects.manage");
  // Reviewing is its own grant: a projects.approve holder decides the queue
  // without being able to create, rewrite, or delete the portfolio.
  const canReview = canManage || hasCapability("projects.approve");
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { isOpen, open, close } = useOverlayState();
  const [isEditing, setIsEditing] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    image: "",
    category: "web",
    status: "planning",
    progress: 0,
    technologies: "",
    stars: 0,
    forks: 0,
    contributors: 1,
    duration: "",
    isFeatured: false,
    demoUrl: "",
    repoUrl: "",
    teamMembers: "",
  });

  const categories = [
    { key: "ai-ml", label: "AI & ML" },
    { key: "blockchain", label: "Blockchain" },
    { key: "mobile", label: "Mobile" },
    { key: "web", label: "Web" },
    { key: "iot", label: "IoT" },
    { key: "quantum", label: "Quantum" },
    { key: "cybersecurity", label: "Cybersecurity" },
  ];

  const statuses = [
    { key: "planning", label: "Planning" },
    { key: "in-progress", label: "In progress" },
    { key: "completed", label: "Completed" },
  ];

  // Admin tips
  const adminTips = [
    "Use high-quality images from Unsplash for better project presentation",
    "Set realistic progress percentages to track project development accurately",
    "Use commas to separate technologies and team members for better organization",
    "Add demo and repository links to showcase live projects",
  ];

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/admin/projects", {
        credentials: "include",
      });
      const payload = (await response.json().catch(() => null)) as {
        projects?: Project[];
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load projects"));
      setProjects(payload?.projects ?? []);
      // Only a real reload clears the selection: it may have decided rows.
      setSelectedIds(new Set());
    } catch (error) {
      logError("Error fetching projects:", error);
      toast.error(getErrorMessage(error) || "Failed to fetch projects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/login");

      return;
    }
    if (!authLoading && user) void fetchProjects();
  }, [user, authLoading, router]);

  // Reset form
  const resetForm = () => {
    setFormData({
      title: "",
      description: "",
      image: "",
      category: "web",
      status: "planning",
      progress: 0,
      technologies: "",
      stars: 0,
      forks: 0,
      contributors: 1,
      duration: "",
      isFeatured: false,
      demoUrl: "",
      repoUrl: "",
      teamMembers: "",
    });
  };

  // Open modal for adding new project
  const handleAdd = () => {
    setIsEditing(false);
    setSelectedProject(null);
    resetForm();
    open();
  };

  // Open modal for editing project
  const handleEdit = (project: Project) => {
    setIsEditing(true);
    setSelectedProject(project);
    setFormData({
      title: project.title,
      description: project.description,
      image: project.image,
      category: project.category,
      status: project.status,
      progress: project.progress,
      technologies: Array.isArray(project.technologies)
        ? project.technologies.join(", ")
        : "",
      stars: project.stars,
      forks: project.forks,
      contributors: project.contributors,
      duration: project.duration,
      isFeatured: project.isFeatured,
      demoUrl: project.demoUrl || "",
      repoUrl: project.repoUrl || "",
      teamMembers: Array.isArray(project.teamMembers)
        ? project.teamMembers.join(", ")
        : "",
    });
    open();
  };

  // Validate form
  const validateForm = () => {
    if (!formData.title.trim()) {
      toast.error("Please enter a project title");

      return false;
    }
    if (!formData.description.trim()) {
      toast.error("Please enter a project description");

      return false;
    }
    if (!formData.image.trim()) {
      toast.error("Please enter an image URL");

      return false;
    }
    if (!/^https?:\/\/.+/i.test(formData.image.trim())) {
      toast.error("Image must be a valid http(s) URL");

      return false;
    }
    // The server accepts empty demo/repo URLs but 400s on non-http(s) ones —
    // catch the missing-protocol paste here instead of at submit.
    for (const [field, label] of [
      ["demoUrl", "Demo URL"],
      ["repoUrl", "Repository URL"],
    ] as const) {
      const value = formData[field].trim();

      if (value && !/^https?:\/\/.+/i.test(value)) {
        toast.error(`${label} must be a valid http(s) URL or left empty`);

        return false;
      }
    }
    // Over-long entries 500 server-side (technologies ≤100, members ≤255).
    const overlongTech = formData.technologies
      .split(",")
      .map((t) => t.trim())
      .find((t) => t.length > 100);

    if (overlongTech) {
      toast.error("Each technology must be 100 characters or fewer");

      return false;
    }
    const overlongMember = formData.teamMembers
      .split(",")
      .map((t) => t.trim())
      .find((t) => t.length > 255);

    if (overlongMember) {
      toast.error("Each team member must be 255 characters or fewer");

      return false;
    }
    if (!formData.duration.trim()) {
      toast.error("Please enter project duration");

      return false;
    }
    // Number inputs yield NaN for garbage and 0 for a cleared field; the
    // server 400s on NaN and persists a silent zero, so verify here.
    const numericFields = [
      ["progress", "Progress", 0, 100],
      ["stars", "Stars", 0, Number.MAX_SAFE_INTEGER],
      ["forks", "Forks", 0, Number.MAX_SAFE_INTEGER],
      ["contributors", "Contributors", 0, Number.MAX_SAFE_INTEGER],
    ] as const;

    for (const [field, label, min, max] of numericFields) {
      const value = formData[field];

      if (!Number.isFinite(value) || value < min || value > max) {
        toast.error(
          max === Number.MAX_SAFE_INTEGER
            ? `${label} must be ${min} or more`
            : `${label} must be between ${min} and ${max}`,
        );

        return false;
      }
    }

    return true;
  };

  // Save project (create or update)
  const handleSave = async () => {
    if (!validateForm()) return;

    try {
      setSaving(true);

      const projectData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        image: formData.image.trim(),
        category: formData.category,
        status: formData.status,
        progress: Number(formData.progress),
        technologies: formData.technologies
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        stars: Number(formData.stars),
        forks: Number(formData.forks),
        contributors: Number(formData.contributors),
        duration: formData.duration.trim(),
        isFeatured: formData.isFeatured,
        demoUrl: formData.demoUrl.trim(),
        repoUrl: formData.repoUrl.trim(),
        teamMembers: formData.teamMembers
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t),
        createdAt: isEditing
          ? selectedProject?.createdAt || new Date().toISOString()
          : new Date().toISOString(),
      };

      if (isEditing && selectedProject?.$id) {
        const response = await fetch("/api/admin/projects", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            projectId: selectedProject.$id,
            ...projectData,
          }),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok)
          throw new Error(readApiError(payload, "Unable to update project"));
        toast.success("Project updated successfully!");
      } else {
        const response = await fetch("/api/admin/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(projectData),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        if (!response.ok)
          throw new Error(readApiError(payload, "Unable to create project"));
        toast.success("Project created successfully!");
      }

      close();
      fetchProjects();
      resetForm();
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error saving project:", message);
      toast.error(`Failed to save project: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete project
  const handleDelete = async (projectId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this project? This action cannot be undone.",
      )
    )
      return;
    setDeletingId(projectId);
    try {
      const response = await fetch(
        `/api/admin/projects?projectId=${encodeURIComponent(projectId)}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to delete project"));
      toast.success("Project deleted successfully!");
      fetchProjects();
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error deleting project:", message);
      toast.error(`Failed to delete project: ${message}`);
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "in-progress":
        return "accent";
      case "planning":
        return "warning";
      default:
        return "default";
    }
  };

  // Review queue: member proposals arrive as `review`; rows predating
  // moderation carry no reviewStatus and read as approved legacy content.
  type ReviewTab = "all" | "review" | "approved" | "rejected";

  const [activeTab, setActiveTab] = useState<ReviewTab>("all");
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  // Bulk approve (gallery/resources parity): session-scoped selection over
  // pending rows. A real reload clears it — a decided row can never stay
  // checked — but tab switches keep it.
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkApproving, setBulkApproving] = useState(false);

  const reviewOf = (project: Project): "review" | "approved" | "rejected" => {
    if (
      project.reviewStatus === "review" ||
      project.reviewStatus === "rejected"
    )
      return project.reviewStatus;

    return "approved";
  };

  const reviewCounts = {
    review: projects.filter((p) => reviewOf(p) === "review").length,
    approved: projects.filter((p) => reviewOf(p) === "approved").length,
    rejected: projects.filter((p) => reviewOf(p) === "rejected").length,
  };

  const visibleProjects = projects.filter(
    (p) => activeTab === "all" || reviewOf(p) === activeTab,
  );

  // Approve every selected pending proposal in one call, then drop the
  // selection. Rows decide independently server-side; partial failures are
  // reported rather than swallowed.
  const handleBulkApprove = async () => {
    if (selectedIds.size === 0 || bulkApproving) return;
    if (
      !confirm(
        `Approve ${selectedIds.size} project${selectedIds.size > 1 ? "s" : ""}? Each proposer is notified and each becomes publicly visible.`,
      )
    )
      return;
    setBulkApproving(true);
    try {
      const response = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: [...selectedIds][0],
          action: "approve",
          projectIds: [...selectedIds],
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        approvedCount?: number;
        failedIds?: string[];
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to approve projects"));
      const decided = payload?.approvedCount ?? 0;
      const failures = payload?.failedIds?.length ?? 0;

      if (failures > 0) {
        toast.warning(
          `${decided} approved, ${failures} failed — retry the failed ones from the queue`,
        );
      } else {
        toast.success(`${decided} project${decided === 1 ? "" : "s"} approved`);
      }
      setSelectedIds(new Set());
      await fetchProjects();
    } catch (error) {
      logError("Bulk project approval failed:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to approve projects",
      );
    } finally {
      setBulkApproving(false);
    }
  };

  const handleReview = async (
    project: Project,
    action: "approve" | "reject",
  ) => {
    if (!project.$id) return;
    let reason = "";

    if (action === "reject") {
      const input = window.prompt(
        `Why is "${project.title}" not approved? The proposer sees this.`,
        project.rejectionReason ?? "",
      );

      if (input === null) return;
      reason = input.trim();

      if (!reason) {
        toast.error("A rejection reason is required");

        return;
      }
    } else if (
      !confirm(`Approve "${project.title}"? It becomes publicly visible.`)
    ) {
      return;
    }
    setReviewingId(project.$id);
    try {
      const response = await fetch("/api/admin/projects", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          projectId: project.$id,
          action,
          reason: reason || undefined,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to review project"));
      toast.success(
        action === "approve" ? "Project approved" : "Project sent back",
      );
      fetchProjects();
    } catch (error) {
      const message = getErrorMessage(error);

      logError("Error reviewing project:", message);
      toast.error(`Failed to review project: ${message}`);
    } finally {
      setReviewingId(null);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div
          aria-label="Loading projects"
          className="text-center space-y-4"
          role="status"
        >
          <Spinner className="mb-4" size="lg" />
          <p className="text-muted">Loading projects...</p>
        </div>
      </div>
    );
  }
  if (!user) return null;
  if (!canReview) {
    return (
      <div className="min-h-screen p-4 sm:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto">
          <Card>
            <CardContent className="p-8 text-center text-muted">
              This console needs projects.manage (full editing: cto, research,
              software/web, and AI/ML leads) or projects.approve (reviewing
              member proposals). What you can see publicly lives on the projects
              page.
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">
              Project Management
            </h1>
            <p className="text-muted mt-1 text-sm md:text-base">
              Manage and organize all club projects
            </p>
          </div>
        </div>

        {/* Admin Tips Section */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <LightbulbIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-foreground mb-3">
                  Admin Tips & Best Practices
                </h2>
                <div className="grid md:grid-cols-2 gap-3">
                  {adminTips.map((tip, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-2 text-sm text-muted"
                    >
                      <span className="flex-shrink-0 mt-0.5">
                        {tip.split(" ")[0]}
                      </span>
                      <span>{tip.split(" ").slice(1).join(" ")}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Projects Table */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 pt-6 pb-0">
                <div>
                  <h2 className="text-xl font-bold text-foreground">
                    Projects
                  </h2>
                  <p className="text-muted text-sm mt-1 tabular-nums">
                    {projects.length} project{projects.length !== 1 ? "s" : ""}{" "}
                    total
                  </p>
                </div>
                {canManage && (
                  <Button
                    className="bg-primary text-primary-foreground font-semibold"
                    size="lg"
                    onPress={handleAdd}
                  >
                    New Project
                  </Button>
                )}
              </CardHeader>
              <CardContent className="p-6">
                <div
                  aria-label="Filter by review status"
                  className="flex flex-wrap gap-2 mb-4"
                  role="group"
                >
                  {(
                    [
                      { value: "all", label: "All" },
                      { value: "review", label: "Needs review" },
                      { value: "approved", label: "Published" },
                      { value: "rejected", label: "Sent back" },
                    ] as const
                  ).map((tab) => {
                    const count =
                      tab.value === "all"
                        ? projects.length
                        : reviewCounts[tab.value];
                    // Selected-count badge sits on the Needs review tab
                    // itself so the working set stays visible across tab
                    // switches.
                    const selectedCount =
                      tab.value === "review" ? selectedIds.size : 0;

                    return (
                      <Button
                        key={tab.value}
                        size="sm"
                        variant={
                          activeTab === tab.value ? "primary" : "secondary"
                        }
                        onPress={() => setActiveTab(tab.value)}
                      >
                        {tab.label}
                        {selectedCount > 0 && (
                          <Chip
                            className="ml-1 tabular-nums"
                            color="accent"
                            size="sm"
                          >
                            {selectedCount} selected
                          </Chip>
                        )}
                        {count > 0 && (
                          <Chip
                            className="ml-1 tabular-nums"
                            color={
                              tab.value === "approved"
                                ? "success"
                                : tab.value === "rejected"
                                  ? "danger"
                                  : tab.value === "review"
                                    ? "warning"
                                    : "default"
                            }
                            size="sm"
                            variant="soft"
                          >
                            {count}
                          </Chip>
                        )}
                      </Button>
                    );
                  })}
                  {activeTab === "review" &&
                    canReview &&
                    visibleProjects.length > 0 && (
                      <div className="ml-auto flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onPress={() => {
                            const pendingIds = visibleProjects
                              .filter((p) => reviewOf(p) === "review" && p.$id)
                              .map((p) => p.$id!);
                            const allSelected =
                              pendingIds.length > 0 &&
                              pendingIds.every((id) => selectedIds.has(id));

                            setSelectedIds(
                              allSelected
                                ? new Set()
                                : new Set([...selectedIds, ...pendingIds]),
                            );
                          }}
                        >
                          {visibleProjects.every(
                            (p) =>
                              reviewOf(p) !== "review" ||
                              (p.$id && selectedIds.has(p.$id)),
                          ) && visibleProjects.length > 0
                            ? "Clear selection"
                            : `Select all (${visibleProjects.length})`}
                        </Button>
                        {selectedIds.size > 0 && (
                          <Button
                            isPending={bulkApproving}
                            size="sm"
                            variant="primary"
                            onPress={handleBulkApprove}
                          >
                            <CheckIcon aria-hidden="true" className="w-4 h-4" />
                            Approve {selectedIds.size}
                          </Button>
                        )}
                      </div>
                    )}
                </div>
                {loading ? (
                  <div
                    aria-label="Loading projects"
                    className="flex flex-col items-center justify-center py-16"
                    role="status"
                  >
                    <Spinner className="mb-4" size="lg" />
                    <p className="text-muted">Loading projects...</p>
                  </div>
                ) : visibleProjects.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-muted flex items-center justify-center">
                      <FolderIcon className="w-12 h-12 text-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-foreground mb-2">
                      {activeTab === "review"
                        ? "No proposals waiting"
                        : activeTab === "rejected"
                          ? "Nothing sent back"
                          : "No projects yet"}
                    </h3>
                    <p className="text-muted mb-6 max-w-md mx-auto">
                      {activeTab === "all"
                        ? "Start by creating your first project to showcase your work and attract more contributors"
                        : activeTab === "review"
                          ? "Member proposals appear here for approval."
                          : "Projects in this state will appear here."}
                    </p>
                    {activeTab === "all" && canManage && (
                      <Button
                        className="bg-primary text-primary-foreground font-semibold"
                        size="lg"
                        onPress={handleAdd}
                      >
                        Create First Project
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableScrollContainer>
                        <TableContent
                          aria-label="Projects table"
                          className="min-w-full"
                        >
                          <TableHeader>
                            <TableColumn className="text-sm">
                              PROJECT
                            </TableColumn>
                            <TableColumn className="text-sm">
                              CATEGORY
                            </TableColumn>
                            <TableColumn className="text-sm">
                              STATUS
                            </TableColumn>
                            <TableColumn className="text-sm">
                              PROGRESS
                            </TableColumn>
                            <TableColumn className="text-sm">
                              FEATURED
                            </TableColumn>
                            <TableColumn className="text-sm">
                              ACTIONS
                            </TableColumn>
                          </TableHeader>
                          <TableBody>
                            {visibleProjects.map((project) => (
                              <TableRow key={project.$id}>
                                <TableCell>
                                  <div className="flex items-center gap-4">
                                    {canReview &&
                                      reviewOf(project) === "review" &&
                                      project.$id && (
                                        <input
                                          aria-label={`Select ${project.title} for bulk approval`}
                                          checked={selectedIds.has(project.$id)}
                                          className="size-4 cursor-pointer flex-shrink-0"
                                          type="checkbox"
                                          onChange={() =>
                                            setSelectedIds((current) => {
                                              const next = new Set(current);

                                              if (next.has(project.$id!))
                                                next.delete(project.$id!);
                                              else next.add(project.$id!);

                                              return next;
                                            })
                                          }
                                        />
                                      )}
                                    <div className="relative flex-shrink-0">
                                      <Image
                                        unoptimized
                                        alt={project.title}
                                        className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                        height={56}
                                        src={project.image}
                                        width={56}
                                        onError={(event) => {
                                          // Hide the broken image instead of swapping in a
                                          // placeholder URL; the fallback block below the
                                          // column already conveys "no image".
                                          event.currentTarget.style.visibility =
                                            "hidden";
                                        }}
                                      />
                                      <div
                                        aria-hidden="true"
                                        className="absolute -bottom-1 -right-1 w-6 h-6 bg-primary rounded-full border-2 border-background flex items-center justify-center"
                                      >
                                        <ImageIcon className="w-3 h-3 text-white" />
                                      </div>
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <p className="font-semibold text-foreground text-sm truncate">
                                        {project.title}
                                      </p>
                                      <p className="text-xs text-muted line-clamp-1 mt-1">
                                        {project.description}
                                      </p>
                                      {reviewOf(project) !== "approved" && (
                                        <p className="mt-1">
                                          <Chip
                                            color={
                                              reviewOf(project) === "review"
                                                ? "warning"
                                                : "danger"
                                            }
                                            size="sm"
                                            variant="soft"
                                          >
                                            {reviewOf(project) === "review"
                                              ? "Needs review"
                                              : "Sent back"}
                                          </Chip>
                                        </p>
                                      )}
                                      {reviewOf(project) === "rejected" &&
                                        project.rejectionReason && (
                                          <p className="text-xs text-danger mt-1 line-clamp-2">
                                            {project.rejectionReason}
                                          </p>
                                        )}
                                    </div>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  <Chip size="sm" variant="soft">
                                    {project.category.replace("-", " ")}
                                  </Chip>
                                </TableCell>
                                <TableCell>
                                  <Chip
                                    color={
                                      getStatusColor(project.status) as
                                        | "success"
                                        | "accent"
                                        | "warning"
                                        | "default"
                                    }
                                    size="sm"
                                    variant="soft"
                                  >
                                    {project.status.replace("-", " ")}
                                  </Chip>
                                </TableCell>
                                <TableCell>
                                  <div className="flex items-center gap-3">
                                    <div className="w-20 bg-surface-secondary rounded-full h-2 flex-1">
                                      <div
                                        className="bg-primary h-2 rounded-full origin-left transition-transform duration-300 ease-out"
                                        style={{
                                          transform: `scaleX(${Math.min(100, Math.max(0, project.progress)) / 100})`,
                                        }}
                                      />
                                    </div>
                                    <span className="text-sm font-medium text-muted min-w-8 tabular-nums">
                                      {project.progress}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell>
                                  {project.isFeatured ? (
                                    <Chip size="sm" variant="primary">
                                      Featured
                                    </Chip>
                                  ) : (
                                    <span
                                      aria-hidden="true"
                                      className="text-muted text-sm"
                                    >
                                      —
                                    </span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <div className="flex gap-2">
                                    {reviewOf(project) !== "approved" && (
                                      <Button
                                        isIconOnly
                                        aria-label={`Approve ${project.title}`}
                                        isPending={reviewingId === project.$id}
                                        size="sm"
                                        variant="primary"
                                        onPress={() =>
                                          handleReview(project, "approve")
                                        }
                                      >
                                        <CheckIcon
                                          aria-hidden="true"
                                          className="w-4 h-4"
                                        />
                                      </Button>
                                    )}
                                    {reviewOf(project) === "review" && (
                                      <Button
                                        isIconOnly
                                        aria-label={`Send back ${project.title}`}
                                        isPending={reviewingId === project.$id}
                                        size="sm"
                                        variant="danger-soft"
                                        onPress={() =>
                                          handleReview(project, "reject")
                                        }
                                      >
                                        <XIcon
                                          aria-hidden="true"
                                          className="w-4 h-4"
                                        />
                                      </Button>
                                    )}
                                    {canManage && (
                                      <Button
                                        isIconOnly
                                        aria-label={`Edit ${project.title}`}
                                        size="sm"
                                        variant="secondary"
                                        onPress={() => handleEdit(project)}
                                      >
                                        <Edit2Icon className="w-4 h-4" />
                                      </Button>
                                    )}
                                    {canManage && (
                                      <Button
                                        isIconOnly
                                        aria-label={`Delete ${project.title}`}
                                        isPending={deletingId === project.$id}
                                        size="sm"
                                        variant="danger-soft"
                                        onPress={() =>
                                          handleDelete(project.$id!)
                                        }
                                      >
                                        <TrashIcon className="w-4 h-4" />
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </TableContent>
                      </TableScrollContainer>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card>
              <CardHeader className="px-6 pt-6 pb-0">
                <h3 className="text-lg font-bold text-foreground">
                  Project Overview
                </h3>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="text-sm text-muted">Total Projects</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {projects.length}
                    </p>
                  </div>
                  <FolderIcon className="w-8 h-8 text-primary" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="text-sm text-muted">In progress</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {
                        projects.filter((p) => p.status === "in-progress")
                          .length
                      }
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <Loader2Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="text-sm text-muted">Completed</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {projects.filter((p) => p.status === "completed").length}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                    <svg
                      aria-hidden="true"
                      className="w-4 h-4 text-white"
                      fill="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-surface border border-border">
                  <div>
                    <p className="text-sm text-muted">Featured</p>
                    <p className="text-2xl font-bold text-foreground tabular-nums">
                      {projects.filter((p) => p.isFeatured).length}
                    </p>
                  </div>
                  <StarIcon className="w-8 h-8 text-warning" />
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
        {/* Add/Edit Modal */}
        <Modal>
          <ModalBackdrop
            isOpen={isOpen}
            onOpenChange={(open: boolean) => {
              if (!open) {
                close();
                resetForm();
              }
            }}
          >
            <ModalContainer>
              <ModalDialog>
                {() => (
                  <>
                    <ModalHeader className="flex flex-col gap-1 p-6 border-b border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
                          {isEditing ? (
                            <Edit2Icon className="w-5 h-5 text-white" />
                          ) : (
                            <PlusIcon className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <h2 className="text-xl font-bold text-foreground">
                            {isEditing ? "Edit Project" : "Create New Project"}
                          </h2>
                          <p className="text-sm text-muted">
                            {isEditing
                              ? "Update project details and progress"
                              : "Add a new project to showcase your work"}
                          </p>
                        </div>
                      </div>
                    </ModalHeader>
                    <ModalBody className="p-6 gap-6">
                      <div className="space-y-6">
                        <div className="grid md:grid-cols-2 gap-4">
                          <Input
                            required
                            placeholder="Enter project title"
                            value={formData.title}
                            onChange={(e: any) =>
                              setFormData({
                                ...formData,
                                title: e.target.value,
                              })
                            }
                          />
                          <Input
                            required
                            placeholder="3 months"
                            value={formData.duration}
                            onChange={(e: any) =>
                              setFormData({
                                ...formData,
                                duration: e.target.value,
                              })
                            }
                          />
                        </div>

                        <TextArea
                          required
                          placeholder="Describe your project goals, features, and impact..."
                          value={formData.description}
                          onChange={(e: any) =>
                            setFormData({
                              ...formData,
                              description: e.target.value,
                            })
                          }
                        />

                        <Input
                          required
                          placeholder="https://images.unsplash.com/photo-..."
                          value={formData.image}
                          onChange={(e: any) =>
                            setFormData({ ...formData, image: e.target.value })
                          }
                        />

                        <div className="grid md:grid-cols-2 gap-4">
                          <Select
                            fullWidth
                            aria-label="Project category"
                            value={formData.category}
                            onChange={(value) =>
                              setFormData({
                                ...formData,
                                category: String(value ?? formData.category),
                              })
                            }
                          >
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {categories.map((cat) => (
                                  <ListBox.Item
                                    key={cat.key}
                                    id={cat.key}
                                    textValue={cat.label}
                                  >
                                    {cat.label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>

                          <Select
                            fullWidth
                            aria-label="Project status"
                            value={formData.status}
                            onChange={(value) =>
                              setFormData({
                                ...formData,
                                status: String(value ?? formData.status),
                              })
                            }
                          >
                            <Select.Trigger>
                              <Select.Value />
                              <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                              <ListBox>
                                {statuses.map((status) => (
                                  <ListBox.Item
                                    key={status.key}
                                    id={status.key}
                                    textValue={status.label}
                                  >
                                    {status.label}
                                    <ListBox.ItemIndicator />
                                  </ListBox.Item>
                                ))}
                              </ListBox>
                            </Select.Popover>
                          </Select>
                        </div>

                        <div className="space-y-4">
                          <div className="flex items-center gap-4">
                            <div className="flex-1">
                              <Slider
                                maxValue={100}
                                minValue={0}
                                value={formData.progress}
                                onChange={(value) =>
                                  setFormData({
                                    ...formData,
                                    progress:
                                      typeof value === "number"
                                        ? value
                                        : (value[0] ?? 0),
                                  })
                                }
                              >
                                <Label>Progress: {formData.progress}%</Label>
                                <Slider.Output />
                                <Slider.Track>
                                  <Slider.Fill />
                                  <Slider.Thumb />
                                </Slider.Track>
                              </Slider>
                            </div>
                            <Input
                              className="w-20"
                              max="100"
                              min="0"
                              type="number"
                              value={formData.progress.toString()}
                              onChange={(e: any) =>
                                setFormData({
                                  ...formData,
                                  progress: Number(e.target.value),
                                })
                              }
                            />
                          </div>

                          <div className="grid grid-cols-3 gap-3">
                            <Input
                              min="0"
                              type="number"
                              value={formData.stars.toString()}
                              onChange={(e: any) =>
                                setFormData({
                                  ...formData,
                                  stars: Number(e.target.value),
                                })
                              }
                            />
                            <Input
                              min="0"
                              type="number"
                              value={formData.forks.toString()}
                              onChange={(e: any) =>
                                setFormData({
                                  ...formData,
                                  forks: Number(e.target.value),
                                })
                              }
                            />
                            <Input
                              min="1"
                              type="number"
                              value={formData.contributors.toString()}
                              onChange={(e: any) =>
                                setFormData({
                                  ...formData,
                                  contributors: Number(e.target.value),
                                })
                              }
                            />
                          </div>
                        </div>

                        <TextArea
                          placeholder="React, Node.js, MongoDB, TypeScript..."
                          value={formData.technologies}
                          onChange={(e: any) =>
                            setFormData({
                              ...formData,
                              technologies: e.target.value,
                            })
                          }
                        />

                        <div className="grid md:grid-cols-2 gap-4">
                          <Input
                            placeholder="https://demo.example.com"
                            value={formData.demoUrl}
                            onChange={(e: any) =>
                              setFormData({
                                ...formData,
                                demoUrl: e.target.value,
                              })
                            }
                          />

                          <Input
                            placeholder="https://github.com/username/repo"
                            value={formData.repoUrl}
                            onChange={(e: any) =>
                              setFormData({
                                ...formData,
                                repoUrl: e.target.value,
                              })
                            }
                          />
                        </div>

                        <TextArea
                          placeholder="John Doe, Jane Smith, Alex Johnson..."
                          value={formData.teamMembers}
                          onChange={(e: any) =>
                            setFormData({
                              ...formData,
                              teamMembers: e.target.value,
                            })
                          }
                        />

                        <Switch
                          isSelected={formData.isFeatured}
                          onChange={(value: any) =>
                            setFormData({ ...formData, isFeatured: value })
                          }
                        >
                          <Switch.Content>
                            <Switch.Control>
                              <Switch.Thumb />
                            </Switch.Control>
                            Feature this project on the homepage
                          </Switch.Content>
                        </Switch>
                      </div>
                    </ModalBody>
                    <ModalFooter className="p-6 border-t border-border">
                      <Button
                        isDisabled={saving}
                        variant="secondary"
                        onPress={close}
                      >
                        Cancel
                      </Button>
                      <Button
                        className="bg-primary text-primary-foreground font-semibold"
                        isPending={saving}
                        onPress={handleSave}
                      >
                        {saving
                          ? "Saving..."
                          : isEditing
                            ? "Update Project"
                            : "Create Project"}
                      </Button>
                    </ModalFooter>
                  </>
                )}
              </ModalDialog>
            </ModalContainer>
          </ModalBackdrop>
        </Modal>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);
        }

        .slider::-moz-range-thumb {
          height: 18px;
          width: 18px;
          border-radius: 50%;
          background: linear-gradient(135deg, #8b5cf6, #ec4899);
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(139, 92, 246, 0.3);
        }
      `}</style>
    </div>
  );
}
