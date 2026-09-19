import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireMember } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { consumeRateLimit } from "@/lib/rate-limit";
import { isHttpUrl } from "@/lib/validation";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const TIERS = new Set(["platinum", "gold", "silver", "bronze", "partner"]);

/**
 * Rows written before the intake flow carry no status and are approved legacy
 * partners; anything pending or rejected stays off the public wall.
 */
function isApproved(sponsor: { status?: unknown }) {
  const status = String(sponsor.status ?? "");

  return !status || status === "approved";
}

/** Public sponsor catalogue; management belongs to /api/admin/sponsors. */
export async function GET(_request: NextRequest) {
  try {
    const { databases } = createServerDatabases();
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.SPONSORS,
      [
        Query.equal("isActive", [true]),
        Query.orderAsc("displayOrder"),
        Query.limit(100),
      ],
    );

    // `endDate` is the other half of "is this sponsor current": a deal that
    // lapsed months ago stayed on the wall until someone manually flipped
    // isActive. Filtered in code so a row with an unparseable date keeps
    // showing rather than vanishing on a typo.
    const now = Date.now();
    const sponsors = (
      response.documents as Array<{ endDate?: string; status?: unknown }>
    )
      .filter(isApproved)
      .filter((sponsor) => {
        if (!sponsor.endDate) return true;
        const endsAt = new Date(sponsor.endDate).getTime();

        return Number.isNaN(endsAt) || endsAt >= now;
      });

    return ok({ sponsors });
  } catch (error) {
    logError("Public sponsor lookup error:", error);

    return fail("INTERNAL", "Unable to load sponsors", 500);
  }
}

/**
 * Member intake (gallery/resources/projects model): any member may propose a
 * sponsor, which queues as `pending` and stays invisible until a sponsors
 * manager approves it. A submission from a sponsors manager is the
 * moderator's own decision and publishes immediately. The client cannot ask
 * for a status — it is derived from verified authority, not the request body.
 */
export async function POST(request: NextRequest) {
  const authenticated = await requireMember(request);

  if (!authenticated.user) return authenticated.response;
  const limited = consumeRateLimit(
    `sponsor-propose:${authenticated.user.$id}`,
    5,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail(
      "RATE_LIMITED",
      "Too many submissions. Please try again later.",
      429,
      undefined,
      { "Retry-After": String(limited.retryAfter) },
    );
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
  const text = (value: unknown, max: number) =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const name = text(record.name, 255);
  const logo = text(record.logo, 500);
  const website = text(record.website, 500);
  const tier = text(record.tier, 50) || "partner";
  const category = text(record.category, 100);
  const description = text(record.description, 5000);

  if (!name) return fail("VALIDATION", "Sponsor name is required", 400);
  if (!isHttpUrl(logo) || !isHttpUrl(website)) {
    return fail(
      "VALIDATION",
      "Logo and website must be valid http(s) URLs",
      400,
    );
  }
  if (!TIERS.has(tier)) return fail("VALIDATION", "Invalid sponsor tier", 400);

  try {
    const { databases } = createServerDatabases();
    const now = new Date().toISOString();
    // Either half of the moderation authority publishes on submission: a full
    // manager, or a reviewer scoped to sponsors.approve.
    const canModerate =
      (await hasServerCapability(authenticated.user.$id, "sponsors.manage")) ||
      (await hasServerCapability(authenticated.user.$id, "sponsors.approve"));
    const sponsor = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.SPONSORS,
      ID.unique(),
      {
        name,
        logo,
        website,
        tier,
        // Optional columns are omitted rather than sent as null, so a blank
        // field does not fail the write on schemas that reject explicit null.
        ...(description ? { description } : {}),
        ...(category ? { category } : {}),
        isActive: true,
        // A proposal is not orderable yet; approving managers set placement.
        displayOrder: 0,
        featured: false,
        startDate: now.slice(0, 10),
        status: canModerate ? "approved" : "pending",
        submittedBy: authenticated.user.$id,
        submittedByName:
          authenticated.user.name?.trim() ||
          authenticated.user.email ||
          authenticated.user.$id,
        ...(canModerate
          ? { reviewedBy: authenticated.user.$id, reviewedAt: now }
          : {}),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "sponsor.propose",
      entityType: "sponsor",
      entityId: sponsor.$id,
      details: {
        name,
        tier,
        status: canModerate ? "approved" : "pending",
      },
    });

    return ok({ sponsor }, 201);
  } catch (error) {
    logError("Sponsor proposal error:", error);

    return fail("INTERNAL", "Unable to submit sponsor", 500);
  }
}
