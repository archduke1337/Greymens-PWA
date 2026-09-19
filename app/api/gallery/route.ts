import { NextRequest } from "next/server";
import { ID, Query } from "appwrite";

import {
  createServerDatabases,
  createServerStorage,
} from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { requireMember } from "@/lib/server-auth";
import { hasServerCapability } from "@/lib/access-control";
import { recordAudit } from "@/lib/server-audit";
import { PUBLIC_FILE_PERMISSIONS, getStorageFileViewUrl } from "@/lib/storage";
import { consumeRateLimit, getClientAddress } from "@/lib/rate-limit";
import { isHttpUrl } from "@/lib/validation";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "gallery-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// One upload groups at most this many images under a shared title/album.
const MAX_FILES = 10;
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
      // Membership, not mere authentication: the upload gate is requireMember,
      // so anyone who can see their own uploads here is someone who could have
      // made them. Anything wider leaks "my uploads" framing to non-members.
      const authenticated = await requireMember(request);

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
    // No status predicate: rows written before moderation existed carry no
    // status, and a predicate would hide that legacy content. Filter in code
    // so missing status reads as approved.
    const queries = [
      Query.equal("isActive", [true]),
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

    return ok({
      images: response.documents.filter(
        (image) => image.status === "approved" || !image.status,
      ),
    });
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

    // One upload, one album: every file selected together shares the title,
    // description, category, tags — and an albumId the gallery groups by.
    // A lone image URL (no files) is a single-image album.
    const files = form
      .getAll("file")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0)
      .slice(0, MAX_FILES);

    if (form.getAll("file").some((entry) => entry instanceof File)) {
      const nonEmpty = form
        .getAll("file")
        .filter(
          (entry): entry is File => entry instanceof File && entry.size > 0,
        );

      if (nonEmpty.length > MAX_FILES) {
        return fail(
          "VALIDATION",
          `Upload at most ${MAX_FILES} images at once`,
          400,
        );
      }
      const rejected = form
        .getAll("file")
        .filter(
          (entry): entry is File =>
            entry instanceof File &&
            entry.size > 0 &&
            (!ALLOWED_TYPES.has(entry.type) || entry.size > MAX_FILE_SIZE),
        );

      if (rejected.length > 0) {
        return fail(
          "VALIDATION",
          `${rejected.length} file(s) rejected. Use JPG, PNG, GIF, or WebP under 10MB each (max ${MAX_FILES} per upload).`,
          400,
        );
      }
    }

    const imageUrls: string[] = [];

    for (const file of files) {
      const stored = await storage.createFile(
        BUCKET_ID,
        ID.unique(),
        file,
        PUBLIC_FILE_PERMISSIONS,
      );

      imageUrls.push(getStorageFileViewUrl(BUCKET_ID, stored.$id));
    }

    if (imageUrls.length === 0) {
      const providedUrl = text(form.get("imageUrl"), 500);

      if (!providedUrl) {
        return fail("VALIDATION", "Provide image files or an image URL", 400);
      }
      if (!isHttpUrl(providedUrl)) {
        return fail(
          "VALIDATION",
          "Image URL must be a valid http(s) address",
          400,
        );
      }
      imageUrls.push(providedUrl);
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
    const albumId = ID.unique();
    const images = [];

    for (const imageUrl of imageUrls) {
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
          albumId,
          status: canModerate ? "approved" : "pending",
          isActive: true,
          ...(canModerate
            ? { approvedBy: authenticated.user.$id, approvedAt: now }
            : {}),
        },
      );

      images.push(image);
    }

    await recordAudit({
      request,
      actor: authenticated.user,
      action: "gallery.upload",
      entityType: "gallery_image",
      entityId: albumId,
      details: {
        title,
        count: images.length,
        status: canModerate ? "approved" : "pending",
      },
    });

    return ok({ images, image: images[0] }, 201);
  } catch (error) {
    logError("Gallery upload error:", error);

    return fail("INTERNAL", "Unable to upload image", 500);
  }
}
