import { NextRequest } from "next/server";
import { ID } from "appwrite";

import { createServerStorage } from "@/lib/appwrite-server";
import { requireCapability } from "@/lib/access-control";
import { PUBLIC_FILE_PERMISSIONS, getStorageFileViewUrl, isOwnedBy } from "@/lib/storage";
import { consumeRateLimit } from "@/lib/rate-limit";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

const BUCKET_ID = "blog-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
]);

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "blog.create");

  if (!authenticated.user) return authenticated.response;
  // Uploads spend storage quota: throttle per author separately from posts.
  const limited = consumeRateLimit(
    `blog-image:${authenticated.user.$id}`,
    30,
    60 * 60 * 1000,
  );

  if (!limited.allowed) {
    return fail("RATE_LIMITED", "Too many requests", 429);
  }
  try {
    const contentType = request.headers.get("content-type") || "";
    let file: unknown = null;
    let directFileId: string | null = null;

    if (contentType.includes("application/json")) {
      const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
      if (!body || typeof body.fileId !== "string" || !body.fileId.trim()) return fail("VALIDATION", "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.", 400);
      directFileId = body.fileId.trim().slice(0, 36);
      file = null;
    } else {
      const form = await request.formData();
      file = form.get("file");
      if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
        return fail("VALIDATION", "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.", 400);
      }
    }
    const { storage } = createServerStorage();
    if (directFileId) {
      let existingFile: { sizeOriginal?: number; mimeType?: string; $id?: string } | null = null;
      try { existingFile = await storage.getFile(BUCKET_ID, directFileId); } catch { return fail("VALIDATION", "Uploaded file not found — please re-attach", 400); }
      if (!isOwnedBy(existingFile, authenticated.user.$id)) {
        return fail("FORBIDDEN", "That file does not belong to this account", 403);
      }
      const size = (existingFile as unknown as { sizeOriginal: number })?.sizeOriginal ?? 0;
      const mime = (existingFile as unknown as { mimeType: string })?.mimeType ?? "";
      if (size > MAX_FILE_SIZE || (mime && !ALLOWED_TYPES.has(mime))) {
        try { await storage.deleteFile(BUCKET_ID, directFileId); } catch {}
        return fail("VALIDATION", "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.", 400);
      }
      try { await storage.updateFile(BUCKET_ID, directFileId, undefined, PUBLIC_FILE_PERMISSIONS); } catch (e) { logError("Blog direct file perm update failed:", e); }
      return ok({ url: getStorageFileViewUrl(BUCKET_ID, directFileId), fileId: directFileId }, 201);
    }
    const uploaded = await storage.createFile(
      BUCKET_ID,
      ID.unique(),
      file as File,
      PUBLIC_FILE_PERMISSIONS,
    );

    return ok(
      {
        url: getStorageFileViewUrl(BUCKET_ID, uploaded.$id),
        fileId: uploaded.$id,
      },
      201,
    );
  } catch (error) {
    logError("Blog image upload error:", error);

    return fail("INTERNAL", "Unable to upload blog image", 500);
  }
}
