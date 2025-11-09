"use client";

import { Card, CardBody, CardHeader } from "@heroui/card";
import { Button } from "@heroui/button";
import { Input } from "@heroui/input";
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from "@heroui/table";
import { Chip } from "@heroui/chip";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure } from "@heroui/modal";
import { Textarea } from "@heroui/input";
import { Select, SelectItem } from "@heroui/select";
import { Switch } from "@heroui/switch";
import { useEffect, useState } from "react";
import { projectService, Project } from "@/lib/database";
import { getErrorMessage } from "@/lib/errorHandler";
import { PlusIcon, Edit2Icon, TrashIcon, SaveIcon, Loader2Icon, ImageIcon, UsersIcon, GitForkIcon, StarIcon, FolderIcon, InfoIcon, LightbulbIcon } from "lucide-react";

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
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
    { key: "ai-ml", label: "🤖 AI & ML" },
    { key: "blockchain", label: "⛓️ Blockchain" },
    { key: "mobile", label: "📱 Mobile" },
    { key: "web", label: "🌐 Web" },
    { key: "iot", label: "🔌 IoT" },
    { key: "quantum", label: "⚛️ Quantum" },
  ];

  const statuses = [
    { key: "planning", label: "📋 Planning" },
    { key: "in-progress", label: "🚧 In Progress" },
    { key: "completed", label: "✅ Completed" },
  ];

  // Admin tips
  const adminTips = [
    "💡 Use high-quality images from Unsplash for better project presentation",
    "💡 Set realistic progress percentages to track project development accurately",
    "💡 Feature important projects to highlight them on the homepage",
    "💡 Use commas to separate technologies and team members for better organization",
    "💡 Update project status regularly to keep members informed",
    "💡 Add demo and repository links to showcase live projects"
  ];

  // Fetch projects
  const fetchProjects = async () => {
    try {
      setLoading(true);
      const data = await projectService.getAllProjects();
      setProjects(data);
    } catch (error) {
      console.error("Error fetching projects:", error);
      alert("Failed to fetch projects. Check console for details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

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
    onOpen();
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
      technologies: Array.isArray(project.technologies) ? project.technologies.join(", ") : "",
      stars: project.stars,
      forks: project.forks,
      contributors: project.contributors,
      duration: project.duration,
      isFeatured: project.isFeatured,
      demoUrl: project.demoUrl || "",
      repoUrl: project.repoUrl || "",
      teamMembers: Array.isArray(project.teamMembers) ? project.teamMembers.join(", ") : "",
    });
    onOpen();
  };

  // Validate form
  const validateForm = () => {
    if (!formData.title.trim()) {
      alert("❌ Please enter a project title");
      return false;
    }
    if (!formData.description.trim()) {
      alert("❌ Please enter a project description");
      return false;
    }
    if (!formData.image.trim()) {
      alert("❌ Please enter an image URL");
      return false;
    }
    if (!formData.duration.trim()) {
      alert("❌ Please enter project duration");
      return false;
    }
    if (formData.progress < 0 || formData.progress > 100) {
      alert("❌ Progress must be between 0 and 100");
      return false;
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
          .map(t => t.trim())
          .filter(t => t),
        stars: Number(formData.stars),
        forks: Number(formData.forks),
        contributors: Number(formData.contributors),
        duration: formData.duration.trim(),
        isFeatured: formData.isFeatured,
        demoUrl: formData.demoUrl.trim(),
        repoUrl: formData.repoUrl.trim(),
        teamMembers: formData.teamMembers
          .split(",")
          .map(t => t.trim())
          .filter(t => t),
        createdAt: isEditing ? selectedProject?.createdAt || new Date().toISOString() : new Date().toISOString(),
      };

      if (isEditing && selectedProject?.$id) {
        await projectService.updateProject(selectedProject.$id, projectData);
        alert("✅ Project updated successfully!");
      } else {
        await projectService.createProject(projectData);
        alert("✅ Project created successfully!");
      }

      onClose();
      fetchProjects();
      resetForm();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error saving project:", message);
      alert(`❌ Failed to save project: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  // Delete project
  const handleDelete = async (projectId: string) => {
    if (!confirm("⚠️ Are you sure you want to delete this project? This action cannot be undone.")) return;

    try {
      await projectService.deleteProject(projectId);
      alert("✅ Project deleted successfully!");
      fetchProjects();
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Error deleting project:", message);
      alert(`❌ Failed to delete project: ${message}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "success";
      case "in-progress": return "primary";
      case "planning": return "warning";
      default: return "default";
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "ai-ml": return "secondary";
      case "blockchain": return "success";
      case "mobile": return "primary";
      case "web": return "warning";
      case "iot": return "default";
      case "quantum": return "danger";
      default: return "default";
    }
  };

  return (
    <div className="min-h-screen  p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header Section */}
        <div className="text-center space-y-4 relative">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" />
          <div className="absolute top-10 right-1/3 w-72 h-72 bg-pink-500/10 rounded-full blur-3xl animate-pulse" />
          
          <div className="relative z-10">
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              Project Management
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400 mt-2 max-w-2xl mx-auto">
              Manage and organize all club projects
            </p>
          </div>
        </div>

        {/* Admin Tips Section */}
        <Card className="border-none shadow-lg bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30">
          <CardBody className="p-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center flex-shrink-0">
                <LightbulbIcon className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  Admin Tips & Best Practices
                </h3>
                <div className="grid md:grid-cols-2 gap-3">
                  {adminTips.map((tip, index) => (
                    <div key={index} className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <span className="flex-shrink-0 mt-0.5">{tip.split(' ')[0]}</span>
                      <span>{tip.split(' ').slice(1).join(' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Main Content */}
        <div className="grid lg:grid-cols-4 gap-8">
          {/* Projects Table */}
          <div className="lg:col-span-3">
            <Card className="border-none shadow-xl" shadow="lg">
              <CardHeader className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-6 pt-6 pb-0">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">Projects</h2>
                  <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">
                    {projects.length} project{projects.length !== 1 ? 's' : ''} total
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
                  startContent={<PlusIcon className="w-5 h-5" />}
                  onPress={handleAdd}
                >
                  New Project
                </Button>
              </CardHeader>
              <CardBody className="p-6">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-16">
                    <Loader2Icon className="w-12 h-12 animate-spin text-purple-500 mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Loading projects...</p>
                  </div>
                ) : projects.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 flex items-center justify-center">
                      <FolderIcon className="w-12 h-12 text-purple-500" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">No projects yet</h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Start by creating your first project to showcase your work and attract more contributors
                    </p>
                    <Button
                      size="lg"
                      className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold"
                      startContent={<PlusIcon className="w-5 h-5" />}
                      onPress={handleAdd}
                    >
                      Create First Project
                    </Button>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table 
                      aria-label="Projects table" 
                      className="min-w-full"
                      classNames={{
                        wrapper: "shadow-none border-none",
                        th: "bg-transparent text-gray-700 dark:text-gray-300 font-semibold border-b border-gray-200 dark:border-gray-700",
                        td: "border-b border-gray-100 dark:border-gray-800",
                      }}
                    >
                      <TableHeader>
                        <TableColumn className="text-sm">PROJECT</TableColumn>
                        <TableColumn className="text-sm">CATEGORY</TableColumn>
                        <TableColumn className="text-sm">STATUS</TableColumn>
                        <TableColumn className="text-sm">PROGRESS</TableColumn>
                        <TableColumn className="text-sm">FEATURED</TableColumn>
                        <TableColumn className="text-sm">ACTIONS</TableColumn>
                      </TableHeader>
                      <TableBody>
                        {projects.map((project) => (
                          <TableRow key={project.$id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                            <TableCell>
                              <div className="flex items-center gap-4">
                                <div className="relative flex-shrink-0">
                                  <img
                                    src={project.image}
                                    alt={project.title}
                                    className="w-14 h-14 rounded-xl object-cover shadow-sm"
                                    onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = "https://via.placeholder.com/150?text=No+Image";
                                    }}
                                  />
                                  <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full border-2 border-white dark:border-gray-800 flex items-center justify-center">
                                    <ImageIcon className="w-3 h-3 text-white" />
                                  </div>
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{project.title}</p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-1 mt-1">
                                    {project.description}
                                  </p>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Chip 
                                size="sm" 
                                variant="flat" 
                                color={getCategoryColor(project.category) as any}
                                classNames={{
                                  base: "capitalize font-medium"
                                }}
                              >
                                {project.category.replace('-', ' ')}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <Chip
                                size="sm"
                                color={getStatusColor(project.status) as any}
                                variant="dot"
                                classNames={{
                                  base: "capitalize font-medium"
                                }}
                              >
                                {project.status.replace('-', ' ')}
                              </Chip>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-20 bg-gray-200 dark:bg-gray-700 rounded-full h-2 flex-1">
                                  <div
                                    className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-300"
                                    style={{ width: `${project.progress}%` }}
                                  />
                                </div>
                                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 min-w-8">{project.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {project.isFeatured ? (
                                <Chip 
                                  size="sm" 
                                  color="warning" 
                                  variant="flat" 
                                  startContent={<StarIcon className="w-3 h-3" />}
                                  classNames={{
                                    base: "font-medium"
                                  }}
                                >
                                  Featured
                                </Chip>
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  onPress={() => handleEdit(project)}
                                  className="text-gray-600 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-all"
                                >
                                  <Edit2Icon className="w-4 h-4" />
                                </Button>
                                <Button
                                  isIconOnly
                                  size="sm"
                                  variant="light"
                                  color="danger"
                                  onPress={() => handleDelete(project.$id!)}
                                  className="text-gray-600 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                                >
                                  <TrashIcon className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>

          {/* Stats Sidebar */}
          <div className="space-y-6">
            {/* Quick Stats */}
            <Card className="border-none shadow-xl" shadow="lg">
              <CardHeader className="px-6 pt-6 pb-0">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Project Overview</h3>
              </CardHeader>
              <CardBody className="p-6 space-y-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Projects</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">{projects.length}</p>
                  </div>
                  <FolderIcon className="w-8 h-8 text-purple-500" />
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">In Progress</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {projects.filter(p => p.status === 'in-progress').length}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                    <Loader2Icon className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Completed</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {projects.filter(p => p.status === 'completed').length}
                    </p>
                  </div>
                  <div className="w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                    </svg>
                  </div>
                </div>
                <div className="flex items-center justify-between p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Featured</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {projects.filter(p => p.isFeatured).length}
                    </p>
                  </div>
                  <StarIcon className="w-8 h-8 text-yellow-500" />
                </div>
              </CardBody>
            </Card>
          </div>
        </div>
        {/* Add/Edit Modal */}
        <Modal
          isOpen={isOpen}
          onClose={onClose}
          size="2xl"
          scrollBehavior="inside"
          classNames={{
            base: "border-none",
            backdrop: "bg-gradient-to-t from-zinc-900/50 to-zinc-900/50 backdrop-opacity-20",
          }}
        >
          <ModalContent>
            <ModalHeader className="flex flex-col gap-1 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg flex items-center justify-center">
                  {isEditing ? (
                    <Edit2Icon className="w-5 h-5 text-white" />
                  ) : (
                    <PlusIcon className="w-5 h-5 text-white" />
                  )}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    {isEditing ? "Edit Project" : "Create New Project"}
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {isEditing ? "Update project details and progress" : "Add a new project to showcase your work"}
                  </p>
                </div>
              </div>
            </ModalHeader>
            <ModalBody className="p-6 gap-6">
              <div className="space-y-6">
                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Project Title"
                    placeholder="Enter project title"
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    isRequired
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  />
                  <Input
                    label="Duration"
                    placeholder="3 months"
                    value={formData.duration}
                    onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                    isRequired
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  />
                </div>

                <Textarea
                  label="Description"
                  placeholder="Describe your project goals, features, and impact..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  isRequired
                  variant="bordered"
                  minRows={3}
                  classNames={{
                    label: "text-gray-700 dark:text-gray-300",
                  }}
                />

                <Input
                  label="Image URL"
                  placeholder="https://images.unsplash.com/photo-..."
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  isRequired
                  variant="bordered"
                  description="Use high-quality images from Unsplash or similar platforms"
                  classNames={{
                    label: "text-gray-700 dark:text-gray-300",
                    description: "text-gray-500 dark:text-gray-400",
                  }}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <Select
                    label="Category"
                    selectedKeys={[formData.category]}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  >
                    {categories.map((cat) => (
                      <SelectItem key={cat.key} textValue={cat.label}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </Select>

                  <Select
                    label="Status"
                    selectedKeys={[formData.status]}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  >
                    {statuses.map((status) => (
                      <SelectItem key={status.key} textValue={status.label}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </Select>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-sm text-gray-700 dark:text-gray-300 block mb-2">
                        Progress: {formData.progress}%
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={formData.progress}
                        onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                        className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
                      />
                    </div>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.progress.toString()}
                      onChange={(e) => setFormData({ ...formData, progress: Number(e.target.value) })}
                      variant="bordered"
                      className="w-20"
                      classNames={{
                        input: "text-center",
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <Input
                      label="Stars"
                      type="number"
                      min="0"
                      value={formData.stars.toString()}
                      onChange={(e) => setFormData({ ...formData, stars: Number(e.target.value) })}
                      variant="bordered"
                      startContent={<StarIcon className="w-4 h-4 text-gray-400" />}
                      classNames={{
                        label: "text-gray-700 dark:text-gray-300",
                      }}
                    />
                    <Input
                      label="Forks"
                      type="number"
                      min="0"
                      value={formData.forks.toString()}
                      onChange={(e) => setFormData({ ...formData, forks: Number(e.target.value) })}
                      variant="bordered"
                      startContent={<GitForkIcon className="w-4 h-4 text-gray-400" />}
                      classNames={{
                        label: "text-gray-700 dark:text-gray-300",
                      }}
                    />
                    <Input
                      label="Contributors"
                      type="number"
                      min="1"
                      value={formData.contributors.toString()}
                      onChange={(e) => setFormData({ ...formData, contributors: Number(e.target.value) })}
                      variant="bordered"
                      startContent={<UsersIcon className="w-4 h-4 text-gray-400" />}
                      classNames={{
                        label: "text-gray-700 dark:text-gray-300",
                      }}
                    />
                  </div>
                </div>

                <Textarea
                  label="Technologies"
                  placeholder="React, Node.js, MongoDB, TypeScript..."
                  value={formData.technologies}
                  onChange={(e) => setFormData({ ...formData, technologies: e.target.value })}
                  variant="bordered"
                  description="Separate technologies with commas"
                  minRows={2}
                  classNames={{
                    label: "text-gray-700 dark:text-gray-300",
                    description: "text-gray-500 dark:text-gray-400",
                  }}
                />

                <div className="grid md:grid-cols-2 gap-4">
                  <Input
                    label="Demo URL"
                    placeholder="https://demo.example.com"
                    value={formData.demoUrl}
                    onChange={(e) => setFormData({ ...formData, demoUrl: e.target.value })}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  />

                  <Input
                    label="Repository URL"
                    placeholder="https://github.com/username/repo"
                    value={formData.repoUrl}
                    onChange={(e) => setFormData({ ...formData, repoUrl: e.target.value })}
                    variant="bordered"
                    classNames={{
                      label: "text-gray-700 dark:text-gray-300",
                    }}
                  />
                </div>

                <Textarea
                  label="Team Members"
                  placeholder="John Doe, Jane Smith, Alex Johnson..."
                  value={formData.teamMembers}
                  onChange={(e) => setFormData({ ...formData, teamMembers: e.target.value })}
                  variant="bordered"
                  description="Separate names with commas"
                  minRows={2}
                  classNames={{
                    label: "text-gray-700 dark:text-gray-300",
                    description: "text-gray-500 dark:text-gray-400",
                  }}
                />

                <Switch
                  isSelected={formData.isFeatured}
                  onValueChange={(value) => setFormData({ ...formData, isFeatured: value })}
                  classNames={{
                    wrapper: "group-data-[selected=true]:bg-gradient-to-r from-purple-500 to-pink-500",
                    label: "text-gray-700 dark:text-gray-300 text-sm",
                  }}
                >
                  Feature this project on the homepage
                </Switch>
              </div>
            </ModalBody>
            <ModalFooter className="p-6 border-t border-gray-200 dark:border-gray-700">
              <Button variant="light" onPress={onClose} isDisabled={saving}>
                Cancel
              </Button>
              <Button
                color="primary"
                onPress={handleSave}
                isLoading={saving}
                startContent={!saving && <SaveIcon className="w-4 h-4" />}
                className="bg-gradient-to-r from-purple-600 to-pink-500 text-white font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all"
              >
                {saving ? "Saving..." : isEditing ? "Update Project" : "Create Project"}
              </Button>
            </ModalFooter>
          </ModalContent>
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