import { Permission, Role } from "appwrite";

/**
 * File-level read permissions for uploads.
 *
 * Buckets are provisioned with `fileSecurity: true`, which means a file's own
 * permissions decide who can read it — the bucket's permissions are not
 * inherited. Uploading without an explicit read permission therefore produces a
 * file that nobody (including the browser that should display it) can open.
 *
 * Passing one of these arrays to `storage.createFile` keeps uploads readable.
 * These are read permissions only: writes remain API-owned, so a client can
 * still never create or delete a file directly.
 */
export const PUBLIC_FILE_PERMISSIONS = [Permission.read(Role.any())];

/** For content that should be limited to signed-in accounts. */
export const MEMBER_FILE_PERMISSIONS = [Permission.read(Role.users())];

/**
 * Owner-only read, for a file whose submission has not been approved yet.
 *
 * "Private until approved" cannot mean public-with-a-secret-URL: a file uploaded
 * with the world-readable permission is reachable by anyone who has (or guesses)
 * the view URL, long before a reviewer looks at it. Until a moderator decides,
 * the bytes belong to the uploader alone.
 */
export function ownerFilePermissions(userId: string) {
  return [Permission.read(Role.user(userId))];
}

/**
 * Public view URL for a stored file.
 *
 * node-appwrite's `storage.getFileView()` downloads the file content
 * (`Promise<ArrayBuffer>`) — it does not return a URL. Stringifying that
 * promise stored `"[object Promise]"` as the URL on every upload, so all
 * server upload routes must build the view URL with this helper instead.
 */
export function getStorageFileViewUrl(
  bucketId: string,
  fileId: string,
): string {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT ?? "";
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID ?? "";

  return `${endpoint}/storage/buckets/${bucketId}/files/${fileId}/view?project=${projectId}`;
}

/**
 * Ownership check for a file the client uploaded directly and is now asking
 * the route to adopt. Size/mime alone would let any signed-in user attach a
 * fileId they learned (or guessed) inside a shared bucket as their own row.
 *
 * `$createdBy` is set by Appwrite on create; if the platform ever omits it we
 * fail closed only when the uploader identity is present and mismatched —
 * an absent field is treated as unknown and allowed (legacy files), while an
 * explicit other-user id is rejected.
 */
export function isOwnedBy(file: unknown, userId: string): boolean {
  if (!file || typeof file !== "object") return false;
  const createdBy = (file as { $createdBy?: unknown }).$createdBy;

  if (typeof createdBy !== "string" || !createdBy) return true;
  return createdBy === userId;
}

/**
 * Best-effort compensation after a direct upload whose row insert failed.
 * Never throws: a leftover file is storage noise, a thrown cleanup would
 * mask the original error.
 */
export async function safeDeleteFile(
  storage: {
    deleteFile: (bucketId: string, fileId: string) => Promise<unknown>;
  },
  bucketId: string,
  fileId: string | null | undefined,
): Promise<void> {
  if (!fileId) return;
  try {
    await storage.deleteFile(bucketId, fileId);
  } catch {
    // Orphan is acceptable; the route already failed the user-facing path.
  }
}
