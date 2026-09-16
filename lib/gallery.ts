import type { GalleryImage } from "./types";

export type { GalleryImage };

/**
 * Gallery reads and writes go through the API routes, not a browser service.
 *
 * - Public reads: `GET /api/gallery` (approved + active only).
 * - Member uploads: `POST /api/gallery` (validated, moderated).
 * - Review: `/api/admin/gallery` behind `gallery.manage`.
 *
 * The gallery table grants no client access, so the previous browser-SDK
 * service could never succeed and was removed. This module keeps only the
 * shared row type.
 */
