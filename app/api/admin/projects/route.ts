import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAnyCapability, requireCapability } from "@/lib/access-control";
import { dispatchNotification } from "@/lib/notify";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

function validUrl(value: unknown, required = false) {
  if (typeof value !== "string" || (!value && required)) return false;
  if (!value) return true;
  try {
    const url = new URL(value);

    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

const EDITABLE_PROJECT_FIELDS = [
  "title",
  "description",
  "image",
  "category",
  "status",
  "progress",
  "technologies",
  "stars",
  "forks",
  "contributors",
  "duration",
  "isFeatured",
  "demoUrl",
  "repoUrl",
  "teamMembers",
] as const;

function pickProjectFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};

  for (const key of EDITABLE_PROJECT_FIELDS) {
    const value = body[key];

    if (value === undefined) continue;
    out[key] = value;
  }

  return out;
}

// Same allowlist the public reader and member proposal path enforce, so the
// console cannot persist a category the projects page can never filter to.
const VALID_PROJECT_CATEGORIES = new Set([
  "ai-ml",
  "blockchain",
  "mobile",
  "web",
  "iot",
  "quantum",
  "cybersecurity",
]);

/**
 * Create validates every required column; edit validates only what the
 * request actually carries. Requiring the full object on PATCH meant a
 * one-field edit (feature flag, progress bump) 400ed unless the client
 * resent the whole project.
 */
function validateProject(
  body: Record<string, unknown>,
  { partial = false }: { partial?: boolean } = {},
) {
  const present = (key: string) => body[key] !== undefined;
  const mustCheck = (key: string) => !partial || present(key);

  if (
    mustCheck("title") &&
    (typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.length > 255)
  )
    return "Invalid title";
  if (
    mustCheck("description") &&
    (typeof body.description !== "string" ||
      !body.description.trim() ||
      body.description.length > 65535)
  )
    return "Invalid description";
  if (mustCheck("image") && !validUrl(body.image, true))
    return "Invalid image or project URL";
  if (present("demoUrl") && !validUrl(body.demoUrl))
    return "Invalid image or project URL";
  if (present("repoUrl") && !validUrl(body.repoUrl))
    return "Invalid image or project URL";
  if (
    mustCheck("progress") &&
    (!Number.isInteger(body.progress) ||
      Number(body.progress) < 0 ||
      Number(body.progress) > 100)
  )
    return "Progress must be between 0 and 100";
  if (
    (mustCheck("stars") &&
      (!Number.isInteger(body.stars) || Number(body.stars) < 0)) ||
    (mustCheck("forks") &&
      (!Number.isInteger(body.forks) || Number(body.forks) < 0))
  )
    return "Invalid project metrics";
  if (
    (!partial || present("category")) &&
    (typeof body.category !== "string" ||
      !VALID_PROJECT_CATEGORIES.has(body.category))
  )
    return "Invalid project category";

  return null;
}

export async function GET(request: NextRequest) {
  // Reviewers need the queue as much as managers: without the list a
  // projects.approve holder has a tab that can only ever be empty.
  const authenticated = await requireAnyCapability(request, [
    "projects.manage",
    "projects.approve",
  ]);

  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      [Query.orderDesc("$createdAt"), Query.limit(100)],
    );

    return ok({ projects: response.documents, total: response.total });
  } catch (error) {
    logError("Admin project list error:", error);

    return fail("INTERNAL", "Unable to load projects", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "projects.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fields = pickProjectFields(body);
    const validationError = validateProject(fields);

    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createServerDatabases();
    const now = new Date().toISOString();
    // Console-created rows are the manager's own decision, so they publish
    // immediately — and carry attribution. Without ownerId they were
    // ownerless ghosts: no notification path and uneditable by any member.
    const project = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      ID.unique(),
      {
        ...fields,
        createdAt: now,
        ownerId: authenticated.user.$id,
        reviewStatus: "approved",
        approvedBy: authenticated.user.$id,
        approvedAt: now,
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "project.create",
      entityType: "project",
      entityId: project.$id,
      details: {},
    });

    return ok({ project }, 201);
  } catch (error) {
    logError("Admin project create error:", error);

    return fail("INTERNAL", "Unable to create project", 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const projectId =
      typeof body.projectId === "string" ? body.projectId.trim() : "";

    if (!projectId) return fail("VALIDATION", "projectId is required", 400);
    const { projectId: _projectId, ...rest } = body;
    const isDecision = rest.action === "approve" || rest.action === "reject";

    // Two authorities on one endpoint, chosen by the action: deciding a
    // proposal is projects.approve, editing one is projects.manage. The split
    // exists so a reviewer can be scoped to the verdict alone — before it, a
    // reviewer and a full editor were the same grant, and there was no way to
    // hand out the queue without also handing out delete.
    const authenticated = isDecision
      ? await requireAnyCapability(request, [
          "projects.approve",
          "projects.manage",
        ])
      : await requireCapability(request, "projects.manage");

    if (!authenticated.user) return authenticated.response;

    // Review decisions ride the same endpoint as metadata edits: approve or
    // reject a member proposal, tell the proposer (in-app + mail), audit it.
    if (rest.action === "approve" || rest.action === "reject") {
      const action = rest.action as string;
      const reason =
        typeof rest.reason === "string"
          ? rest.reason.trim().slice(0, 2000)
          : "";

      if (action === "reject" && !reason) {
        return fail("VALIDATION", "A rejection reason is required", 400);
      }
      const { databases } = createServerDatabases();
      const now = new Date().toISOString();
      const project = await databases.updateDocument(
        DATABASE_ID,
        COLLECTIONS.PROJECTS,
        projectId,
        action === "approve"
          ? {
              reviewStatus: "approved",
              approvedBy: authenticated.user.$id,
              approvedAt: now,
              rejectionReason: null,
            }
          : {
              reviewStatus: "rejected",
              rejectionReason: reason,
              approvedBy: null,
              approvedAt: null,
            },
      );

      const ownerId = String(project.ownerId ?? "");
      const title = String(project.title ?? "your project");

      if (ownerId) {
        await dispatchNotification({
          userId: ownerId,
          type: "general",
          title:
            action === "approve"
              ? "Project proposal approved"
              : "Project proposal needs changes",
          body:
            action === "approve"
              ? `"${title}" was approved and is now visible on the projects page.`
              : `"${title}" was not approved yet. Reviewer note: ${reason}`,
        }).catch((error) => {
          // The review decision is already saved; only the notification
          // failed. Log it — a silent catch reads as "proposer was told".
          logError("Project decision notification failed:", error);
        });
      }

      await recordAudit({
        request,
        actor: authenticated.user,
        action: `project.${action}`,
        entityType: "project",
        entityId: projectId,
        details: { action },
      });

      return ok({ project });
    }

    const data = pickProjectFields(rest);
    const validationError = validateProject(data, { partial: true });

    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createServerDatabases();
    const project = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      projectId,
      data,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "project.update",
      entityType: "project",
      entityId: projectId,
      details: { fields: Object.keys(data) },
    });

    return ok({ project });
  } catch (error) {
    logError("Admin project update error:", error);

    return fail("INTERNAL", "Unable to update project", 500);
  }
}

export async function DELETE(request: NextRequest) {
  // Deleting stays with the full grant: a reviewer decides proposals, they do
  // not get to remove the portfolio.
  const authenticated = await requireCapability(request, "projects.manage");

  if (!authenticated.user) return authenticated.response;
  try {
    const projectId = new URL(request.url).searchParams
      .get("projectId")
      ?.trim();

    if (!projectId) return fail("VALIDATION", "projectId is required", 400);
    const { databases } = createServerDatabases();

    await databases.deleteDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      projectId,
    );
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "project.delete",
      entityType: "project",
      entityId: projectId,
      details: {},
    });

    return ok({ success: true });
  } catch (error) {
    logError("Admin project delete error:", error);

    return fail("INTERNAL", "Unable to delete project", 500);
  }
}
