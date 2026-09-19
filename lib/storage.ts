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
