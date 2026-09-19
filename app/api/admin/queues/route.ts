import { NextRequest } from "next/server";

import { createServerDatabases } from "@/lib/appwrite-server";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { getEffectiveCapabilities } from "@/lib/access-control";
import { REVIEW_QUEUES } from "@/lib/capabilities";
import { countPending } from "@/lib/server/queues";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Pending counts for the console sidebar badges.
 *
 * One request for every queue instead of the sidebar calling six list routes,
 * and each count is gated on the capability that can actually decide that
 * queue — REVIEW_QUEUES is the shared registry, so the badge and the nav entry
 * cannot disagree about who owns which queue. The predicates live in
 * lib/server/queues next to the overview that shows the work itself.
 */
export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    // Capabilities resolved once: hasServerCapability per queue would re-read
    // the same role/office/power rows up to fourteen times per page nav.
    const capabilities = await getEffectiveCapabilities(authenticated.user.$id);
    const isAdmin = capabilities.has("*");
    const { databases } = createServerDatabases();
    const queues: Record<string, number> = {};

    await Promise.all(
      REVIEW_QUEUES.map(async (queue) => {
        const authorized =
          isAdmin || queue.capabilities.some((cap) => capabilities.has(cap));

        if (!authorized) return;
        const count = await countPending(databases, queue.key);

        if (count !== null) queues[queue.key] = count;
      }),
    );

    // Counts follow the caller's authority: never let a shared cache serve one
    // reviewer's queue sizes to another.
    return ok({ queues }, 200, { "Cache-Control": "private, no-store" });
  } catch (error) {
    logError("Review queue count error:", error);

    return fail("INTERNAL", "Unable to load queue counts", 500);
  }
}
