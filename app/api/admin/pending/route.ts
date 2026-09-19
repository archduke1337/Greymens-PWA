import { NextRequest } from "next/server";

import { createServerDatabases } from "@/lib/appwrite-server";
import { requireAuthenticatedUser } from "@/lib/server-auth";
import { getEffectiveCapabilities } from "@/lib/access-control";
import { REVIEW_QUEUES } from "@/lib/capabilities";
import { listPending } from "@/lib/server/queues";
import { getAccountNames } from "@/lib/server-users";
import { ok, fail } from "@/lib/api";
import { logError } from "@/lib/logger";

/**
 * Everything waiting on a decision, across every content queue, in one payload.
 *
 * The console's own pages already list their queues; this endpoint exists so an
 * administrator can answer "what needs me right now?" without visiting seven
 * pages. Each queue is included only when the caller holds a capability that
 * can actually decide it, so the overview is never a peek at work the caller
 * would then be 403ed from acting on.
 */
const ITEMS_PER_QUEUE = 10;

export async function GET(request: NextRequest) {
  const authenticated = await requireAuthenticatedUser(request);

  if (!authenticated.user) return authenticated.response;

  try {
    const capabilities = await getEffectiveCapabilities(
      authenticated.user.$id,
      undefined,
      undefined,
      authenticated.user.email,
    );
    const isAdmin = capabilities.has("*");
    const { databases } = createServerDatabases();
    const authorized = REVIEW_QUEUES.filter(
      (queue) =>
        isAdmin || queue.capabilities.some((cap) => capabilities.has(cap)),
    );

    const groups = await Promise.all(
      authorized.map(async (queue) => {
        const items = await listPending(databases, queue.key, ITEMS_PER_QUEUE);

        if (items === null) return null;

        return { ...queue, items };
      }),
    );
    const visible = groups.filter(
      (group): group is NonNullable<typeof group> => group !== null,
    );

    // Submitter names live on the auth records, not the content rows —
    // best-effort so an account lookup failure never blanks the overview.
    const submitterIds = [
      ...new Set(
        visible.flatMap((group) =>
          group.items
            .map((item) => item.submitterId)
            .filter((id): id is string => Boolean(id)),
        ),
      ),
    ];
    const submitterNames = await getAccountNames(submitterIds).then(
      (names) => Object.fromEntries(names) as Record<string, string>,
      () => ({}) as Record<string, string>,
    );

    return ok(
      {
        total: visible.reduce((sum, group) => sum + group.items.length, 0),
        // Counts are per-queue and exact; items are the newest handful. The
        // overview links out for the full list, so the cap is honest here.
        queues: visible.map((group) => ({
          key: group.key,
          href: group.href,
          label: group.label,
          items: group.items.map((item) => ({
            ...item,
            submitterName: item.submitterId
              ? (submitterNames[item.submitterId] ?? null)
              : null,
          })),
        })),
      },
      200,
      { "Cache-Control": "private, no-store" },
    );
  } catch (error) {
    logError("Pending overview error:", error);

    return fail("INTERNAL", "Unable to load pending work", 500);
  }
}
