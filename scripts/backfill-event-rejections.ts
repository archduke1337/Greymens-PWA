/**
 * Greymens — Event Rejection/Cancellation Backfill
 *
 * Reclassifies events that were *rejected* before the two verdicts were split.
 *
 * Why this exists
 * ---------------
 * The console used to write one state for both outcomes: rejecting a proposal
 * and cancelling a live event both stored `status: cancelled` in
 * `rejectionReason`. The history therefore cannot tell "never approved" from
 * "called off", and the console labels the same row differently depending on
 * which screen reads it.
 *
 * The split (see app/api/admin/events/route.ts) writes `rejected` for a review
 * verdict and `cancelled` for taking back something already approved. Rows
 * written before the split keep the old value, so this script finds them and
 * moves the rejections across.
 *
 * How a row is classified
 * -----------------------
 * An event that reached approval carries `approvedAt` (and usually
 * `publishedAt`). The old Reject button was offered for `draft`/`review` — a
 * pre-approval state — so a `cancelled` row with neither timestamp could only
 * have been rejected. A row with either timestamp was genuinely cancelled, or
 * approved and then pulled; both are `cancelled` under the new phase rules, so
 * it is left alone.
 *
 * Usage
 * -----
 *   npm run backfill:event-status             # report only (default)
 *   npm run backfill:event-status -- --apply  # write status: rejected
 *
 * Requires NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID and
 * APPWRITE_API_KEY in .env.local.
 */

import { Client, ID, Query, TablesDB } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "greymens_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.\n" +
      "Add them to .env.local — the API key needs the `tables.*` scopes.",
  );
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);
const databases = new TablesDB(client);

const APPLY = process.argv.includes("--apply");
const PAGE = 100;

interface EventRow {
  $id: string;
  title?: string;
  status?: string;
  approvedAt?: string;
  publishedAt?: string;
  rejectionReason?: string;
  createdAt?: string;
  $createdAt?: string;
}

async function listCancelledEvents(): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  let offset = 0;

  for (;;) {
    const response = await databases.listRows({
      databaseId: DB_ID,
      tableId: "events",
      queries: [
        Query.equal("status", ["cancelled"]),
        Query.orderDesc("$createdAt"),
        Query.limit(PAGE),
        Query.offset(offset),
      ],
    });

    rows.push(...(response.rows as unknown as EventRow[]));
    if (response.rows.length < PAGE) break;
    offset += PAGE;
  }

  return rows;
}

async function writeAuditEntry(eventId: string, title: string) {
  // Best-effort, like the other administrative scripts: a failed audit write is
  // reported, not fatal, because the row change has already happened.
  try {
    await databases.createRow({
      databaseId: DB_ID,
      tableId: "audit_logs",
      rowId: ID.unique(),
      data: {
        actorId: "system",
        actorName: "backfill-event-rejections",
        actorRole: "system",
        action: "event.backfill_rejected",
        entityType: "event",
        entityId: eventId,
        details: JSON.stringify({ from: "cancelled", to: "rejected", title }),
        timestamp: new Date().toISOString(),
      },
      permissions: [],
    });
  } catch (error) {
    console.warn(
      `  ! Could not write the audit entry for ${eventId}: ${(error as Error).message}`,
    );
  }
}

async function main() {
  console.log(
    `\nEvent rejection/cancellation backfill — ${APPLY ? "APPLY" : "DRY RUN"}\n`,
  );

  const cancelled = await listCancelledEvents();

  if (cancelled.length === 0) {
    // Report the total as well: "nothing to do" has to be distinguishable from
    // a query that read an empty or wrong table.
    const all = await databases.listRows({
      databaseId: DB_ID,
      tableId: "events",
      queries: [Query.limit(1)],
    });

    console.log(
      `No events are in the \`cancelled\` state (${all.total} event(s) in the table). Nothing to do.`,
    );
    return;
  }

  // A pre-approval refusal: no approval and no publish ever happened.
  const rejections = cancelled.filter(
    (event) => !event.approvedAt && !event.publishedAt,
  );
  const genuineCancellations = cancelled.filter(
    (event) => event.approvedAt || event.publishedAt,
  );

  console.log(`${cancelled.length} cancelled event(s):`);
  for (const event of rejections) {
    console.log(
      `  REJECTION  ${event.$id}  "${event.title ?? "untitled"}"  (created ${event.$createdAt ?? "?"})`,
    );
  }
  for (const event of genuineCancellations) {
    console.log(
      `  CANCELLED  ${event.$id}  "${event.title ?? "untitled"}"  ` +
        `(approved ${event.approvedAt ?? "—"}, published ${event.publishedAt ?? "—"})`,
    );
  }

  if (rejections.length === 0) {
    console.log("\nNone of them were rejections. Nothing to backfill.");
    return;
  }

  if (!APPLY) {
    console.log(
      `\n${rejections.length} event(s) would be reclassified to \`rejected\`.\n` +
        "Re-run with --apply to write the change.",
    );
    return;
  }

  let updated = 0;

  for (const event of rejections) {
    try {
      await databases.updateRow({
        databaseId: DB_ID,
        tableId: "events",
        rowId: event.$id,
        data: { status: "rejected" },
      });
      await writeAuditEntry(event.$id, event.title ?? "");
      updated += 1;
      console.log(`  updated ${event.$id}`);
    } catch (error) {
      console.error(
        `  ! ${event.$id} could not be updated: ${(error as Error).message}`,
      );
    }
  }

  console.log(
    `\nReclassified ${updated} of ${rejections.length} event(s) as \`rejected\`.`,
  );
}

main().catch((error) => {
  console.error("Backfill failed:", error);
  process.exit(1);
});
