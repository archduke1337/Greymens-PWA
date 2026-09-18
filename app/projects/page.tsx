"use client";

import Link from "next/link";
import { title, subtitle } from "@/components/primitives";
import { readApiError } from "@/lib/errorHandler";
import { useState, useEffect, useCallback, useMemo } from "react";
import type { Project } from "@/lib/types";
import { Avatar, AvatarFallback, Button, Card, CardContent, CardFooter, Chip, ProgressBar } from "@heroui/react";
import {
  CodeIcon,
  UsersIcon,
  StarIcon,
  GitBranchIcon,
  CalendarIcon,
  RocketIcon,
  Loader2Icon,
} from "lucide-react";

const categories = [
  { key: "all", label: "All Projects" },
  { key: "ai-ml", label: "AI & ML" },
  { key: "blockchain", label: "Blockchain" },
  { key: "mobile", label: "Mobile" },
  { key: "web", label: "Web" },
  { key: "iot", label: "IoT" },
  { key: "quantum", label: "Quantum" },
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
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState("all");

  const fetchProjects = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/projects");
      const payload = (await response.json()) as { projects?: Project[]; error?: string };
      if (!response.ok) throw new Error(readApiError(payload, "Unable to load projects"));
      setProjects(payload.projects ?? []);
    } catch (caught) {
      console.error("Error fetching projects:", caught);
      setError(caught instanceof Error ? caught.message : "Unable to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

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
        <Chip variant="soft" size="sm">
          <RocketIcon className="w-4 h-4" aria-hidden="true" />
          Member projects
        </Chip>
        <h1 className={title({ size: "lg", class: "block" })}>Built here, not just talked about</h1>
        <p className={subtitle({ class: "mt-4 max-w-2xl mx-auto" })}>
          Tools, labs, and experiments from across the club — most of them
          started as a workshop demo that refused to stay a demo.
        </p>
      </div>

      {/* Category filters */}
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-wrap gap-3 justify-center" role="group" aria-label="Filter projects by category">
          {categoriesWithCount.map((category) => {
            const isSelected = selectedCategory === category.key;
            return (
              <Button
                key={category.key}
                type="button"
                size="sm"
                variant={isSelected ? "primary" : "secondary"}
                aria-pressed={isSelected}
                onPress={() => setSelectedCategory(category.key)}
                className="rounded-full"
              >
                {category.label}
                <span className="ml-2 opacity-70">{category.count}</span>
              </Button>
            );
          })}
        </div>
      </div>

      {/* Loading state */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20" role="status">
          <Loader2Icon className="w-10 h-10 animate-spin text-default-400" aria-hidden="true" />
          <p className="mt-4 text-default-500">Loading projects…</p>
        </div>
      ) : error ? (
        <div className="max-w-7xl mx-auto px-6">
          <Card>
            <CardContent className="text-center items-center py-16 space-y-4">
              <h2 className="text-xl font-semibold">Projects could not be loaded</h2>
              <p className="text-default-500 max-w-md mx-auto">{error}</p>
              <Button variant="primary" onPress={fetchProjects}>
                Try again
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {filteredProjects.map((project) => {
              const statusChip = getStatusChip(project.status);
              return (
                <Card key={project.$id} className="group">
                  <CardContent className="p-0 overflow-hidden rounded-[inherit]">
                    {/* Project image */}
                    <div className="relative bg-default-100">
                      <img
                        src={project.image}
                        alt={`${project.title} preview`}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.display = "none";
                        }}
                        className="w-full h-48 object-cover"
                      />
                      {project.isFeatured && (
                        <div className="absolute top-4 left-4">
                          <Chip color="accent" variant="primary" size="sm">
                            <StarIcon className="w-3 h-3 mr-1" />
                            Featured
                          </Chip>
                        </div>
                      )}
                      <div className="absolute bottom-4 right-4">
                        <Chip color={statusChip.color} variant={statusChip.variant} size="sm">
                          {project.status.replace("-", " ")}
                        </Chip>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4">
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold line-clamp-2">{project.title}</h3>
                        <p className="text-default-500 text-sm line-clamp-2">{project.description}</p>
                      </div>

                      {/* Progress */}
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-default-500">Progress</span>
                          <span className="font-semibold">{project.progress}%</span>
                        </div>
                        <ProgressBar value={project.progress} size="sm" aria-label={`${project.title} progress`}>
                        <ProgressBar.Track>
                          <ProgressBar.Fill />
                        </ProgressBar.Track>
                      </ProgressBar>
                      </div>

                      {/* Stats */}
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <StarIcon className="w-4 h-4 text-default-400" aria-hidden="true" />
                            <span className="font-bold text-sm">{project.stars}</span>
                          </div>
                          <p className="text-xs text-default-400">Stars</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <GitBranchIcon className="w-4 h-4 text-default-400" aria-hidden="true" />
                            <span className="font-bold text-sm">{project.forks}</span>
                          </div>
                          <p className="text-xs text-default-400">Forks</p>
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center justify-center gap-1">
                            <UsersIcon className="w-4 h-4 text-default-400" aria-hidden="true" />
                            <span className="font-bold text-sm">{project.contributors}</span>
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
                          {project.teamMembers?.slice(0, 3).map((member, index) => (
                            <Avatar
                              key={`${member}-${index}`}
                              className="h-8 w-8 border-2 border-background text-xs"
                            >
                              <AvatarFallback>
                                {member?.charAt(0).toUpperCase() || "M"}
                              </AvatarFallback>
                            </Avatar>
                          ))}
                          {project.teamMembers && project.teamMembers.length > 3 && (
                            <Avatar className="h-8 w-8 border-2 border-background text-xs">
                              <AvatarFallback>
                                +{project.teamMembers.length - 3}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </span>
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-4 h-4" aria-hidden="true" />
                          {project.duration}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <CardFooter className="px-6 pb-6 pt-0">
                      <div className="flex gap-2 w-full">
                        {project.demoUrl && (
                          <a
                            href={project.demoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-1"
                          >
                            <span className="block text-center text-sm font-medium underline underline-offset-4 py-2">
                              Live demo
                            </span>
                          </a>
                        )}
                        {project.repoUrl ? (
                          <a href={project.repoUrl} target="_blank" rel="noopener noreferrer" aria-label={`View code for ${project.title} (opens in new tab)`} className="flex-1">
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
                  <CodeIcon className="w-10 h-10 text-default-400" aria-hidden="true" />
                </div>
                <h2 className="text-xl font-semibold">Nothing in this lane yet</h2>
                <p className="text-default-500 max-w-md mx-auto">
                  No project in this category right now. That usually means
                  one is half-built in somebody&apos;s dorm — check back soon.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Have something worth building? */}
          <Card>
            <CardContent className="flex flex-col items-center gap-5 p-6 text-center sm:flex-row sm:text-left">
              <img
                src="/Assets/Media/Do-something.webp"
                alt=""
                aria-hidden="true"
                loading="lazy"
                className="h-28 w-28 shrink-0 rounded-3xl border border-default-200/70 object-cover"
              />
              <div className="min-w-0 flex-1 space-y-1.5">
                <h2 className="text-lg font-bold tracking-tight">Have something worth building?</h2>
                <p className="text-sm leading-relaxed text-muted">
                  Projects start as conversations: at a workshop, over coffee,
                  in the Discord. Bring the itch; we&apos;ll help scratch it
                  properly, with a lead, a scope, and a handover.
                </p>
              </div>
              <div className="flex shrink-0 flex-wrap justify-center gap-2">
                <Link href="/events">
                  <Button className="rounded-full px-5">
                    Find a workshop
                  </Button>
                </Link>
                <Link href="/contact">
                  <Button variant="secondary" className="rounded-full px-5">
                    Talk to us
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
