"use client";

import type { Project } from "@/lib/types";

import { useState, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardFooter,
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
  ProgressBar,
  Select,
  TextArea,
  useOverlayState,
} from "@heroui/react";
import {
  CodeIcon,
  UsersIcon,
  StarIcon,
  GitBranchIcon,
  CalendarIcon,
  RocketIcon,
  Loader2Icon,
  PlusIcon,
} from "lucide-react";
import { toast } from "sonner";

import LinkButton from "@/components/ui/LinkButton";
import { title, subtitle } from "@/components/primitives";
import { useAuth } from "@/context/AuthContext";
import { readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";

const categories = [
  { key: "all", label: "All Projects" },
  { key: "ai-ml", label: "AI & ML" },
  { key: "blockchain", label: "Blockchain" },
  { key: "mobile", label: "Mobile" },
  { key: "web", label: "Web" },
  { key: "iot", label: "IoT" },
  { key: "quantum", label: "Quantum" },
  { key: "cybersecurity", label: "Cybersecurity" },
];

const getStatusChip = (status: string) => {
  switch (status) {
    case "completed":
      return { color: "success" as const, variant: "soft" as const };
    case "in-progress":
      return { color: "accent" as const, variant: "soft" as const };
    case "planning":
      return { color: "warning" as const, variant: "soft" as const };
    default:
      return { color: "default" as const, variant: "soft" as const };
  }
};

export default function ProjectsPage() {
  const { user } = useAuth();
  const { isOpen, open, close } = useOverlayState();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    image: "",
    category: "web",
    technologies: "",
    duration: "",
    demoUrl: "",
    repoUrl: "",
    teamMembers: "",
  });

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      // Signed-in members read with scope=mine so their own pending
      // proposals ride along (marked in review); everyone else sees only
      // published work. Credentials are required for the server to know who
      // is asking.
      const query = user ? "?scope=mine" : "";
      const response = await fetch(`/api/projects${query}`, {
        credentials: "include",
      });
      const payload = (await response.json()) as {
        projects?: Project[];
        error?: string;
      };

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to load projects"));
      setProjects(payload.projects ?? []);
    } catch (caught) {
      logError("Error fetching projects:", caught);
      setError(
        caught instanceof Error ? caught.message : "Unable to load projects",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handlePropose = async () => {
    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.image.trim() ||
      !form.duration.trim()
    ) {
      toast.error("Title, description, image, and duration are required");

      return;
    }
    if (!/^https?:\/\/.+/i.test(form.image.trim())) {
      toast.error("Image must be a valid http(s) URL");

      return;
    }
    for (const [value, label] of [
      [form.demoUrl, "Demo URL"],
      [form.repoUrl, "Repository URL"],
    ] as const) {
      if (value.trim() && !/^https?:\/\/.+/i.test(value.trim())) {
        toast.error(`${label} must be a valid http(s) URL or left empty`);

        return;
      }
    }
    setSending(true);
    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim(),
          image: form.image.trim(),
          category: form.category,
          technologies: form.technologies
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          duration: form.duration.trim(),
          demoUrl: form.demoUrl.trim(),
          repoUrl: form.repoUrl.trim(),
          teamMembers: form.teamMembers
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to submit project"));
      toast.success("Proposal submitted — visible after review");
      close();
      setForm({
        title: "",
        description: "",
        image: "",
        category: "web",
        technologies: "",
        duration: "",
        demoUrl: "",
        repoUrl: "",
        teamMembers: "",
      });
      await fetchProjects();
    } catch (caught) {
      logError("Error proposing project:", caught);
      toast.error(
        caught instanceof Error ? caught.message : "Unable to submit project",
      );
    } finally {
      setSending(false);
    }
  };

  const categoriesWithCount = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        count:
          cat.key === "all"
            ? projects.length
            : projects.filter((p) => p.category === cat.key).length,
      })),
    [projects],
  );

  const filteredProjects = useMemo(
    () =>
      selectedCategory === "all"
        ? projects
        : projects.filter((project) => project.category === selectedCategory),
    [projects, selectedCategory],
  );

  return (
    <div className="space-y-12 pb-20">
      {/* Header */}
      <div className="text-center space-y-4 py-12">
        <Chip size="sm" variant="soft">
          <RocketIcon aria-hidden="true" className="w-4 h-4" />
          Member projects
        </Chip>
        <h1 className={title({ size: "lg", class: "block" })}>
          Built here, not just talked about
        </h1>
        <p className={subtitle({ class: "mt-4 max-w-2xl mx-auto" })}>
          Tools, labs, and experiments from across the club — most of them
          started as a workshop demo that refused to stay a demo.
        </p>
      </div>

      {/* Category filters */}
      <div className="max-w-7xl mx-auto px-6">
        <div
          aria-label="Filter projects by category"
          className="flex flex-wrap gap-3 justify-center"
          role="group"
        >
          {categoriesWithCount.map((category) => {
            const isSelected = selectedCategory === category.key;

            return (
              <Button
                key={category.key}
                aria-pressed={isSelected}
                className="rounded-full"
                size="sm"
                type="button"
                variant={isSelected ? "primary" : "secondary"}
                onPress={() => setSelectedCategory(category.key)}
              >
                {category.label}
                <span className="ml-2 opacity-70">{category.count}</span>
              </Button>
            );
          })}
        </div>
        {user && (
          <div className="mt-6 text-center">
            <Button variant="primary" onPress={open}>
              <PlusIcon aria-hidden="true" className="w-4 h-4" />
              Propose a project
            </Button>
            <p className="mt-2 text-xs text-default-400">
              Member proposals appear here after review.
            </p>
          </div>
        )}
      </div>

      {/* Loading state */}
      {loading ? (
        <div
          className="flex flex-col items-center justify-center py-20"
          role="status"
        >
          <Loader2Icon
            aria-hidden="true"
            className="w-10 h-10 animate-spin text-default-400"
          />
          <p className="mt-4 text-default-500">Loading projects…</p>
        </div>
      ) : error ? (
        <div className="max-w-7xl mx-auto px-6">
          <Card>
            <CardContent className="text-center items-center py-16 space-y-4">
              <h2 className="text-xl font-semibold">
                Projects could not be loaded
              </h2>
              <p className="text-default-500 max-w-md mx-auto">{error}</p>
              <Button variant="primary" onPress={fetchProjects}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6 space-y-8">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredProjects.map((project) => {
              const statusChip = getStatusChip(project.status);

              return (
                <Card key={project.$id} className="group">
                  <CardContent className="p-0 overflow-hidden rounded-[inherit]">
                    {/* Project image */}
                    <div className="relative bg-default-100 min-h-48">
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center"
                      >
                        <CodeIcon className="w-10 h-10 text-default-300" />
                      </span>
                      <Image
                        unoptimized
                        alt={`${project.title} preview`}
                        className="relative w-full h-48 object-cover"
                        height={192}
                        loading="lazy"
                        src={project.image}
                        width={800}
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                      />
                      {project.isFeatured && (
                        <div className="absolute top-4 left-4">
                          <Chip color="accent" size="sm" variant="primary">
                            <StarIcon className="w-3 h-3 mr-1" />
                            Featured
                          </Chip>
                        </div>
                      )}
                      <div className="absolute right-4 top-4 flex flex-col items-end gap-1.5">
                        <Chip
                          color={statusChip.color}
                          size="sm"
                          variant={statusChip.variant}
                        >
                          {project.status.replace("-", " ")}
                        </Chip>
                        {project.reviewStatus === "review" && (
                          <Chip color="warning" size="sm" variant="soft">
                            In review
                          </Chip>
                        )}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold line-clamp-2">
                          {project.title}
                        </h3>
                        <p className="text-default-500 text-sm line-clamp-2">
                          {project.description}
                        </p>
                      </div>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-default-500">Progress</span>
                          <span className="font-semibold">
                            {project.progress}%
                          </span>
                        </div>
                        <ProgressBar
                          aria-label={`${project.title} progress`}
                          size="sm"
                          value={project.progress}
                        >
                          <ProgressBar.Track>
                            <ProgressBar.Fill />
                          </ProgressBar.Track>
                        </ProgressBar>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <StarIcon
                              aria-hidden="true"
                              className="w-4 h-4 text-default-400"
                            />
                            <span className="font-bold text-sm">
                              {project.stars}
                            </span>
                          </div>
                          <p className="text-xs text-default-400">Stars</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <GitBranchIcon
                              aria-hidden="true"
                              className="w-4 h-4 text-default-400"
                            />
                            <span className="font-bold text-sm">
                              {project.forks}
                            </span>
                          </div>
                          <p className="text-xs text-default-400">Forks</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <UsersIcon
                              aria-hidden="true"
                              className="w-4 h-4 text-default-400"
                            />
                            <span className="font-bold text-sm">
                              {project.contributors}
                            </span>
                          </div>
                          <p className="text-xs text-default-400">Team</p>
                        </div>
                      </div>

                      {/* Technologies */}
                      <div className="flex flex-wrap gap-1">
                        {project.technologies.slice(0, 3).map((tech) => (
                          <Chip key={tech} size="sm" variant="soft">
                            {tech}
                          </Chip>
                        ))}
                        {project.technologies.length > 3 && (
                          <Chip size="sm" variant="soft">
                            +{project.technologies.length - 3}
                          </Chip>
                        )}
                      </div>

                      {/* Team and duration */}
                      <div className="flex items-center justify-between text-sm text-default-500">
                        <span className="flex -space-x-2">
                          {project.teamMembers
                            ?.slice(0, 3)
                            .map((member, index) => (
                              <Avatar
                                key={`${member}-${index}`}
                                className="h-8 w-8 border-2 border-background text-xs"
                              >
                                <AvatarFallback>
                                  {member?.charAt(0).toUpperCase() || "M"}
                                </AvatarFallback>
                              </Avatar>
                            ))}
                          {project.teamMembers &&
                            project.teamMembers.length > 3 && (
                              <Avatar className="h-8 w-8 border-2 border-background text-xs">
                                <AvatarFallback>
                                  +{project.teamMembers.length - 3}
                                </AvatarFallback>
                              </Avatar>
                            )}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon
                            aria-hidden="true"
                            className="w-4 h-4"
                          />
                          {project.duration}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <CardFooter className="px-6 pb-6 pt-0">
                      <div className="flex gap-2 w-full">
                        {project.demoUrl && (
                          <a
                            className="flex-1"
                            href={project.demoUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <span className="block text-center text-sm font-medium underline underline-offset-4 py-2">
                              Live demo
                            </span>
                          </a>
                        )}
                        {project.repoUrl ? (
                          <a
                            aria-label={`View code for ${project.title} (opens in new tab)`}
                            className="flex-1"
                            href={project.repoUrl}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <span className="block text-center text-sm font-medium underline underline-offset-4 py-2">
                              View code
                            </span>
                          </a>
                        ) : (
                          <span className="flex-1 block text-center text-sm text-default-400 py-2">
                            Code not shared
                          </span>
                        )}
                      </div>
                    </CardFooter>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Empty state */}
          {filteredProjects.length === 0 && (
            <Card>
              <CardContent className="text-center py-16 space-y-3">
                <div className="w-20 h-20 mx-auto mb-2 rounded-full bg-default-100 flex items-center justify-center">
                  <CodeIcon
                    aria-hidden="true"
                    className="w-10 h-10 text-default-400"
                  />
                </div>
                <h2 className="text-xl font-semibold">
                  Nothing in this lane yet
                </h2>
                <p className="text-default-500 max-w-md mx-auto">
                  No project in this category right now. That usually means one
                  is half-built in somebody&apos;s dorm — check back soon.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Have something worth building? */}
          <Card>
            <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
              <Image
                alt=""
                aria-hidden="true"
                className="h-28 w-28 shrink-0 rounded-3xl border border-default-200/70 object-cover"
                height={224}
                loading="lazy"
                src="/Assets/Media/Do-something.webp"
                width={224}
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight">
                  Have something worth building?
                </h2>
                <p className="text-sm leading-relaxed text-muted">
                  Projects start as conversations: at a workshop, over coffee,
                  in the Discord. Bring the itch; we&apos;ll help scratch it
                  properly, with a lead, a scope, and a handover.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-center gap-2">
                <LinkButton className="rounded-full px-5" href="/events">
                  Find a workshop
                </LinkButton>
                <LinkButton
                  className="rounded-full px-5"
                  href="/contact"
                  variant="secondary"
                >
                  Talk to us
                </LinkButton>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Propose a project */}
      <Modal>
        <ModalBackdrop
          isOpen={isOpen}
          onOpenChange={(o) => {
            if (!o) close();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Propose a project</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm text-default-500">
                    Tell us what you want to build. A lead reviews every
                    proposal before it appears here.
                  </p>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Title{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <Input
                      placeholder="Project title"
                      value={form.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({ ...p, title: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Description{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <TextArea
                      placeholder="What does it do, who is it for?"
                      rows={3}
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
                        value={form.category}
                        onChange={(value) =>
                          setForm((p) => ({
                            ...p,
                            category: String(value ?? "web"),
                          }))
                        }
                      >
                        <Label>
                          Category{" "}
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
                            {categories
                              .filter((c) => c.key !== "all")
                              .map((c) => (
                                <ListBox.Item
                                  key={c.key}
                                  id={c.key}
                                  textValue={c.label}
                                >
                                  {c.label}
                                  <ListBox.ItemIndicator />
                                </ListBox.Item>
                              ))}
                          </ListBox>
                        </Select.Popover>
                      </Select>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Duration{" "}
                        <span aria-hidden="true" className="text-danger">
                          *
                        </span>
                      </label>
                      <Input
                        placeholder="e.g. 6 weeks"
                        value={form.duration}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((p) => ({ ...p, duration: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Image URL{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <Input
                      placeholder="https://…"
                      value={form.image}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({ ...p, image: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Technologies{" "}
                      <span className="font-normal text-default-400">
                        (optional, comma separated)
                      </span>
                    </label>
                    <Input
                      placeholder="Next.js, Appwrite, Tailwind"
                      value={form.technologies}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({
                          ...p,
                          technologies: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Demo URL{" "}
                        <span className="font-normal text-default-400">
                          (optional)
                        </span>
                      </label>
                      <Input
                        placeholder="https://…"
                        value={form.demoUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((p) => ({ ...p, demoUrl: e.target.value }))
                        }
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-1 block">
                        Repository URL{" "}
                        <span className="font-normal text-default-400">
                          (optional)
                        </span>
                      </label>
                      <Input
                        placeholder="https://…"
                        value={form.repoUrl}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setForm((p) => ({ ...p, repoUrl: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-1 block">
                      Team members{" "}
                      <span className="font-normal text-default-400">
                        (optional, comma separated)
                      </span>
                    </label>
                    <Input
                      placeholder="Who is building it with you?"
                      value={form.teamMembers}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setForm((p) => ({
                          ...p,
                          teamMembers: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button variant="secondary" onPress={close}>
                  Cancel
                </Button>
                <Button
                  isPending={sending}
                  variant="primary"
                  onPress={handlePropose}
                >
                  Submit proposal
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
