import { Query } from "appwrite";

import { createServerDatabases } from "@/lib/appwrite-server";
import { COLLECTIONS, DATABASE_ID } from "@/lib/database";
import { listUserContacts, type UserContact } from "@/lib/server-users";

/**
 * Every account-id that owns a profile row, paged into a set.
 *
 * "Onboarded" has no boolean flag anywhere (see POST /api/onboarding: it
 * creates the profile row), so row existence is the source of truth and a
 * set-subtract against the account directory is the only query that finds
 * people who registered but never started the form.
 */
async function profileUserIds(): Promise<Set<string>> {
  const { databases } = createServerDatabases();
  const ids = new Set<string>();
  let offset = 0;

  for (;;) {
    const page = await databases.listDocuments(
      DATABASE_ID,
      COLLECTIONS.PROFILES,
      [Query.limit(100), Query.offset(offset)],
    );

    for (const row of page.documents) {
      const userId = String(row.userId ?? "");

      if (userId) ids.add(userId);
    }
    if (page.documents.length < 100) break;
    offset += 100;
  }

  return ids;
}

/**
 * Accounts with no profile row — registered but never started onboarding.
 * Bounded at `limit` so a large directory cannot blow up a send or a page.
 */
export async function listNonOnboardedContacts(
  limit: number,
): Promise<UserContact[]> {
  const cap = Math.min(Math.max(limit, 1), 1000);
  const onboarded = await profileUserIds();
  const out: UserContact[] = [];
  let offset = 0;

  for (;;) {
    const page = await listUserContacts(100, offset);

    if (page.length === 0) break;
    for (const contact of page) {
      if (onboarded.has(contact.userId)) continue;
      out.push(contact);
      if (out.length >= cap) return out;
    }
    if (page.length < 100) break;
    offset += 100;
  }

  return out;
}
