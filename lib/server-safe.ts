import { logError } from "@/lib/logger";

/**
 * Run a sub-query so its failure cannot take down the whole response.
 *
 * Routes that fan out into many Appwrite reads joined by `Promise.all` (the
 * dashboard and permission payloads) used to 500 wholesale when any single
 * read failed — a transient driver error or one unmigrated table blanked
 * every section. Wrapped this way, the failing section logs loudly and
 * degrades to its fallback instead: a member seeing events but not
 * notifications beats a member seeing an error page.
 *
 * Callers choose the fallback deliberately: `[]` for lists that read as
 * "nothing yet", `null` for optional enrichments. For anything
 * authorization-shaped, prefer fail-closed fallbacks (empty capability set),
 * never a permissive one.
 */
export async function safe<T>(
  label: string,
  run: () => Promise<T>,
  fallback: T,
): Promise<T> {
  try {
    return await run();
  } catch (error) {
    logError(`"${label}" query failed:`, error);

    return fallback;
  }
}
