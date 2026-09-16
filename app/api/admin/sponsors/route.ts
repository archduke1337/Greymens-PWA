import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { ok, fail, ApiError } from "@/lib/api";

const TIERS = new Set(["platinum", "gold", "silver", "bronze", "partner"]);

function isUrl(value: unknown, required = false) {
  if (typeof value !== "string" || (required && !value.trim())) return false;
  if (!value) return true;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(body: Record<string, unknown>) {
  if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 255) return "Invalid name";
  if (!isUrl(body.logo, true) || !isUrl(body.website, true)) return "Invalid logo or website URL";
  if (typeof body.tier !== "string" || !TIERS.has(body.tier)) return "Invalid sponsor tier";
  if (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0) return "Invalid display order";
  return null;
}

export async function GET(request: NextRequest) {
  const authenticated = await requireCapability(request, "sponsors.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const { databases } = createAdminClient();
    const response = await databases.listDocuments(DATABASE_ID, COLLECTIONS.SPONSORS, [Query.orderAsc("displayOrder"), Query.limit(100)]);
    return ok({ sponsors: response.documents, total: response.total });
  } catch (error) {
    console.error("Admin sponsor list error:", error);
    return fail("INTERNAL", "Unable to load sponsors", 500);
  }
}

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "sponsors.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const validationError = validate(body);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const sponsor = await databases.createDocument(DATABASE_ID, COLLECTIONS.SPONSORS, ID.unique(), body);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "sponsor.create",
      entityType: "sponsor",
      entityId: sponsor.$id,
      details: {},
    });
    return ok({ sponsor }, 201);
  } catch (error) {
    console.error("Admin sponsor create error:", error);
    return fail("INTERNAL", "Unable to create sponsor", 500);
  }
}

export async function PATCH(request: NextRequest) {
  const authenticated = await requireCapability(request, "sponsors.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const body = await request.json() as Record<string, unknown>;
    const sponsorId = typeof body.sponsorId === "string" ? body.sponsorId.trim() : "";
    if (!sponsorId) return fail("VALIDATION", "sponsorId is required", 400);
    const { sponsorId: _sponsorId, ...data } = body;
    const validationError = validate(data);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const sponsor = await databases.updateDocument(DATABASE_ID, COLLECTIONS.SPONSORS, sponsorId, data);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "sponsor.update",
      entityType: "sponsor",
      entityId: sponsorId,
      details: { fields: Object.keys(data) },
    });
    return ok({ sponsor });
  } catch (error) {
    console.error("Admin sponsor update error:", error);
    return fail("INTERNAL", "Unable to update sponsor", 500);
  }
}

export async function DELETE(request: NextRequest) {
  const authenticated = await requireCapability(request, "sponsors.manage");
  if (!authenticated.user) return authenticated.response;
  try {
    const sponsorId = new URL(request.url).searchParams.get("sponsorId")?.trim();
    if (!sponsorId) return fail("VALIDATION", "sponsorId is required", 400);
    const { databases } = createAdminClient();
    await databases.deleteDocument(DATABASE_ID, COLLECTIONS.SPONSORS, sponsorId);
    await recordAudit({
      request,
      actor: authenticated.user,
      action: "sponsor.delete",
      entityType: "sponsor",
      entityId: sponsorId,
      details: {},
    });
    return ok({ success: true });
  } catch (error) {
    console.error("Admin sponsor delete error:", error);
    return fail("INTERNAL", "Unable to delete sponsor", 500);
  }
}
