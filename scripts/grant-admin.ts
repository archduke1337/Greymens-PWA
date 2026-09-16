/**
 * Greymens — Governance Role Bootstrap
 *
 * Grants or revokes the `admin` / `dev` governance tier for an account.
 *
 *   npm run grant-admin -- president@example.com
 *   npm run grant-admin -- president@example.com --role dev
 *   npm run grant-admin -- president@example.com --revoke
 *   npm run grant-admin -- --list
 *
 * Why this script exists
 * ----------------------
 * `admin` and `dev` are the only statuses that resolve to ALL_PERMISSIONS, so the
 * `user_roles` table is the most sensitive data in the database — it is
 * deliberately SERVER_ONLY, with no client read and no client write. That
 * creates a bootstrap problem: an administrator cannot promote themselves
 * through the API, because holding the capability to write `user_roles` is the
 * very thing being granted. This script is that bootstrap path. It requires the
 * Appwrite API key, so it can only be run by someone who already has
 * administrative access to the project itself.
 *
 * One row per account
 * -------------------
 * The row id is the user id, not a random value. `resolveMembershipStatus()`
 * resolves the governance tier with `limit(1)` and no ordering, so if an account
 * could accumulate several active role rows the tier it resolved to would be
 * whichever row Appwrite happened to return first. A deterministic row id makes
 * that state unrepresentable: there is exactly one role row per account, and
 * granting a new role replaces the old one in place.
 *
 * Every change is written to `audit_logs` so that a promotion is attributable
 * even when it happens outside the application.
 *
 * Run with: npx tsx scripts/grant-admin.ts <email> [--role admin|dev] [--revoke]
 */

import { Client, TablesDB, ID, Query, Users } from "node-appwrite";
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
      "Add them to .env.local — the API key needs the `users.read` and `tables.*` scopes."
  );
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);
const databases = new TablesDB(client);
const users = new Users(client);

const ROLES = ["admin", "dev"] as const;
type GovernanceRole = (typeof ROLES)[number];

// The script is the actor: it records that the change was made out-of-band
// rather than by an authenticated administrator through the console.
const SCRIPT_ACTOR_ID = "system:bootstrap-script";
const SCRIPT_ACTOR_NAME = "Bootstrap script";

interface Options {
  list: boolean;
  revoke: boolean;
  email: string | null;
  role: GovernanceRole;
}

function parseArgs(argv: string[]): Options {
  const positional: string[] = [];
  let role: GovernanceRole = "admin";
  let revoke = false;
  let list = false;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--list" || arg === "-l") {
      list = true;
    } else if (arg === "--revoke" || arg === "-r") {
      revoke = true;
    } else if (arg === "--role") {
      const value = argv[index + 1];
      if (!value || !ROLES.includes(value as GovernanceRole)) {
        console.error(`--role must be one of: ${ROLES.join(", ")}`);
        process.exit(1);
      }
      role = value as GovernanceRole;
      index += 1;
    } else if (arg.startsWith("-")) {
      console.error(`Unknown option: ${arg}`);
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  const email = positional[0]?.trim().toLowerCase() || null;
  if (!list && !email) {
    console.error(
      "Usage:\n" +
        "  npm run grant-admin -- <email> [--role admin|dev]\n" +
        "  npm run grant-admin -- <email> --revoke\n" +
        "  npm run grant-admin -- --list"
    );
    process.exit(1);
  }
  if (revoke && list) {
    console.error("--revoke and --list cannot be combined.");
    process.exit(1);
  }

  return { list, revoke, email, role };
}

async function findUserByEmail(email: string) {
  // Appwrite treats email as case-insensitive, but normalising here keeps the
  // lookup stable regardless of how the address was typed.
  const response = await users.list([Query.equal("email", [email]), Query.limit(1)]);
  return response.users[0] ?? null;
}

async function writeAuditEntry(entry: {
  action: string;
  userId: string;
  details: Record<string, unknown>;
}) {
  // Auditing is best-effort but never silent: a failed audit write is reported
  // and does not roll back a governance change that already succeeded, because
  // the alternative — leaving the database and the intent out of sync — is worse.
  try {
    await databases.createRow(DB_ID, "audit_logs", ID.unique(), {
      actorId: SCRIPT_ACTOR_ID,
      actorName: SCRIPT_ACTOR_NAME,
      actorRole: "system",
      action: entry.action,
      entityType: "user_roles",
      entityId: entry.userId,
      details: JSON.stringify(entry.details),
      timestamp: new Date().toISOString(),
    }, []);
  } catch (error) {
    console.warn(`  ! Could not write the audit entry: ${(error as Error).message}`);
  }
}

async function listRoles() {
  // Paginate beyond the 200-row page: loop with offset until a short page.
  const LIMIT = 200;
  let offset = 0;
  const rows: Record<string, unknown>[] = [];
  for (;;) {
    const response = await databases.listRows(DB_ID, "user_roles", [
      Query.equal("isActive", [true]),
      Query.limit(LIMIT),
      Query.offset(offset),
    ]);
    rows.push(...(response.rows as unknown as Record<string, unknown>[]));
    if (response.rows.length < LIMIT) break;
    offset += LIMIT;
  }

  if (rows.length === 0) {
    console.log("No governance roles are assigned. Nobody can reach the admin console.");
    return;
  }

  console.log(`${rows.length} active governance role(s):\n`);
  for (const document of rows) {
    const row = document as Record<string, unknown>;
    let email = "(account no longer exists)";
    try {
      const user = await users.get(String(row.userId));
      email = user.email;
    } catch {
      // The account was deleted but the role row survived; surface it rather
      // than hiding an orphaned grant.
    }
    console.log(`  ${String(row.role).padEnd(6)} ${email}`);
    console.log(`         userId=${String(row.userId)} grantedAt=${String(row.grantedAt)}`);
  }
}

async function revokeRole(userId: string, email: string) {
  try {
    // user_roles has no revokedAt column (see setup-appwrite.js): revoke by
    // flipping isActive + a reason note. grantedAt is history — never overwrite.
    await databases.updateRow(DB_ID, "user_roles", userId, {
      isActive: false,
      reason: `Revoked via scripts/grant-admin.ts at ${new Date().toISOString()}`,
    });
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 404) {
      console.log(`${email} has no governance role to revoke.`);
      return;
    }
    throw error;
  }

  await writeAuditEntry({
    action: "role.revoke",
    userId,
    details: { email, source: "bootstrap-script" },
  });
  console.log(`Revoked the governance role for ${email}.`);
}

async function grantRole(userId: string, email: string, role: GovernanceRole) {
  const data = {
    userId,
    role,
    grantedBy: SCRIPT_ACTOR_ID,
    grantedAt: new Date().toISOString(),
    reason: "Bootstrap grant via scripts/grant-admin.ts",
    isActive: true,
  };

  try {
    // The row id is the user id, so this either creates the first role row for
    // the account or replaces the existing one in place.
    await databases.createRow(DB_ID, "user_roles", userId, data, []);
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code !== 409) throw error;
    await databases.updateRow(DB_ID, "user_roles", userId, data);
  }

  await writeAuditEntry({
    action: "role.grant",
    userId,
    details: { email, role, source: "bootstrap-script" },
  });
  console.log(`Granted '${role}' to ${email} (${userId}).`);
  console.log("Log out and back in for the new tier to reach the client session.");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));

  if (options.list) {
    await listRoles();
    return;
  }

  const email = options.email as string;
  const user = await findUserByEmail(email);
  if (!user) {
    console.error(
      `No account exists with the email ${email}.\n` +
        "The account must register first — this script assigns a role, it does not create accounts."
    );
    process.exit(1);
  }

  if (options.revoke) {
    await revokeRole(user.$id, email);
  } else {
    await grantRole(user.$id, email, options.role);
  }
}

main().catch((error) => {
  const code = (error as { code?: number }).code;
  if (code === 401) {
    console.error("Appwrite rejected the API key. Check APPWRITE_API_KEY and that it has the `users.read` and `tables.*` scopes.");
  } else {
    console.error(error);
  }
  process.exit(1);
});
