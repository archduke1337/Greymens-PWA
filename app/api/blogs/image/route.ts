import { NextRequest } from "next/server";
import { ID } from "appwrite";

import { createServerStorage } from "@/lib/appwrite-server";
import { requireCapability } from "@/lib/access-control";
import { PUBLIC_FILE_PERMISSIONS, getStorageFileViewUrl } from "@/lib/storage";
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
    const form = await request.formData();
    const file = form.get("file");

    if (
      !(file instanceof File) ||
      !ALLOWED_TYPES.has(file.type) ||
      file.size > MAX_FILE_SIZE
    ) {
      return fail(
        "VALIDATION",
        "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.",
        400,
      );
    }
    const { storage } = createServerStorage();
    const uploaded = await storage.createFile(
      BUCKET_ID,
      ID.unique(),
      file,
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
