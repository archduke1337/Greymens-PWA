"use client";

import type { Resource, Department } from "@/lib/types";

import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Card,
  CardContent,
  Chip,
  Input,
  Label,
  Link,
  ListBox,
  Modal,
  ModalBackdrop,
  ModalBody,
  ModalContainer,
  ModalDialog,
  ModalFooter,
  ModalHeader,
  Select,
  TextArea,
  useOverlayState,
} from "@heroui/react";
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
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";

import { usePermissions } from "@/context/PermissionContext";
import { getErrorMessage, readApiError } from "@/lib/errorHandler";
import { logError } from "@/lib/logger";
import { storage, ID } from "@/lib/appwrite";

const LAYERS = [
  { value: "all", label: "All" },
  { value: "common", label: "Everyone" },
  { value: "department", label: "Departments" },
  { value: "role", label: "Roles" },
] as const;

type LayerFilter = (typeof LAYERS)[number]["value"];

// What a member can submit. Mirrors the server allowlists in
// /api/resources: `announcement` is legacy and deliberately not offered for
// new uploads, and the role vocabulary is the membership status set.
const UPLOAD_TYPES = [
  { value: "document", label: "Document" },
  { value: "link", label: "Link" },
  { value: "video", label: "Video" },
  { value: "file", label: "File" },
  { value: "newsletter", label: "Newsletter" },
] as const;

const UPLOAD_LAYERS = [
  { value: "common", label: "Everyone" },
  { value: "department", label: "A department" },
  { value: "role", label: "A member status" },
] as const;

const UPLOAD_ROLES = [
  { value: "member", label: "Members" },
  { value: "core_member", label: "Core members" },
  { value: "lead", label: "Leads" },
  { value: "head", label: "Heads" },
  { value: "admin", label: "Admins" },
  { value: "dev", label: "Developers" },
] as const;

const ALLOWED_FILE_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/zip",
]);
const MAX_FILE_BYTES = 50 * 1024 * 1024;

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
  // Owner view: pending and sent-back uploads never appear in the library,
  // so this tab is the only place their submitter can see the verdict.
  const [view, setView] = useState<"library" | "mine">("library");
  const [mine, setMine] = useState<LoadState>({
    status: "loading",
    resources: [],
  });
  const { isRoleOrAbove } = usePermissions();
  // Mirrors the server: POST /api/resources requires membership.
  const canUpload = isRoleOrAbove("member");
  const {
    isOpen: isUploadOpen,
    open: openUpload,
    close: closeUpload,
  } = useOverlayState();
  const [uploading, setUploading] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: "",
    description: "",
    category: "common" as "common" | "department" | "role",
    type: "document" as Resource["type"],
    url: "",
    tags: "",
    departmentId: "",
    requiredRole: "member",
  });
  const emptyUploadForm = {
    title: "",
    description: "",
    category: "common" as "common" | "department" | "role",
    type: "document" as Resource["type"],
    url: "",
    tags: "",
    departmentId: "",
    requiredRole: "member",
  };

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
    // Fetched for every signed-in member, not only while the tab is open: the
    // count of waiting items is the one signal a submitter gets that something
    // was sent back, and it doubles as the badge on the tab.
    if (!canUpload) return;
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
  }, [canUpload, reloadKey]);

  /**
   * Member submission. The server queues it as `pending` (or publishes it on
   * the spot for a resources manager), so the copy must match whatever the
   * row actually came back as rather than promising a review that may not
   * happen. Validation mirrors the server's expensive cases: the department
   * and role scopes are required by layer, and a file must fit the bucket.
   */
  const handleUpload = async () => {
    if (!uploadForm.title.trim()) {
      toast.error("Title is required");

      return;
    }
    if (uploadForm.category === "department" && !uploadForm.departmentId) {
      toast.error("Choose which department this is for");

      return;
    }
    if (uploadForm.category === "role" && !uploadForm.requiredRole) {
      toast.error("Choose which member status may open this");

      return;
    }
    if (!uploadFile && !uploadForm.url.trim()) {
      toast.error("Add a link or attach a file");

      return;
    }
    if (uploadFile && !ALLOWED_FILE_TYPES.has(uploadFile.type)) {
      toast.error("Use a PDF, TXT, CSV, or ZIP file");

      return;
    }
    if (uploadFile && uploadFile.size > MAX_FILE_BYTES) {
      toast.error("Files must be 50MB or smaller");

      return;
    }

    setUploading(true);
    try {
      // Direct browser → Storage bypasses Vercel 4.5 MB proxy limit for 50 MB
      // resources. Falls back to FormData proxy for small files if bucket perms
      // haven't been reconciled.
      let directFileId: string | null = null;
      if (uploadFile) {
        try {
          const uploaded = await storage.createFile({
            bucketId: "resources",
            fileId: ID.unique(),
            file: uploadFile,
          });
          directFileId = uploaded.$id;
        } catch (directError) {
          logError("Direct resource upload failed, falling back to proxy:", directError);
          if (uploadFile.size > 4.5 * 1024 * 1024) {
            toast.error("Direct upload failed — bucket permissions need reconciling. Run `node scripts/setup-appwrite.js` and redeploy.");
            setUploading(false);
            return;
          }
        }
      }

      const response = directFileId
        ? await fetch("/api/resources", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              title: uploadForm.title.trim(),
              description: uploadForm.description.trim(),
              category: uploadForm.category,
              type: uploadForm.type,
              tags: uploadForm.tags,
              url: uploadForm.url.trim() || undefined,
              departmentId: uploadForm.category === "department" ? uploadForm.departmentId : undefined,
              requiredRole: uploadForm.category === "role" ? uploadForm.requiredRole : undefined,
              fileId: directFileId,
            }),
          })
        : await fetch("/api/resources", {
            method: "POST",
            credentials: "include",
            body: (() => {
              const body = new FormData();
              body.set("title", uploadForm.title.trim());
              body.set("description", uploadForm.description.trim());
              body.set("category", uploadForm.category);
              body.set("type", uploadForm.type);
              body.set("tags", uploadForm.tags);
              if (uploadForm.url.trim()) body.set("url", uploadForm.url.trim());
              if (uploadForm.category === "department") body.set("departmentId", uploadForm.departmentId);
              if (uploadForm.category === "role") body.set("requiredRole", uploadForm.requiredRole);
              if (uploadFile) body.set("file", uploadFile);
              return body;
            })(),
          });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        resource?: { status?: string };
      } | null;

      if (!response.ok)
        throw new Error(readApiError(payload, "Unable to upload resource"));
      toast.success(
        payload?.resource?.status === "approved"
          ? "Resource published to the library."
          : "Resource submitted — a resources manager reviews it before it appears.",
      );
      closeUpload();
      setUploadForm(emptyUploadForm);
      setUploadFile(null);
      // Show the submitter their own item straight away, with its real status.
      setMine({ status: "loading", resources: [] });
      setView("mine");
      setReloadKey((key) => key + 1);
    } catch (error) {
      logError("Resource upload error:", error);
      toast.error(getErrorMessage(error) || "Unable to upload resource");
    } finally {
      setUploading(false);
    }
  };

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

  // Pending or sent back — what the uploader still has to act on.
  const mineNeedsAttention = mine.resources.filter(
    (resource) =>
      resource.status === "pending" || resource.status === "rejected",
  ).length;

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

      {canUpload && (
        <div
          aria-label="Choose a view"
          className="mb-6 flex flex-wrap items-center gap-2"
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
            onPress={() => setView("mine")}
          >
            My uploads
            {mineNeedsAttention > 0 && (
              <Chip
                className="ml-2 tabular-nums"
                color="warning"
                size="sm"
                variant="soft"
              >
                {mineNeedsAttention}
              </Chip>
            )}
          </Button>
          {canUpload && (
            <Button
              className="sm:ml-auto"
              variant="secondary"
              onPress={openUpload}
            >
              <Upload aria-hidden="true" className="w-4 h-4" />
              Upload a resource
            </Button>
          )}
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

      {/* Submit a resource */}
      <Modal>
        <ModalBackdrop
          isOpen={isUploadOpen}
          onOpenChange={(next) => {
            if (!next) closeUpload();
          }}
        >
          <ModalContainer>
            <ModalDialog>
              <ModalHeader>Upload a resource</ModalHeader>
              <ModalBody>
                <div className="space-y-4">
                  <p className="text-sm text-default-500">
                    Shared with your membership scope once a resources manager
                    approves it. Nothing you submit is public.
                  </p>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="resource-title"
                    >
                      Title{" "}
                      <span aria-hidden="true" className="text-danger">
                        *
                      </span>
                    </label>
                    <Input
                      id="resource-title"
                      placeholder="What is it?"
                      value={uploadForm.title}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="resource-description"
                    >
                      Description{" "}
                      <span className="font-normal text-default-400">
                        (optional)
                      </span>
                    </label>
                    <TextArea
                      id="resource-description"
                      placeholder="What is inside, and who is it for?"
                      rows={3}
                      value={uploadForm.description}
                      onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      fullWidth
                      value={uploadForm.category}
                      onChange={(value) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          category: String(value ?? "common") as
                            "common" | "department" | "role",
                        }))
                      }
                    >
                      <Label>Who can open it</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {UPLOAD_LAYERS.map((option) => (
                            <ListBox.Item
                              key={option.value}
                              id={option.value}
                              textValue={option.label}
                            >
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                    <Select
                      fullWidth
                      value={uploadForm.type}
                      onChange={(value) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          type: String(value ?? "document") as Resource["type"],
                        }))
                      }
                    >
                      <Label>Kind</Label>
                      <Select.Trigger>
                        <Select.Value />
                        <Select.Indicator />
                      </Select.Trigger>
                      <Select.Popover>
                        <ListBox>
                          {UPLOAD_TYPES.map((option) => (
                            <ListBox.Item
                              key={option.value}
                              id={option.value}
                              textValue={option.label}
                            >
                              {option.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  </div>

                  {/* A department resource has to name its department, and a
                      role resource its status — the server rejects both
                      otherwise, so ask in the same step. */}
                  {uploadForm.category === "department" && (
                    <Select
                      fullWidth
                      value={uploadForm.departmentId || null}
                      onChange={(value) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          departmentId: String(value ?? ""),
                        }))
                      }
                    >
                      <Label>
                        Department{" "}
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
                          {Object.entries(departmentNames).map(([id, name]) => (
                            <ListBox.Item key={id} id={id} textValue={name}>
                              {name}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}
                  {uploadForm.category === "role" && (
                    <Select
                      fullWidth
                      value={uploadForm.requiredRole}
                      onChange={(value) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          requiredRole: String(value ?? "member"),
                        }))
                      }
                    >
                      <Label>
                        Minimum member status{" "}
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
                          {UPLOAD_ROLES.map((role) => (
                            <ListBox.Item
                              key={role.value}
                              id={role.value}
                              textValue={role.label}
                            >
                              {role.label}
                              <ListBox.ItemIndicator />
                            </ListBox.Item>
                          ))}
                        </ListBox>
                      </Select.Popover>
                    </Select>
                  )}

                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="resource-url"
                    >
                      Link{" "}
                      <span className="font-normal text-default-400">
                        (or attach a file below)
                      </span>
                    </label>
                    <Input
                      id="resource-url"
                      placeholder="https://…"
                      value={uploadForm.url}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          url: e.target.value,
                        }))
                      }
                    />
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="resource-file"
                    >
                      File{" "}
                      <span className="font-normal text-default-400">
                        (PDF, TXT, CSV, or ZIP under 50MB)
                      </span>
                    </label>
                    <input
                      accept=".pdf,.txt,.csv,.zip"
                      className="w-full text-sm text-default-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                      id="resource-file"
                      type="file"
                      onChange={(e) => {
                        setUploadFile(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    {uploadFile && (
                      <p className="mt-2 text-xs text-default-500">
                        Attached: {uploadFile.name}
                      </p>
                    )}
                  </div>
                  <div>
                    <label
                      className="mb-1 block text-sm font-medium"
                      htmlFor="resource-tags"
                    >
                      Tags{" "}
                      <span className="font-normal text-default-400">
                        (optional, comma separated)
                      </span>
                    </label>
                    <Input
                      id="resource-tags"
                      placeholder="security, workshop, slides"
                      value={uploadForm.tags}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                        setUploadForm((prev) => ({
                          ...prev,
                          tags: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
              </ModalBody>
              <ModalFooter>
                <Button
                  variant="secondary"
                  onPress={() => {
                    closeUpload();
                    setUploadFile(null);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  isPending={uploading}
                  variant="primary"
                  onPress={handleUpload}
                >
                  Submit for review
                </Button>
              </ModalFooter>
            </ModalDialog>
          </ModalContainer>
        </ModalBackdrop>
      </Modal>
    </div>
  );
}
