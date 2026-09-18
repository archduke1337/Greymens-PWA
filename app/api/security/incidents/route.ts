import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { RESTRICTED_STATUSES, getMembershipStatus, requireAuthenticatedUser } from "@/lib/server-auth";
import { requireAnyCapability, requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail, ApiError } from "@/lib/api";

const SEVERITIES = new Set(["low", "moderate", "major", "critical"]);
const STATUSES = new Set(["reported", "contained", "investigating", "resolved", "referred"]);

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "security.manage_incidents");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.INCIDENT_REPORTS, [Query.orderDesc("createdAt"), Query.limit(100)]);
    return ok({ incidents: response.documents, total: response.total });
  } catch (error) {
    console.error("Incident list error:", error);
    return fail("INTERNAL", "Unable to load incident reports", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);
  if (!authenticated.user) return authenticated.response;
  const limited = consumeRateLimit(`security-incident:${authenticated.user.$id}`, 10, 60 * 60 * 1000);
  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  // Same bar as activity requests: restricted accounts cannot file.
  const reporterStatus = await getMembershipStatus(authenticated.user);
  if (RESTRICTED_STATUSES.has(reporterStatus)) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }
  try {
    const body = await request.json() as Record<string, unknown>;
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const affectedResource = typeof body.affectedResource === "string" ? body.affectedResource.trim() : "";
    const severity = typeof body.severity === "string" ? body.severity.trim() : "";
    if (!title || title.length > 255 || !description || description.length > 65535 || !affectedResource || affectedResource.length > 500 || !SEVERITIES.has(severity)) {
      return fail("VALIDATION", "Title, description, affected resource, and valid severity are required", 400);
    }
    const now = new Date().toISOString();
    const { databases } = createServerDatabases();
    const incident = await databases.createDocument(DATABASE_ID, COLLECTIONS.INCIDENT_REPORTS, ID.unique(), {
      reportedBy: authenticated.user.$id,
      title,
      description,
      severity,
      affectedResource,
      status: "reported",
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "incident.report",
      entityType: "incident",
      entityId: incident.$id,
      details: { severity },
    });
    return ok({ incident }, 201);
  } catch (error) {
    console.error("Incident report error:", error);
    return fail("INTERNAL", "Unable to submit incident report", 500);
  }
}

export async function PATCH(request: NextRequest) {
  // Containing an incident and running the incident queue are separate grants.
  // infrastructure_systems_lead is chartered for the first and not the second,
  // so the route opens on either and narrows below: a contain-only holder may
  // move an incident to `contained` and nothing else. Both capabilities were
  // previously granted and neither was read — the whole endpoint answered to
  // security.manage_incidents.
  const authenticated = await requireAnyCapability(request, [
    "security.manage_incidents",
    "security.contain",
  ]);
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as { incidentId?: unknown; status?: unknown; resolution?: unknown; assignedTo?: unknown };
    const incidentId = typeof body.incidentId === "string" ? body.incidentId.trim() : "";
    const status = typeof body.status === "string" ? body.status.trim() : "";
    if (!incidentId || !STATUSES.has(status)) return fail("VALIDATION", "Invalid incident update", 400);
    if (status !== "contained") {
      const managesIncidents = await requireAnyCapability(request, ["security.manage_incidents"]);
      if (!managesIncidents.user) return managesIncidents.response;
    }
    const data: Record<string, unknown> = { status, updatedAt: new Date().toISOString() };
    if (typeof body.resolution === "string") data.resolution = body.resolution.trim().slice(0, 65535);
    if (typeof body.assignedTo === "string") data.assignedTo = body.assignedTo.trim().slice(0, 36);
    const { databases } = createServerDatabases();
    const incident = await databases.updateDocument(DATABASE_ID, COLLECTIONS.INCIDENT_REPORTS, incidentId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "incident.decide",
      entityType: "incident",
      entityId: incidentId,
      details: { status },
    });
    return ok({ incident });
  } catch (error) {
    console.error("Incident update error:", error);
    return fail("INTERNAL", "Unable to update incident report", 500);
  }
}
