import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import {
  createServerDatabases,
  createServerStorage,
} from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireAuthenticatedUser, requireMember } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { PUBLIC_FILE_PERMISSIONS } from "@/lib/storage";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { isHttpUrl } from "@/lib/validation";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "gallery-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);
// Mirrors the gallery filter catalogue: anything else pollutes the taxonomy
// and breaks category filtering.
const ALLOWED_CATEGORIES = new Set([
  "events",
  "workshops",
  "hackathons",
  "team",
  "projects",
  "other",
]);

/**
 * Public approved-gallery read. The browser should never query the gallery
 * table directly: this response excludes pending/rejected records and limits
 * the fields returned to what the public gallery renders.
 */
export async function GET(request: NextRequest) {
  try {
    const scope = request.nextUrl.searchParams.get("scope")?.trim();

    if (scope === "mine") {
      const authenticated = await requireAuthenticatedUser(request);

      if (!authenticated.user) return authenticated.response;
      const { databases } = createServerDatabases();
      const category = request.nextUrl.searchParams.get("category")?.trim();
      const queries = [
        Query.equal("uploadedBy", [authenticated.user.$id]),
        Query.orderDesc("$createdAt"),
        Query.limit(100),
      ];

      if (category && category !== "all")
        queries.splice(1, 0, Query.equal("category", [category]));
      const response = await databases.listDocuments(
        DATABASE_ID,
        COLLECTIONS.GALLERY,
        queries,
      );

      return ok({ images: response.documents });
    }
    const { databases } = createServerDatabases();
    const category = request.nextUrl.searchParams.get("category")?.trim();
    const queries = [
      Query.equal("status", ["approved"]),
      Query.equal("isActive", [true]),
      Query.orderDesc("$createdAt"),
      Query.limit(100),
    ];

    if (category && category !== "all")
      queries.splice(2, 0, Query.equal("category", [category]));
    const response = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.GALLERY,
      queries,
    );

    return ok({ images: response.documents });
  } catch (error) {
    logError("Public gallery lookup error:", error);

    return fail("INTERNAL", "Unable to load gallery", 500);
  }
}

function text(value: FormDataEntryValue | null, max: number) {
  return typeof value === "string" && value.length <= max ? value.trim() : "";
}

/**
 * Upload a gallery image.
 *
 * This is the only supported upload path. The gallery page previously called
 * `storage.createFile` and then `databases.createDocument` directly from the
 * browser, which can never succeed: buckets are provisioned without client write
 * permission and the gallery table grants no client write either. Uploading
 * through the server also lets the image be validated before it is stored.
 *
 * Moderation: an image from a moderator is published immediately, because that
 * is the moderator's own decision. Anything else is queued as `pending` for
 * review, and the client cannot ask for a different status — the decision is
 * derived from verified authority, not from the request body.
 */
export async function POST(request: NextRequest) {
  const authenticated = await requireMember(request);

  if (!authenticated.user) return authenticated.response;

  const limit = consumeRateLimit(
    `gallery-upload:${authenticated.user.$id}:${getClientAddress(request)}`,
    20,
    60 * 60 * 1000,
  );

  if (!limit.allowed) {
    return fail(
      "RATE_LIMITED",
      "Upload limit reached. Please try again later.",
      429,
      undefined,
      { "Retry-After": String(limit.retryAfter) },
    );
  }

  try {
    const form = await request.formData();
    const title = text(form.get("title"), 255);

    if (!title) return fail("VALIDATION", "Title is required", 400);

    const description = text(form.get("description"), 2000);
    const category = text(form.get("category"), 50) || "other";

    if (!ALLOWED_CATEGORIES.has(category)) {
      return fail("VALIDATION", "Invalid gallery category", 400);
    }
    const tags = text(form.get("tags"), 1000)
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);

    const { storage } = createServerStorage();
    const { databases } = createServerDatabases();
    let imageUrl = "";

    const file = form.get("file");

    if (file instanceof File && file.size > 0) {
      if (!ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
        return fail(
          "VALIDATION",
          "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.",
          400,
        );
      }
      const stored = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        file,
        PUBLIC_FILE_PERMISSIONS,
      );

      imageUrl = storage.getFileView(BUCKET_ID, stored.$id).toString();
    } else {
      const providedUrl = text(form.get("imageUrl"), 500);

      if (!providedUrl) {
        return fail("VALIDATION", "Provide an image file or an image URL", 400);
      }
      if (!isHttpUrl(providedUrl)) {
        return fail(
          "VALIDATION",
          "Image URL must be a valid http(s) address",
          400,
        );
      }
      imageUrl = providedUrl;
    }

    // Moderation authority is the capability, the same one /api/admin/gallery
    // requires. It used to be read here as the legacy `gallery_manager` power,
    // so a manager who held gallery.manage still had their own uploads queued
    // as pending — two answers to one question.
    const canModerate = await hasServerCapability(
      authenticated.user.$id,
      "gallery.manage",
    );
    const now = new Date().toISOString();

    const image = await databases.createDocument(
      DATABASE_ID,
      COLLECTIONS.GALLERY,
      ID.unique(),
      {
        title,
        description,
        imageUrl,
        category,
        tags,
        uploadedBy: authenticated.user.$id,
        status: canModerate ? "approved" : "pending",
        isActive: true,
        ...(canModerate
          ? { approvedBy: authenticated.user.$id, approvedAt: now }
          : {}),
      },
    );

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "gallery.upload",
      entityType: "gallery_image",
      entityId: image.$id,
      details: { title, status: canModerate ? "approved" : "pending" },
    });

    return ok({ image }, 201);
  } catch (error) {
    logError("Gallery upload error:", error);

    return fail("INTERNAL", "Unable to upload image", 500);
  }
}
