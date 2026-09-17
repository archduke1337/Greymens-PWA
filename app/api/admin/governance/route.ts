import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const RECORD_TYPES = new Set(["minute", "resolution", "amendment", "handover", "annual_review", "asset"]);
const VISIBILITIES = new Set(["public", "members", "restricted"]);
const STATUSES = new Set(["draft", "approved", "archived"]);

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "governance.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const type = request.nextUrl.searchParams.get("recordType")?.trim();
    const queries = type && RECORD_TYPES.has(type)
      ? [Query.equal("recordType", [type]), Query.orderDesc("updatedAt"), Query.limit(100)]
      : [Query.orderDesc("updatedAt"), Query.limit(100)];
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.GOVERNANCE_RECORDS, queries);
    return ok({ records: response.documents, total: response.total });
  } catch (error) {
    console.error("Governance record list error:", error);
    return fail("INTERNAL", "Unable to load governance records", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "governance.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const recordType = typeof body.recordType === "string" ? body.recordType.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const recordBody = typeof body.body === "string" ? body.body.trim() : "";
    const visibility = typeof body.visibility === "string" ? body.visibility.trim() : "members";
    const status = typeof body.status === "string" ? body.status.trim() : "draft";
    if (!RECORD_TYPES.has(recordType) || !title || title.length > 255 || !recordBody || recordBody.length > 65535 || !VISIBILITIES.has(visibility) || !STATUSES.has(status)) {
      return fail("VALIDATION", "Invalid governance record", 400);
    }
    const now = new Date().toISOString();
    const { databases } = createServerDatabases();
    const record = await databases.createDocument(DATABASE_ID, COLLECTIONS.GOVERNANCE_RECORDS, ID.unique(), {
      recordType,
      title,
      body: recordBody,
      meetingDate: typeof body.meetingDate === "string" ? body.meetingDate.slice(0, 30) : null,
      visibility,
      status,
      createdBy: authenticated.user.$id,
      createdAt: now,
      updatedAt: now,
    });
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "governance.create",
      entityType: "governance_record",
      entityId: record.$id,
      details: { recordType },
    });
    return ok({ record }, 201);
  } catch (error) {
    console.error("Governance record create error:", error);
    return fail("INTERNAL", "Unable to create governance record", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "governance.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const recordId = typeof body.recordId === "string" ? body.recordId.trim() : "";
    if (!recordId) return fail("VALIDATION", "recordId is required", 400);
    const data: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    for (const field of ["title", "body", "meetingDate", "visibility", "status"]) {
      if (body[field] !== undefined) data[field] = body[field];
    }
    if (typeof data.title === "string" && (!data.title.trim() || data.title.length > 255)) return fail("VALIDATION", "Invalid title", 400);
    if (typeof data.body === "string" && (!data.body.trim() || data.body.length > 65535)) return fail("VALIDATION", "Invalid body", 400);
    if (data.visibility !== undefined && (typeof data.visibility !== "string" || !VISIBILITIES.has(data.visibility))) return fail("VALIDATION", "Invalid visibility", 400);
    if (data.status !== undefined && (typeof data.status !== "string" || !STATUSES.has(data.status))) return fail("VALIDATION", "Invalid status", 400);
    const { databases } = createServerDatabases();
    const record = await databases.updateDocument(DATABASE_ID, COLLECTIONS.GOVERNANCE_RECORDS, recordId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "governance.update",
      entityType: "governance_record",
      entityId: recordId,
      details: { fields: Object.keys(data) },
    });
    return ok({ record });
  } catch (error) {
    console.error("Governance record update error:", error);
    return fail("INTERNAL", "Unable to update governance record", 500);
  }
}
