import { Client, Users } from "node-appwrite";

/**
 * Server-only account lookups.
 *
 * Email addresses are not stored on `profiles` — the account is the
 * authoritative record for identity, and duplicating it into a queryable table
 * would create a second, stale copy of personal data. Anything that needs to
 * find an account by email goes through the Users API instead.
 *
 * This module imports `node-appwrite`, which must never reach a client bundle,
 * so it is intentionally separate from `lib/appwrite.ts` (that module is pulled
 * into client components for the browser SDK).
 */
function createUsersClient(): Users {
  const endpoint = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
  const projectId = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;
  if (!endpoint || !projectId || !apiKey) {
    throw new Error("Server Appwrite configuration is incomplete");
  }
  return new Users(new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey));
}

/**
 * Display names for the given account IDs.
 *
 * A person's name lives on their account, not on their profile — the `profiles`
 * table has no name column — so anything that needs to show who someone is has
 * to read it from here. Lookups are tolerant: a missing or deleted account
 * simply has no entry rather than failing the whole page.
 */
export async function getAccountNames(userIds: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const users = createUsersClient();
  const entries = await Promise.all(
    unique.map(async (userId) => {
      try {
        const user = await users.get({ userId });
        return [userId, user.name || user.email.split("@")[0]] as const;
      } catch {
        return null;
      }
    })
  );

  return new Map(entries.filter((entry): entry is readonly [string, string] => entry !== null));
}

/** Resolve an account ID from an email address, or `null` when there is no match. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase();
  if (!normalised) return null;

  const users = createUsersClient();
  const response = await users.list({ queries: [`equal("email", [${JSON.stringify(normalised)}])`] });
  const match = response.users.find((user) => user.email.toLowerCase() === normalised);
  return match?.$id ?? null;
}
