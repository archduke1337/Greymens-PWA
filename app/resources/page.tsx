"use client";

import type { Resource, Department } from "@/lib/types";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Chip, Input, Link } from "@heroui/react";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  FolderOpen,
  Inbox,
  Link2,
  Loader2,
  Lock,
  Megaphone,
  Newspaper,
  Search,
  Video,
} from "lucide-react";

import { useAuth } from "@/context/AuthContext";

const LAYERS = [
  { value: "all", label: "All" },
  { value: "common", label: "Everyone" },
  { value: "department", label: "Departments" },
  { value: "role", label: "Roles" },
] as const;

type LayerFilter = (typeof LAYERS)[number]["value"];

const TYPE_ICONS: Record<Resource["type"], typeof FileText> = {
  document: FileText,
  link: Link2,
  video: Video,
  file: FolderOpen,
  newsletter: Newspaper,
  announcement: Megaphone,
};

const LAYER_LABELS: Record<Resource["layer"], string> = {
  common: "Everyone",
  department: "Department",
  role: "Role",
};

// Human-readable scope for locked placeholders. Mirrors the admin console's
// ROLE_OPTIONS one-to-one so the card names exactly the status the server
// compared against.
const ROLE_LABELS: Record<string, string> = {
  member: "Members",
  core_member: "Core members",
  lead: "Leads",
  head: "Heads",
  admin: "Admins",
  dev: "Developers",
};

type LoadState = {
  status: "loading" | "ready" | "error";
  resources: Resource[];
};

/**
 * The member resource library.
 *
 * The member dashboard has always linked here ("Resources → View All") but this
 * route did not exist, so the link answered with a 404.
 *
 * Every item arrives from `/api/resources`, which decides what the caller may
 * see: anonymous visitors receive only `common` resources, members additionally
 * receive departmental ones, and role-scoped material is filtered against the
 * caller's resolved governance status. None of that filtering is repeated here —
 * this component renders whatever the server returns, and a resource the server
 * withheld is simply not in the payload. Re-implementing the rules client-side
 * would produce a second, weaker copy of them, and the browser is the one place
 * they must never be trusted.
 */
export default function ResourcesPage() {
  const [state, setState] = useState<LoadState>({
    status: "loading",
    resources: [],
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [search, setSearch] = useState("");
  const [layer, setLayer] = useState<LayerFilter>("all");
  const [departmentNames, setDepartmentNames] = useState<
    Record<string, string>
  >({});
  const { user } = useAuth();
  // Owner view: pending and sent-back uploads never appear in the library,
  // so this tab is the only place their submitter can see the verdict.
  const [view, setView] = useState<"library" | "mine">("library");
  const [mine, setMine] = useState<LoadState>({
    status: "loading",
    resources: [],
  });

  useEffect(() => {
    // Department names resolve the locked card's scope line ("Available to
    // the Cybersec department"). Best-effort: without the catalogue the card
    // falls back to a generic department label.
    let cancelled = false;

    const loadDepartments = async () => {
      try {
        const response = await fetch("/api/departments", {
          credentials: "include",
        });

        if (!response.ok) return;
        const payload = (await response.json()) as {
          departments?: Department[];
        };
        const names: Record<string, string> = {};

        for (const department of payload.departments ?? []) {
          if (department.$id && department.name)
            names[department.$id] = department.name;
        }
        if (!cancelled) setDepartmentNames(names);
      } catch {
        // Catalogue unreadable — locked cards use the generic label.
      }
    };

    void loadDepartments();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    // The fetch is started here and every state update happens after an await,
    // so the effect never renders synchronously. `cancelled` matters because the
    // request can outlive the component: without it, a slow response would
    // resurrect unmounted state or overwrite a newer reload's result.
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/resources", {
          credentials: "include",
        });

        if (!response.ok) throw new Error("Request failed");
        const payload = (await response.json()) as { resources?: Resource[] };

        if (!cancelled)
          setState({ status: "ready", resources: payload.resources ?? [] });
      } catch {
        if (!cancelled) setState({ status: "error", resources: [] });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (view !== "mine") return;
    let cancelled = false;

    const load = async () => {
      try {
        const response = await fetch("/api/resources?scope=mine", {
          credentials: "include",
        });

        if (!response.ok) throw new Error("Request failed");
        const payload = (await response.json()) as { resources?: Resource[] };

        if (!cancelled)
          setMine({ status: "ready", resources: payload.resources ?? [] });
      } catch {
        if (!cancelled) setMine({ status: "error", resources: [] });
      }
    };

    void load();

    return () => {
      cancelled = true;
    };
  }, [view, reloadKey]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();

    return state.resources
      .filter((resource) => layer === "all" || resource.layer === layer)
      .filter((resource) => {
        if (!term) return true;

        // Tags are searched alongside the text fields because the library is
        // filed by topic far more often than by title.
        return (
          resource.title.toLowerCase().includes(term) ||
          (resource.description ?? "").toLowerCase().includes(term) ||
          (resource.tags ?? []).some((tag) => tag.toLowerCase().includes(term))
        );
      })
      .sort(
        (a, b) =>
          (a.displayOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.displayOrder ?? Number.MAX_SAFE_INTEGER) ||
          a.title.localeCompare(b.title),
      );
  }, [state.resources, search, layer]);

  const retry = () => {
    setState({ status: "loading", resources: [] });
    setReloadKey((key) => key + 1);
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4 md:px-6">
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">
          Resources
        </h1>
        <p className="text-default-500 mt-1 md:mt-2 text-sm md:text-base">
          Documents, links, recordings, and newsletters shared with the club.
        </p>
      </div>

      {user && (
        <div
          aria-label="Choose a view"
          className="mb-6 flex flex-wrap gap-2"
          role="group"
        >
          <Button
            aria-pressed={view === "library"}
            size="sm"
            variant={view === "library" ? "primary" : "ghost"}
            onPress={() => setView("library")}
          >
            Library
          </Button>
          <Button
            aria-pressed={view === "mine"}
            size="sm"
            variant={view === "mine" ? "primary" : "ghost"}
            onPress={() => {
              setMine({ status: "loading", resources: [] });
              setView("mine");
            }}
          >
            My uploads
          </Button>
        </div>
      )}

      {view === "library" && (
        <Card className="border-none shadow-md mb-6">
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4 md:items-center">
              <div className="flex-1">
                <Input
                  aria-label="Search resources"
                  placeholder="Search resources..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div
                aria-label="Filter by audience"
                className="flex flex-wrap gap-2"
                role="group"
              >
                {LAYERS.map((option) => (
                  <Button
                    key={option.value}
                    aria-pressed={layer === option.value}
                    size="sm"
                    variant={layer === option.value ? "primary" : "ghost"}
                    onPress={() => setLayer(option.value)}
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {view === "mine" ? (
        mine.status === "loading" ? (
          <div
            aria-label="Loading your uploads"
            className="flex items-center justify-center py-20"
            role="status"
          >
            <Loader2
              aria-hidden="true"
              className="w-8 h-8 animate-spin text-default-400"
            />
          </div>
        ) : mine.status === "error" ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <AlertCircle className="w-14 h-14 text-danger mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">
                Your uploads could not be loaded
              </h2>
              <p className="text-default-500 mb-6">
                Something went wrong reaching the server. Nothing was changed.
              </p>
              <Button
                variant="primary"
                onPress={() => {
                  setMine({ status: "loading", resources: [] });
                  setReloadKey((key) => key + 1);
                }}
              >
                Try again
              </Button>
            </CardContent>
          </Card>
        ) : mine.resources.length === 0 ? (
          <Card className="border-none shadow-md">
            <CardContent className="p-12 text-center">
              <Inbox className="w-14 h-14 text-default-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold mb-2">
                Nothing submitted yet
              </h2>
              <p className="text-default-500">
                Resources you upload appear here while they wait for review, and
                show the reviewer&apos;s note if one is sent back.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {mine.resources.map((resource) => {
              const TypeIcon = TYPE_ICONS[resource.type] ?? FileText;
              const status = resource.status ?? "approved";

              return (
                <Card key={resource.$id} className="border-none shadow-md">
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0">
                      <TypeIcon className="w-5 h-5 text-default-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold break-words">
                        {resource.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        {status === "pending" ? (
                          <Chip color="warning" size="sm" variant="soft">
                            Pending review
                          </Chip>
                        ) : status === "rejected" ? (
                          <Chip color="danger" size="sm" variant="soft">
                            Sent back
                          </Chip>
                        ) : (
                          <Chip color="success" size="sm" variant="soft">
                            Published
                          </Chip>
                        )}
                        <Chip size="sm" variant="soft">
                          {resource.type}
                        </Chip>
                        <Chip color="accent" size="sm" variant="soft">
                          {LAYER_LABELS[resource.layer] ?? resource.layer}
                        </Chip>
                      </div>
                      {status === "rejected" && resource.rejectionReason && (
                        <p className="text-sm text-danger mt-2">
                          Reviewer note: {resource.rejectionReason}
                        </p>
                      )}
                      {status === "pending" && (
                        <p className="text-sm text-default-500 mt-2">
                          Waiting on a resources manager — other members see
                          this only once it is approved.
                        </p>
                      )}
                    </div>
                    {resource.url && (
                      <Link
                        className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                        href={resource.url}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="w-4 h-4" />
                        Open
                        <span className="sr-only">(opens in a new tab)</span>
                      </Link>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )
      ) : state.status === "loading" ? (
        <div
          aria-label="Loading resources"
          className="flex items-center justify-center py-20"
          role="status"
        >
          <Loader2
            aria-hidden="true"
            className="w-8 h-8 animate-spin text-default-400"
          />
        </div>
      ) : state.status === "error" ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            <AlertCircle className="w-14 h-14 text-danger mx-auto mb-4" />
            <h2 className="text-lg font-semibold mb-2">
              Resources could not be loaded
            </h2>
            <p className="text-default-500 mb-6">
              Something went wrong reaching the server. Nothing was changed.
            </p>
            <Button variant="primary" onPress={retry}>
              Try again
            </Button>
          </CardContent>
        </Card>
      ) : visible.length === 0 ? (
        <Card className="border-none shadow-md">
          <CardContent className="p-12 text-center">
            {state.resources.length === 0 ? (
              <>
                <FolderOpen className="w-14 h-14 text-default-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">No resources yet</h2>
                <p className="text-default-500">
                  Nothing has been shared with you so far. Department and role
                  material appears here once it is published.
                </p>
              </>
            ) : (
              <>
                <Search className="w-14 h-14 text-default-300 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">No matches</h2>
                <p className="text-default-500">
                  Nothing matches that search or filter. Try a different term.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {visible.map((resource) => {
            // Locked placeholder: the server withheld the content, so there
            // is no URL to open, no description to show, and no uploader to
            // name — just the title and who it is restricted to.
            if (resource.locked) {
              const scope =
                resource.layer === "department"
                  ? (resource.departmentId &&
                      departmentNames[resource.departmentId]) ||
                    "a specific department"
                  : ROLE_LABELS[resource.requiredRole ?? ""] ||
                    "specific members";

              return (
                <Card
                  key={resource.$id}
                  className="border-none shadow-md opacity-90"
                >
                  <CardContent className="p-4 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0">
                      <Lock className="w-5 h-5 text-default-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold break-words">
                        {resource.title}
                      </h3>
                      <p className="text-sm text-default-500 mt-1">
                        Available to {scope} — join it to unlock this resource.
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <Chip color="warning" size="sm" variant="soft">
                          Restricted
                        </Chip>
                        <Chip color="accent" size="sm" variant="soft">
                          {LAYER_LABELS[resource.layer] ?? resource.layer}
                        </Chip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            }
            const TypeIcon = TYPE_ICONS[resource.type] ?? FileText;

            return (
              <Card key={resource.$id} className="border-none shadow-md">
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="w-10 h-10 rounded-lg bg-default-100 flex items-center justify-center flex-shrink-0">
                    <TypeIcon className="w-5 h-5 text-default-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold break-words">
                      {resource.title}
                    </h3>
                    {resource.uploadedByName && (
                      <p className="text-xs text-default-500 mt-0.5">
                        Shared by {resource.uploadedByName}
                      </p>
                    )}
                    {resource.description && (
                      <p className="text-sm text-default-500 mt-1 break-words">
                        {resource.description}
                      </p>
                    )}
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <Chip size="sm" variant="soft">
                        {resource.type}
                      </Chip>
                      <Chip color="accent" size="sm" variant="soft">
                        {LAYER_LABELS[resource.layer] ?? resource.layer}
                      </Chip>
                      {(resource.tags ?? []).slice(0, 4).map((tag) => (
                        <Chip key={tag} color="accent" size="sm" variant="soft">
                          {tag}
                        </Chip>
                      ))}
                    </div>
                  </div>
                  {resource.url && !resource.locked && (
                    <Link
                      className="flex-shrink-0 inline-flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
                      href={resource.url}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      <ExternalLink className="w-4 h-4" />
                      Open
                      <span className="sr-only">(opens in a new tab)</span>
                    </Link>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
