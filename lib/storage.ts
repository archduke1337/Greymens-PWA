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
