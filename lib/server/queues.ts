/**
 * Queue plumbing shared by the sidebar badges and the pending overview.
 *
 * A queue is one thing: what "pending" means, where the title lives, and who
 * submitted it. Keeping the predicate next to the display fields means
 * /api/admin/queues (counts) and /api/admin/pending (the work itself) can
 * never disagree about what is waiting, and a new queue is one entry here plus
 * one entry in REVIEW_QUEUES.
 */

import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";

type Databases = ReturnType<typeof createServerDatabases>["databases"];

export interface PendingSpec {
  collection: string;
  queries: string[];
  /** Field carrying the row's display title, when the table has one. */
  titleField?: string;
  /** Field carrying the submitter's user id, when the table records one. */
  ownerField?: string;
  /** Field adding one line of context (kind, tier, category). */
  detailField?: string;
  /** Shown when the table has no title of its own (applications). */
  fallbackTitle: string;
}

export const PENDING_SPECS: Record<string, PendingSpec> = {
  membership: {
    collection: COLLECTIONS.APPLICATIONS,
    queries: [Query.equal("status", ["pending"])],
    ownerField: "userId",
    fallbackTitle: "Membership application",
  },
  events: {
    collection: COLLECTIONS.EVENTS,
    queries: [Query.equal("status", ["review"])],
    titleField: "title",
    ownerField: "ownerId",
    detailField: "category",
    fallbackTitle: "Event proposal",
  },
  blogs: {
    collection: COLLECTIONS.BLOGS,
    queries: [Query.equal("status", ["pending"])],
    titleField: "title",
    ownerField: "authorId",
    detailField: "category",
    fallbackTitle: "Blog post",
  },
  resources: {
    collection: COLLECTIONS.RESOURCES,
    queries: [Query.equal("status", ["pending"])],
    titleField: "title",
    ownerField: "uploadedBy",
    detailField: "type",
    fallbackTitle: "Resource upload",
  },
  gallery: {
    collection: COLLECTIONS.GALLERY,
    queries: [Query.equal("status", ["pending"])],
    titleField: "title",
    ownerField: "uploadedBy",
    detailField: "category",
    fallbackTitle: "Gallery photo",
  },
  projects: {
    collection: COLLECTIONS.PROJECTS,
    queries: [Query.equal("reviewStatus", ["review"])],
    titleField: "title",
    ownerField: "ownerId",
    detailField: "category",
    fallbackTitle: "Project proposal",
  },
  sponsors: {
    collection: COLLECTIONS.SPONSORS,
    queries: [Query.equal("status", ["pending"])],
    titleField: "name",
    ownerField: "submittedBy",
    detailField: "tier",
    fallbackTitle: "Sponsor proposal",
  },
};

export interface PendingItem {
  id: string;
  title: string;
  detail?: string;
  submitterId?: string;
  createdAt?: string;
}

function summarize(
  spec: PendingSpec,
  row: Record<string, unknown>,
): PendingItem {
  const title = spec.titleField
    ? String(row[spec.titleField] ?? "").trim()
    : "";
  const detail = spec.detailField
    ? String(row[spec.detailField] ?? "").trim()
    : "";
  const submitterId = spec.ownerField
    ? String(row[spec.ownerField] ?? "").trim()
    : "";

  return {
    id: String(row.$id ?? ""),
    title: title || spec.fallbackTitle,
    ...(detail ? { detail } : {}),
    ...(submitterId ? { submitterId } : {}),
    ...(row.$createdAt ? { createdAt: String(row.$createdAt) } : {}),
  };
}

/**
 * Newest pending rows for one queue, or null when the lookup fails (a live
 * table that predates a column must degrade to "nothing to show", never to a
 * 500 over the whole overview).
 */
export async function listPending(
  databases: Databases,
  key: string,
  limit: number,
): Promise<PendingItem[] | null> {
  const spec = PENDING_SPECS[key];

  if (!spec) return null;

  return databases
    .listDocuments(DATABASE_ID, spec.collection, [
      ...spec.queries,
      Query.orderDesc("$createdAt"),
      Query.limit(limit),
    ])
    .then((response) =>
      response.documents.map((row) =>
        summarize(spec, row as Record<string, unknown>),
      ),
    )
    .catch(() => null);
}

/** Pending row count for one queue, or null when the lookup fails. */
export async function countPending(
  databases: Databases,
  key: string,
): Promise<number | null> {
  const spec = PENDING_SPECS[key];

  if (!spec) return null;

  return databases
    .listDocuments(DATABASE_ID, spec.collection, [
      ...spec.queries,
      Query.limit(1),
    ])
    .then((response) => response.total)
    .catch(() => null);
}
