"use client";

import type { Resource } from "@/lib/types";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, CardContent, Chip, Input, Link } from "@heroui/react";
import {
  AlertCircle,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Megaphone,
  Search,
  Video,
} from "lucide-react";

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
  announcement: Megaphone,
};

const LAYER_LABELS: Record<Resource["layer"], string> = {
  common: "Everyone",
  department: "Department",
  role: "Role",
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
          Documents, links and recordings shared with the club.
        </p>
      </div>

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

      {state.status === "loading" ? (
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
      )}
    </div>
  );
}
