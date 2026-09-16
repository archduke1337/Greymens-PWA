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

const EDITABLE_SPONSOR_FIELDS = [
  "name",
  "logo",
  "website",
  "tier",
  "description",
  "category",
  "isActive",
  "displayOrder",
  "featured",
  "startDate",
  "endDate",
] as const;

function pickSponsorFields(body: Record<string, unknown>) {
  const out: Record<string, unknown> = {};

  for (const key of EDITABLE_SPONSOR_FIELDS) {
    const value = body[key];

    if (value === undefined) continue;
    out[key] = value;
  }
  return out;
}

function validate(body: Record<string, unknown>, forUpdate = false) {
  if (!forUpdate || body.name !== undefined) {
    if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 255) return "Invalid name";
  }
  if (!forUpdate) {
    if (!isUrl(body.logo, true) || !isUrl(body.website, true)) return "Invalid logo or website URL";
  } else {
    if (body.logo !== undefined && !isUrl(body.logo, true)) return "Invalid logo URL";
    if (body.website !== undefined && !isUrl(body.website, true)) return "Invalid website URL";
  }
  if (!forUpdate || body.tier !== undefined) {
    if (typeof body.tier !== "string" || !TIERS.has(body.tier)) return "Invalid sponsor tier";
  }
  if (!forUpdate || body.displayOrder !== undefined) {
    if (!Number.isInteger(body.displayOrder) || Number(body.displayOrder) < 0) return "Invalid display order";
  }
  if (body.description !== undefined && (typeof body.description !== "string" || body.description.length > 65535)) return "Invalid description";
  if (body.category !== undefined && (typeof body.category !== "string" || body.category.length > 100)) return "Invalid category";
  if (body.isActive !== undefined && typeof body.isActive !== "boolean") return "Invalid active flag";
  if (body.featured !== undefined && typeof body.featured !== "boolean") return "Invalid featured flag";
  if (body.startDate !== undefined && (typeof body.startDate !== "string" || !body.startDate.trim() || body.startDate.length > 30)) return "Invalid start date";
  if (body.endDate !== undefined && body.endDate !== "" && (typeof body.endDate !== "string" || body.endDate.length > 30)) return "Invalid end date";
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
    const fields = pickSponsorFields(body);
    const validationError = validate(fields);
    if (validationError) return fail("VALIDATION", validationError, 400);
    const { databases } = createAdminClient();
    const sponsor = await databases.createDocument(DATABASE_ID, COLLECTIONS.SPONSORS, ID.unique(), fields);
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
    const { sponsorId: _sponsorId, ...rest } = body;
    const data = pickSponsorFields(rest);
    const validationError = validate(data, true);
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
