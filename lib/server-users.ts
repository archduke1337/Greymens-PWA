import { Client, Query, Users } from "node-appwrite";

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

  return new Users(
    new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey),
  );
}

/**
 * Display names for the given account IDs.
 *
 * A person's name lives on their account, not on their profile — the `profiles`
 * table has no name column — so anything that needs to show who someone is has
 * to read it from here. Lookups are tolerant: a missing or deleted account
 * simply has no entry rather than failing the whole page.
 */
export async function getAccountNames(
  userIds: string[],
): Promise<Map<string, string>> {
  const unique = [...new Set(userIds.filter(Boolean))];

  if (unique.length === 0) return new Map();

  const users = createUsersClient();
  // Bounded concurrency in chunks: a 500-row admin dump must not open 500
  // simultaneous user lookups.
  const out = new Map<string, string>();

  for (let index = 0; index < unique.length; index += 20) {
    const page = unique.slice(index, index + 20);
    const entries = await Promise.all(
      page.map(async (userId) => {
        try {
          const user = await users.get({ userId });

          return [userId, user.name || user.email.split("@")[0]] as const;
        } catch {
          return null;
        }
      }),
    );

    for (const entry of entries) {
      if (entry !== null) out.set(entry[0], entry[1]);
    }
  }

  return out;
}

/** Resolve an account ID from an email address, or `null` when there is no match. */
export async function findUserIdByEmail(email: string): Promise<string | null> {
  const normalised = email.trim().toLowerCase();

  if (!normalised) return null;

  const users = createUsersClient();
  const response = await users.list({
    queries: [`equal("email", [${JSON.stringify(normalised)}])`],
  });
  const match = response.users.find(
    (user) => user.email.toLowerCase() === normalised,
  );

  return match?.$id ?? null;
}

export interface UserSearchHit {
  userId: string;
  name: string;
  email: string;
}

/**
 * Substring search over account display names through the Users API.
 *
 * Names live on the account, not on `profiles` (that table deliberately has
 * no name column), so a "type a name, pick the person" picker cannot be
 * served from profiles alone. Tolerant: any failure yields no hits rather
 * than failing the caller's flow.
 */
export async function searchUsersByName(
  query: string,
  limit = 10,
): Promise<UserSearchHit[]> {
  const term = query.trim();

  if (!term) return [];
  try {
    const users = createUsersClient();
    const response = await users.list({
      queries: [
        Query.search("name", term),
        Query.limit(Math.min(Math.max(limit, 1), 20)),
      ],
    });

    return response.users.map((user) => ({
      userId: user.$id,
      name: user.name || user.email.split("@")[0],
      email: user.email,
    }));
  } catch {
    return [];
  }
}

export interface UserContact {
  userId: string;
  name: string;
  email: string;
  /** Auth record creation time, ISO string. */
  createdAt: string;
}

/** Single account's contact, or `null` when the account is gone. */
export async function getUserContact(
  userId: string,
): Promise<UserContact | null> {
  try {
    const user = await createUsersClient().get({ userId });

    if (!user.email) return null;

    return {
      userId: user.$id,
      name: user.name || user.email.split("@")[0],
      email: user.email,
      createdAt: user.$createdAt,
    };
  } catch {
    return null;
  }
}

/**
 * One page of the account directory (bounded, tolerant). Used to resolve
 * broadcast audiences to email addresses without loading the directory.
 */
export async function listUserContacts(
  limit: number,
  offset: number,
): Promise<UserContact[]> {
  try {
    const response = await createUsersClient().list({
      queries: [Query.limit(limit), Query.offset(offset)],
    });

    return response.users
      .filter((user) => Boolean(user.email))
      .map((user) => ({
        userId: user.$id,
        name: user.name || user.email.split("@")[0],
        email: user.email,
        createdAt: user.$createdAt,
      }));
  } catch {
    return [];
  }
}
