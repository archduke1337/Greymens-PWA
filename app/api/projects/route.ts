import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser, requireMember } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isHttpUrl } from "@/lib/validation";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const MAX_LIMIT = 100;
const VALID_CATEGORIES = new Set([
  "ai-ml",
  "blockchain",
  "mobile",
  "web",
  "iot",
  "quantum",
  "cybersecurity",
]);

/** Public project catalogue; privileged Appwrite access remains server-side. */
export async function GET(request: NextRequest) {
  const category = request.nextUrl.searchParams.get("category")?.trim();
  const limitValue = Number(request.nextUrl.searchParams.get("limit"));
  const limit =
    Number.isFinite(limitValue) && limitValue > 0
      ? Math.min(MAX_LIMIT, Math.floor(limitValue))
      : MAX_LIMIT;

  if (category && category !== "all" && !VALID_CATEGORIES.has(category)) {
    return fail("VALIDATION", "Invalid project category", 400);
  }

  try {
    const { databases } = createServerDatabases();
    const queries = [
      ...(category && category !== "all"
        ? [Query.equal("category", [category])]
        : []),
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ];
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      queries,
    );

    // Review gate: rows under review or rejected stay invisible, except to
    // their own proposer (scope=mine). Rows predating moderation carry no
    // reviewStatus and read as approved legacy content.
    const scope = request.nextUrl.searchParams.get("scope")?.trim();
    let viewerId: string | null = null;

    if (scope === "mine") {
      const authenticated = await requireAuthenticatedUser(request);

      if (!authenticated.user) return authenticated.response;
      viewerId = authenticated.user.$id;
    }
    const visible = response.documents.filter((project) => {
      const review = String(project.reviewStatus ?? "");

      if (!review || review === "approved") return true;

      // Pending AND sent-back rows are private to their proposer. Rejected
      // used to be dropped outright, so the owner learned about a rejection
      // only from the notification email — and never saw the reviewer note
      // again if that mail was missed. scope=mine is the owner's view.
      return viewerId !== null && String(project.ownerId ?? "") === viewerId;
    });

    // ok() spreads the payload top-level too, so this keeps the exact
    // { success, data, projects, total } shape clients already read.
    // Owner-scoped responses are per-user: never let shared caches serve
    // one member's pending proposals to another.
    return ok({ projects: visible, total: visible.length }, 200, {
      "Cache-Control":
        viewerId !== null
          ? "private, no-store"
          : "public, s-maxage=60, stale-while-revalidate=300",
    });
  } catch (error) {
    logError("Public project lookup error:", error);

    return fail("INTERNAL", "Unable to load projects", 500);
  }
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function stringList(
  value: unknown,
  maxItems: number,
  maxLength: number,
): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((entry): entry is string => typeof entry === "string")
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter(Boolean)
    .slice(0, maxItems);
}

/**
 * Member proposal path (blog/resource/gallery model): any member may propose,
 * which files the project as `review` — but a submission from a projects
 * manager is the moderator's own decision and publishes immediately. The
 * client cannot ask for a reviewStatus; it is derived from verified
 * authority, not the request body.
 */
export async function POST(request: NextRequest) {
  const authenticated = await requireMember(request);

  if (!authenticated.user) return authenticated.response;
  const limited = consumeRateLimit(
    `project-propose:${authenticated.user.$id}`,
    10,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const record = body as Record<string, unknown>;
  const title = text(record.title, 255);
  const description = text(record.description, 65535);
  const image = text(record.image, 500);
  const category = text(record.category, 100) || "web";
  const duration = text(record.duration, 100);
  const demoUrl = text(record.demoUrl, 500);
  const repoUrl = text(record.repoUrl, 500);

  if (!title || !description || !image || !duration) {
    return fail(
      "VALIDATION",
      "Title, description, image, and duration are required",
      400,
    );
  }
  if (!isHttpUrl(image)) {
    return fail("VALIDATION", "Image must be a valid http(s) URL", 400);
  }
  if (!VALID_CATEGORIES.has(category)) {
    return fail("VALIDATION", "Invalid project category", 400);
  }
  if ((demoUrl && !isHttpUrl(demoUrl)) || (repoUrl && !isHttpUrl(repoUrl))) {
    return fail(
      "VALIDATION",
      "Demo and repository URLs must be valid http(s) addresses or empty",
      400,
    );
  }
  const technologies = stringList(record.technologies, 30, 100);
  const teamMembers = stringList(record.teamMembers, 30, 255);

  try {
    const { databases } = createServerDatabases();
    const now = new Date().toISOString();
    const canModerate = await hasServerCapability(
      authenticated.user.$id,
      "projects.manage",
    );
    const project = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      ID.unique(),
      {
        title,
        description,
        image,
        category,
        status: "planning",
        progress: 0,
        technologies,
        stars: 0,
        forks: 0,
        contributors: 0,
        duration,
        isFeatured: false,
        demoUrl,
        repoUrl,
        teamMembers,
        createdAt: now,
        ownerId: authenticated.user.$id,
        reviewStatus: canModerate ? "approved" : "review",
        ...(canModerate
          ? { approvedBy: authenticated.user.$id, approvedAt: now }
          : {}),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "project.propose",
      entityType: "project",
      entityId: project.$id,
      details: {
        title,
        reviewStatus: canModerate ? "approved" : "review",
      },
    });

    return ok({ project }, 201);
  } catch (error) {
    logError("Project proposal error:", error);

    return fail("INTERNAL", "Unable to submit project", 500);
  }
}

/**
 * Owner revision path: the proposer may refine their own pending proposal.
 * Editing a decided row resubmits it to review (blog parity) — otherwise
 * "edit" would silently rewrite approved content. Managers edit through the
 * console, which keeps whatever it sets.
 */
export async function PATCH(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail("VALIDATION", "Invalid request body", 400);
  }
  const record = body as Record<string, unknown>;
  const projectId =
    typeof record.projectId === "string" ? record.projectId.trim() : "";

  if (!projectId) return fail("VALIDATION", "projectId is required", 400);

  try {
    const { databases } = createServerDatabases();
    const current = await databases.getDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      projectId,
    );

    if (String(current.ownerId ?? "") !== authenticated.user.$id) {
      return fail("FORBIDDEN", "You do not own this project proposal", 403);
    }
    if (String(current.reviewStatus ?? "") === "approved") {
      return fail(
        "VALIDATION",
        "Approved projects are edited from the console",
        400,
      );
    }
    const updates: Record<string, unknown> = {};

    for (const [key, max] of [
      ["title", 255],
      ["description", 65535],
      ["image", 500],
      ["duration", 100],
      ["demoUrl", 500],
      ["repoUrl", 500],
    ] as const) {
      if (record[key] === undefined) continue;
      updates[key] = text(record[key], max);
    }
    if (record.category !== undefined) {
      const category = text(record.category, 100);

      if (!VALID_CATEGORIES.has(category)) {
        return fail("VALIDATION", "Invalid project category", 400);
      }
      updates.category = category;
    }
    if (record.technologies !== undefined) {
      updates.technologies = stringList(record.technologies, 30, 100);
    }
    if (record.teamMembers !== undefined) {
      updates.teamMembers = stringList(record.teamMembers, 30, 255);
    }
    if (
      !updates.title ||
      !updates.description ||
      !updates.image ||
      !updates.duration
    ) {
      const merged = { ...current, ...updates };

      if (
        !String(merged.title ?? "").trim() ||
        !String(merged.description ?? "").trim() ||
        !String(merged.image ?? "").trim() ||
        !String(merged.duration ?? "").trim()
      ) {
        return fail(
          "VALIDATION",
          "Title, description, image, and duration are required",
          400,
        );
      }
    }
    if (updates.image && !isHttpUrl(String(updates.image))) {
      return fail("VALIDATION", "Image must be a valid http(s) URL", 400);
    }
    for (const key of ["demoUrl", "repoUrl"] as const) {
      if (updates[key] && !isHttpUrl(String(updates[key]))) {
        return fail(
          "VALIDATION",
          "Demo and repository URLs must be valid http(s) addresses or empty",
          400,
        );
      }
    }
    // A rejected proposal fixed up by its owner goes back into the queue.
    updates.reviewStatus = "review";
    updates.rejectionReason = null;

    const project = await databases.updateDocument(
      DATABASE_ID,
      COLLECTIONS.PROJECTS,
      projectId,
      updates,
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "project.proposal_update",
      entityType: "project",
      entityId: projectId,
      details: { fields: Object.keys(updates) },
    });

    return ok({ project });
  } catch (error) {
    logError("Project proposal update error:", error);

    return fail("INTERNAL", "Unable to update project", 500);
  }
}
