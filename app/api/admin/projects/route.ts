import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

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

function validateProject(body: Record<string, unknown>) {
  if (typeof body.title !== "string" || !body.title.trim() || body.title.length > 255) return "Invalid title";
  if (typeof body.description !== "string" || !body.description.trim() || body.description.length > 65535) return "Invalid description";
  if (!validUrl(body.image, true) || !validUrl(body.demoUrl) || !validUrl(body.repoUrl)) return "Invalid image or project URL";
  if (!Number.isInteger(body.progress) || Number(body.progress) < 0 || Number(body.progress) > 100) return "Progress must be between 0 and 100";
  if (!Number.isInteger(body.stars) || Number(body.stars) < 0 || !Number.isInteger(body.forks) || Number(body.forks) < 0) return "Invalid project metrics";
  return null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "projects.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.PROJECTS, [Query.orderDesc("$createdAt"), Query.limit(100)]);
    return ok({ projects: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin project list error:", error);
    return fail("INTERNAL", "Unable to load projects", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "projects.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const validationError = validateProject(body);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const project = await databases.createDocument(DATABASE_ID, COLLECTIONS.PROJECTS, ID.unique(), {
      ...body,
      createdAt: new Date().toISOString(),
    });
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
    console.error("Admin project create error:", error);
    return fail("INTERNAL", "Unable to create project", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "projects.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const projectId = typeof body.projectId === "string" ? body.projectId.trim() : "";
    if (!projectId) return fail("VALIDATION", "projectId is required", 400);
    const { projectId: _projectId, ...data } = body;
    const validationError = validateProject(data);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const project = await databases.updateDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId, data);
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
    console.error("Admin project update error:", error);
    return fail("INTERNAL", "Unable to update project", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "projects.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const projectId = new URL(request.url).searchParams.get("projectId")?.trim();
    if (!projectId) return fail("VALIDATION", "projectId is required", 400);
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.PROJECTS, projectId);
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
    console.error("Admin project delete error:", error);
    return fail("INTERNAL", "Unable to delete project", 500);
  }
}
