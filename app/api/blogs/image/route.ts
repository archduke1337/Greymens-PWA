import { NextRequest } from "next/server";
import { ID } from "appwrite";
import { createAdminClient } from "@/lib/appwrite";
import { requireCapability } from "@/lib/access-control";
import { PUBLIC_FILE_PERMISSIONS } from "@/lib/storage";
import { ok, fail, ApiError } from "@/lib/api";

const BUCKET_ID = "blog-images";
const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

export async function POST(request: NextRequest) {
  const authenticated = await requireCapability(request, "blog.create");
  if (!authenticated.user) return authenticated.response;
  try {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File) || !ALLOWED_TYPES.has(file.type) || file.size > MAX_FILE_SIZE) {
      return fail("VALIDATION", "Invalid image. Use JPG, PNG, GIF, or WebP under 10MB.", 400);
    }
    const { storage } = createAdminClient();
    const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), file, PUBLIC_FILE_PERMISSIONS);
    return ok({ url: storage.getFileView(BUCKET_ID, uploaded.$id).toString(), fileId: uploaded.$id }, 201);
  } catch (error) {
    console.error("Blog image upload error:", error);
    return fail("INTERNAL", "Unable to upload blog image", 500);
  }
}
