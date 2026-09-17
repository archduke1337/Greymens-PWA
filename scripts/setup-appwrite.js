#!/usr/bin/env node
// ============================================================
// Greymens Appwrite Setup Script (Node.js SDK)
// Creates: 29 tables, their indexes, and 7 storage buckets.
// Run: npm run db:setup
//
// Permissions model: catalog tables (events, blogs, departments, ...) are
// public-read; every identity, membership, ticket, notification, audit and
// governance table is server-only. All writes go through authenticated API
// routes, never through the browser SDK.
// ============================================================

const fs = require("fs");
const path = require("path");
const { Client, TablesDB, Storage, ID, Permission, Role } = require("node-appwrite");

// Read config from .env.local, falling back to .env when it is absent.
const readEnvFile = (fileName) => {
  const filePath = path.join(__dirname, "..", fileName);
  return fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf-8") : "";
};

const envContent = `${readEnvFile(".env.local")}\n${readEnvFile(".env")}`;
const get = (key) => {
  // Match the full rest of the line so secrets containing spaces, `=`, or
  // quotes survive; strip one layer of matching surrounding quotes.
  const m = envContent.match(new RegExp(`^${key}\\s*=\\s*(.*?)\\s*$`, "m"));
  if (!m) return null;
  const raw = m[1].trim();

  if (
    raw.length >= 2 &&
    ((raw.startsWith('"') && raw.endsWith('"')) ||
      (raw.startsWith("'") && raw.endsWith("'")))
  ) {
    return raw.slice(1, -1);
  }
  return raw || null;
};

const ENDPOINT = get("NEXT_PUBLIC_APPWRITE_ENDPOINT");
const PROJECT_ID = get("NEXT_PUBLIC_APPWRITE_PROJECT_ID");
const API_KEY = get("APPWRITE_API_KEY");
// Must match NEXT_PUBLIC_APPWRITE_DATABASE_ID, otherwise the app would read
// from a different database than the one provisioned here.
const DB_ID = get("NEXT_PUBLIC_APPWRITE_DATABASE_ID") || "greymens_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error("Missing NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY in .env.local");
  process.exit(1);
}

const client = new Client()
  .setEndpoint(ENDPOINT)
  .setProject(PROJECT_ID)
  .setKey(API_KEY);

const db = new TablesDB(client);
const storage = new Storage(client);

let ok = 0;
let fail = 0;

// Catalog tables are intentionally public-read: they back the public pages and
// hold no personal data.
const PUBLIC_READ_TABLES = new Set([
  "events",
  "projects",
  "departments",
  "designations",
  "powers",
  "event_types",
  "blogs",
  "sponsors",
]);

// Tables that member/moderator pages still read through the browser SDK.
// Authenticated read only; never world-readable and never client-writable.
//
// WARNING — this is a temporary concession, not a safe end state: `Role.users()`
// means any signed-in account can read every row, including rows belonging to
// other members. Each table here is a candidate for the API migration listed in
// docs/ACCESS_MODEL.md, after which it should move to SERVER_ONLY_TABLES.
const AUTHENTICATED_READ_TABLES = new Set([
  "event_type_data",
  "profiles",
  "applications",
  "memberships",
  "user_departments",
  "user_designations",
  "user_powers",
  "tickets",
  "ticket_verifications",
  "resources",
  "approval_workflows",
]);

// Tables that are only ever touched by server API routes. No client read and no
// client write.
//
// `gallery` lives here even though the public gallery page renders its rows:
// the page reads through GET /api/gallery (admin client, approved + active
// only). Table-level public read would expose pending/rejected submissions to
// anyone with the endpoint, since row security is off.
const SERVER_ONLY_TABLES = new Set([
  "gallery",
  // Registrations are written and read only through /api/events/register and
  // the admin queue, which scope every read to the session owner or the door.
  "registrations",
  "role_templates",
  "role_assignments",
  "authorized_activities",
  "incident_reports",
  "governance_records",
  "office_assignments",
  // The global governance tier. A row here grants `admin` or `dev`, which
  // resolves to ALL_PERMISSIONS, so this is the single most sensitive table in
  // the database: no client permissions at all, writes only through a
  // capability-gated route, and every change is audited.
  "user_roles",
  // Audit records name specific accounts and actions. They are written and read
  // only through /api/audit, which derives the actor from the verified session.
  "audit_logs",
  // One row per recipient. Read and written only through /api/notifications,
  // which scopes member reads to the session owner.
  "notifications",
]);

function tablePermissions(id) {
  if (PUBLIC_READ_TABLES.has(id)) return [Permission.read(Role.any())];
  if (AUTHENTICATED_READ_TABLES.has(id)) return [Permission.read(Role.users())];
  if (SERVER_ONLY_TABLES.has(id)) return [];
  // Unclassified table: fail closed and make the omission obvious.
  console.warn(`    ! ${id} has no permission classification; defaulting to server-only`);
  return [];
}

// Helper: create table with SDK-supported types
// string -> varchar-like (inline, indexable up to size)
// integer -> integer
// boolean -> boolean
// datetime -> datetime (ISO 8601)
/**
 * Create any declared column that is missing from an existing table.
 *
 * Appwrite's `createTable` only creates; it never evolves. Without this, the
 * schemas declared below are a one-shot snapshot: any column added to the code
 * afterwards silently never reaches an already-provisioned database, and the
 * application keeps writing to a column that does not exist. Reconciling here
 * is what makes `npm run db:setup` safe to re-run as a migration.
 */
/**
 * Best-effort full listing of a paginated Appwrite endpoint.
 *
 * Hard limits discovered against the live API: pages hold at most 25 rows no
 * matter the requested limit, `offset` is ignored by listColumns, and columns
 * expose no cursorable id — so tables wider than 25 columns cannot be fully
 * enumerated through this SDK. Callers must therefore treat "already exists"
 * creation errors as present, not fatal (see ensureColumns).
 */
async function listAll(listFn, params, key) {
  const rows = [];
  const limit = 25;
  let offset = 0;
  let total = Infinity;

  while (rows.length < total) {
    const page = await listFn({ ...params, limit, offset });
    const items = page[key] ?? [];

    rows.push(...items);
    total = typeof page.total === "number" ? page.total : rows.length;
    if (items.length === 0) break;
    offset += items.length;
  }
  return rows;
}

async function ensureColumns(tableId, columns) {
  const existing = await listAll(
    (params) => db.listColumns(params),
    { databaseId: DB_ID, tableId },
    "columns",
  );
  const present = new Set(existing.map((column) => column.key));
  const added = [];

  for (const c of columns) {
    if (present.has(c.key)) continue;
    const params = { databaseId: DB_ID, tableId, key: c.key, required: c.required ?? false };
    try {
      if (c.type === "string") {
        await db.createStringColumn({ ...params, size: c.size ?? 255, array: c.array ?? false });
      } else if (c.type === "integer") {
        await db.createIntegerColumn(params);
      } else if (c.type === "boolean") {
        await db.createBooleanColumn(params);
      } else if (c.type === "datetime") {
        await db.createDatetimeColumn(params);
      } else {
        throw new Error(`Unsupported column type for ${c.key}: ${c.type}`);
      }
      added.push(c.key);
    } catch (columnError) {
      // Columns past the 25-row listing cap are invisible to the presence
      // check above but very much exist: "already exists" means present.
      // Anything else is a real schema problem and still fails loudly.
      if (/already exists/i.test(columnError.message ?? "")) continue;
      throw columnError;
    }
  }

  return added;
}

/** Create any declared index that is missing from an existing table. */
async function ensureIndexes(tableId, indexes) {
  if (indexes.length === 0) return [];
  const existing = await listAll(
    (params) => db.listIndexes(params),
    { databaseId: DB_ID, tableId },
    "indexes",
  );
  const present = new Map(existing.map((index) => [index.key, index]));
  const added = [];

  for (const i of indexes) {
    const current = present.get(i.key);
    if (current) {
      // Appwrite cannot change an index type in place. A key→unique upgrade on
      // a table with duplicate rows will fail server-side; surface that loudly
      // with the manual remediation instead of dying mid-reconcile.
      const currentType = current.type ?? current.status;
      if (currentType && currentType !== i.type) {
        console.warn(
          `    ! ${tableId}.${i.key} is ${currentType} but declared ${i.type}: ` +
            `dedupe rows, then drop and recreate the index in the console`,
        );
      }
      continue;
    }
    try {
      await db.createIndex({
        databaseId: DB_ID,
        tableId,
        key: i.key,
        type: i.type,
        columns: i.columns,
        orders: i.orders || i.columns.map(() => "ASC"),
      });
      added.push(i.key);
    } catch (indexError) {
      // Unique upgrades fail when duplicate rows already exist. Warn with the
      // fix; do not fail the whole table reconcile over one index.
      console.warn(
        `    ! ${tableId}.${i.key} could not be created (${indexError.message}): ` +
          `dedupe the ${i.columns.join("+")} rows, then re-run db:setup`,
      );
    }
  }

  return added;
}

/** Align an existing table's read permissions with its classification. */
async function ensurePermissions(tableId) {
  const wanted = tablePermissions(tableId);

  try {
    const current = await db.getTable({ databaseId: DB_ID, tableId });
    const have = new Set(current.permissions ?? []);
    const aligned =
      wanted.length === (current.permissions ?? []).length &&
      wanted.every((permission) => have.has(permission));

    if (aligned) return true;
    await db.updateTable({
      databaseId: DB_ID,
      tableId,
      permissions: wanted,
    });
    console.warn(`    ~ ${tableId} read permissions aligned (${wanted.join(", ") || "server-only"})`);
    return true;
  } catch (permissionsError) {
    console.warn(
      `    ! ${tableId} permissions not reconciled (${permissionsError.message}): ` +
        `align read access in the console`,
    );
    return false;
  }
}

async function createTable(id, name, columns, indexes = []) {
  process.stdout.write(`  ${name}...`);
  try {
    await db.createTable({
      databaseId: DB_ID,
      tableId: id,
      name,
      // Writes are always API-owned: no client write permission is ever
      // granted. Reads are scoped by table classification above.
      permissions: tablePermissions(id),
      rowSecurity: false,
      enabled: true,
      columns: columns.map((c) => {
        const col = { key: c.key, type: c.type, required: c.required ?? false };
        if (c.size !== undefined) col.size = c.size;
        if (c.array) col.array = true;
        return col;
      }),
      indexes: indexes.map((i) => ({
        key: i.key,
        type: i.type,
        attributes: i.columns,
        orders: i.orders || i.columns.map(() => "ASC"),
      })),
    });
    console.log(" \x1b[32mOK\x1b[0m");
    ok++;
  } catch (e) {
    if (e.code === 409) {
      // Already provisioned: reconcile instead of skipping, so schema changes
      // reach databases that were created by an earlier version of this file.
      try {
        const addedColumns = await ensureColumns(id, columns);
        const addedIndexes = await ensureIndexes(id, indexes);
        // Permission alignment reports its own changes; a failed alignment is
        // non-fatal here because the table itself is usable.
        await ensurePermissions(id);
        const drift = [...addedColumns, ...addedIndexes];
        if (drift.length > 0) {
          console.log(` \x1b[36mUPDATED (${drift.join(", ")})\x1b[0m`);
        } else {
          console.log(" \x1b[33mEXISTS\x1b[0m");
        }
        ok++;
      } catch (reconcileError) {
        console.log(` \x1b[31mFAIL (reconcile): ${reconcileError.message}\x1b[0m`);
        fail++;
      }
    } else {
      console.log(` \x1b[31mFAIL: ${e.message}\x1b[0m`);
      fail++;
    }
  }
}

async function createBucket(id, name, maxSize, extensions, visibility = "public") {
  process.stdout.write(`  ${name}...`);
  try {
    await storage.createBucket({
      bucketId: id,
      name,
      // File mutations are intentionally API-owned; browser uploads must move
      // through authenticated upload endpoints with validation.
      permissions: [visibility === "members" ? Permission.read(Role.users()) : Permission.read(Role.any())],
      fileSecurity: true,
      enabled: true,
      maximumFileSize: maxSize,
      allowedFileExtensions: extensions,
      compression: "gzip",
      encryption: true,
      antivirus: true,
    });
    console.log(" \x1b[32mOK\x1b[0m");
    ok++;
  } catch (e) {
    if (e.code === 409) { console.log(" \x1b[33mEXISTS\x1b[0m"); ok++; }
    else { console.log(` \x1b[31mFAIL: ${e.message}\x1b[0m`); fail++; }
  }
}

// ============================================================
// MAIN
// ============================================================
(async () => {
  console.log("\n\x1b[35m============================================\x1b[0m");
  console.log("\x1b[35m  Greymens Appwrite Database Setup\x1b[0m");
  console.log("\x1b[35m============================================\x1b[0m");
  console.log(`  Endpoint : ${ENDPOINT}`);
  console.log(`  Project  : ${PROJECT_ID}`);
  console.log(`  Database : ${DB_ID}\n`);

  // Create database
  process.stdout.write("  Creating database...");
  try {
    await db.create({ databaseId: DB_ID, name: "Greymens Club" });
    console.log(" \x1b[32mOK\x1b[0m");
    ok++;
  } catch (e) {
    if (e.code === 409) { console.log(" \x1b[33mEXISTS\x1b[0m"); ok++; }
    else { console.log(` \x1b[31mFAIL: ${e.message}\x1b[0m`); fail++; }
  }

  const MB = 1024 * 1024;

  // ===== TABLES =====
  // Column types: string (size required), boolean, integer, datetime
  // For enum/float/email/url fields -> use string
  console.log("\n\x1b[36m  Tables:\x1b[0m");

  await createTable("events", "Events", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "slug", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535, required: true },
    { key: "image", type: "string", size: 500 },
    { key: "eventTypeId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "audience", type: "string", size: 50, required: true },
    { key: "date", type: "string", size: 30, required: true },
    { key: "time", type: "string", size: 30, required: true },
    { key: "endDate", type: "string", size: 30 },
    { key: "venue", type: "string", size: 255, required: true },
    { key: "location", type: "string", size: 500, required: true },
    { key: "capacity", type: "integer", required: true },
    { key: "registered", type: "integer", required: true },
    { key: "price", type: "integer", required: true },
    { key: "discountPrice", type: "integer" },
    { key: "organizerName", type: "string", size: 255, required: true },
    { key: "organizerAvatar", type: "string", size: 500 },
    { key: "ownerId", type: "string", size: 36, required: true },
    { key: "approvedBy", type: "string", size: 36 },
    { key: "approvedAt", type: "string", size: 30 },
    { key: "publishedAt", type: "string", size: 30 },
    { key: "tags", type: "string", size: 255, array: true },
    { key: "isFeatured", type: "boolean", required: true },
    { key: "isPremium", type: "boolean", required: true },
    { key: "eventDocs", type: "string", size: 65535 },
    { key: "externalLinks", type: "string", size: 65535 },
    { key: "materials", type: "string", size: 65535 },
    { key: "registrationUrl", type: "string", size: 500 },
    { key: "eventWebsite", type: "string", size: 500 },
    { key: "contactEmail", type: "string", size: 255 },
    { key: "rejectionReason", type: "string", size: 2000 },
  ], [
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_slug", type: "unique", columns: ["slug"] },
    { key: "idx_date", type: "key", columns: ["date"] },
    { key: "idx_owner", type: "key", columns: ["ownerId"] },
    { key: "idx_featured", type: "key", columns: ["isFeatured"] },
    { key: "idx_audience", type: "key", columns: ["audience"] },
    { key: "idx_event_type", type: "key", columns: ["eventTypeId"] },
  ]);

  await createTable("registrations", "Registrations", [
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "userId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "registeredAt", type: "string", size: 30, required: true },
    { key: "approvedBy", type: "string", size: 36 },
    { key: "approvedAt", type: "string", size: 30 },
    { key: "rejectionReason", type: "string", size: 65535 },
    { key: "metadata", type: "string", size: 65535 },
  ], [
    { key: "idx_event", type: "key", columns: ["eventId"] },
    { key: "idx_event_user", type: "unique", columns: ["eventId", "userId"] },
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_registered", type: "key", columns: ["registeredAt"] },
  ]);

  await createTable("projects", "Projects", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535, required: true },
    { key: "image", type: "string", size: 500, required: true },
    { key: "category", type: "string", size: 100, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "progress", type: "integer", required: true },
    { key: "technologies", type: "string", size: 100, array: true },
    { key: "stars", type: "integer", required: true },
    { key: "forks", type: "integer", required: true },
    { key: "contributors", type: "integer", required: true },
    { key: "duration", type: "string", size: 100, required: true },
    { key: "isFeatured", type: "boolean", required: true },
    { key: "demoUrl", type: "string", size: 500, required: true },
    { key: "repoUrl", type: "string", size: 500, required: true },
    { key: "teamMembers", type: "string", size: 255, array: true },
    { key: "createdAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_category", type: "key", columns: ["category"] },
    { key: "idx_featured", type: "key", columns: ["isFeatured"] },
  ]);

  await createTable("profiles", "Profiles", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "avatar", type: "string", size: 500 },
    { key: "pronouns", type: "string", size: 30 },
    { key: "phone", type: "string", size: 20 },
    { key: "urn", type: "string", size: 50 },
    { key: "program", type: "string", size: 100 },
    { key: "branch", type: "string", size: 100 },
    { key: "year", type: "string", size: 20 },
    { key: "semester", type: "string", size: 20 },
    { key: "address", type: "string", size: 65535 },
    { key: "dateOfBirth", type: "string", size: 30 },
    { key: "gender", type: "string", size: 30 },
    { key: "githubUrl", type: "string", size: 500 },
    { key: "linkedinUrl", type: "string", size: 500 },
    { key: "portfolioUrl", type: "string", size: 500 },
    { key: "instagramUrl", type: "string", size: 500 },
    { key: "bio", type: "string", size: 65535 },
    { key: "skills", type: "string", size: 100, array: true },
    { key: "interests", type: "string", size: 100, array: true },
    { key: "experience", type: "string", size: 65535 },
    { key: "whyJoin", type: "string", size: 65535 },
    { key: "availability", type: "string", size: 30 },
    { key: "profileVisibility", type: "string", size: 30 },
    { key: "showOnAboutPage", type: "boolean" },
    // There is deliberately no `status` column. A profile owns existence, not
    // governance: membership status lives on the membership row, seniority on
    // designation assignments, and the `admin`/`dev` tier on `user_roles`. The
    // server derives status from those rows (`resolveMembershipStatus`) and
    // never from here, so a column here would only invite a second, writable
    // source of truth for authorization.
  ], [
    // One profile per account: the profile owns existence, never governance.
    // (There is deliberately no `status` column and no status index here;
    // membership status lives on the membership row.)
    { key: "idx_user", type: "unique", columns: ["userId"] },
    { key: "idx_urn", type: "key", columns: ["urn"] },
  ]);

  await createTable("applications", "Applications", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "profileId", type: "string", size: 36, required: true },
    { key: "oathAccepted", type: "boolean", required: true },
    { key: "termsAccepted", type: "boolean", required: true },
    { key: "constitutionAccepted", type: "boolean", required: true },
    { key: "preferredDepartments", type: "string", size: 100, array: true },
    { key: "reviewedBy", type: "string", size: 36 },
    { key: "reviewedAt", type: "string", size: 30 },
    { key: "rejectionReason", type: "string", size: 65535 },
    { key: "submittedAt", type: "string", size: 30, required: true },
  ], [
    // One application row per account: rejected applicants resubmit into the
    // same row (see /api/onboarding), so uniqueness is safe.
    { key: "idx_user", type: "unique", columns: ["userId"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_submitted", type: "key", columns: ["submittedAt"] },
  ]);

  await createTable("memberships", "Memberships", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "applicationId", type: "string", size: 36, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "membershipNumber", type: "string", size: 20, required: true },
    { key: "approvedBy", type: "string", size: 36, required: true },
    { key: "approvedAt", type: "string", size: 30, required: true },
    { key: "department", type: "string", size: 100 },
    { key: "joinedAt", type: "string", size: 30, required: true },
  ], [
    // One membership row per account: re-approval reactivates the same row.
    { key: "idx_user", type: "unique", columns: ["userId"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_joined", type: "key", columns: ["joinedAt"] },
    { key: "idx_member_number", type: "unique", columns: ["membershipNumber"] },
  ]);

  await createTable("departments", "Departments", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "slug", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "icon", type: "string", size: 100 },
    { key: "color", type: "string", size: 20 },
    { key: "parentId", type: "string", size: 36 },
    { key: "headId", type: "string", size: 36 },
    { key: "isActive", type: "boolean", required: true },
    { key: "displayOrder", type: "integer" },
    { key: "category", type: "string", size: 50, required: true },
  ], [
    { key: "idx_slug", type: "unique", columns: ["slug"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_order", type: "key", columns: ["displayOrder"] },
  ]);

  await createTable("user_departments", "User Departments", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "departmentId", type: "string", size: 36, required: true },
    { key: "role", type: "string", size: 50, required: true },
    { key: "assignedBy", type: "string", size: 36, required: true },
    { key: "assignedAt", type: "string", size: 30, required: true },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_dept", type: "key", columns: ["departmentId"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
  ]);

  await createTable("designations", "Designations", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "slug", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "level", type: "integer", required: true },
    { key: "category", type: "string", size: 50, required: true },
    { key: "departmentId", type: "string", size: 36 },
    { key: "badgeIcon", type: "string", size: 100 },
    { key: "badgeColor", type: "string", size: 20 },
    { key: "isActive", type: "boolean", required: true },
    { key: "maxHolders", type: "integer" },
    { key: "displayOrder", type: "integer" },
  ], [
    { key: "idx_slug", type: "unique", columns: ["slug"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_level", type: "key", columns: ["level"] },
    { key: "idx_order", type: "key", columns: ["displayOrder"] },
  ]);

  await createTable("user_designations", "User Designations", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "designationId", type: "string", size: 36, required: true },
    { key: "assignedBy", type: "string", size: 36, required: true },
    { key: "assignedAt", type: "string", size: 30, required: true },
    { key: "revokedAt", type: "string", size: 30 },
    { key: "revokedBy", type: "string", size: 36 },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_designation", type: "key", columns: ["designationId"] },
    { key: "idx_user_designation", type: "key", columns: ["userId", "designationId"] },
  ]);

  await createTable("powers", "Powers", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "displayName", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "category", type: "string", size: 50, required: true },
    { key: "scope", type: "string", size: 50, required: true },
  ], [
    // Power names are the grant vocabulary: duplicates would make id-vs-name
    // resolution ambiguous (see hasPower dual resolution).
    { key: "idx_name", type: "unique", columns: ["name"] },
    { key: "idx_category", type: "key", columns: ["category"] },
  ]);

  await createTable("user_powers", "User Powers", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "powerId", type: "string", size: 36, required: true },
    { key: "grantedBy", type: "string", size: 36, required: true },
    { key: "grantedAt", type: "string", size: 30, required: true },
    { key: "departmentId", type: "string", size: 36 },
    { key: "expiresAt", type: "string", size: 30 },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_power", type: "key", columns: ["powerId"] },
    { key: "idx_user_power", type: "key", columns: ["userId", "powerId"] },
  ]);

  // The only legitimate source of the `admin`/`dev` tier. Before this table
  // existed, the `admin` status was reachable only through a client-writable
  // `user.prefs.role` or an `ADMIN_EMAILS` environment allowlist, so there was
  // no server-representable administrator at all.
  await createTable("user_roles", "User Roles", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "role", type: "string", size: 20, required: true },
    { key: "grantedBy", type: "string", size: 36, required: true },
    { key: "grantedAt", type: "string", size: 30, required: true },
    { key: "reason", type: "string", size: 500 },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_role", type: "key", columns: ["role"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
  ]);

  await createTable("role_templates", "Role Templates", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "slug", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 2000 },
    { key: "capabilities", type: "string", size: 100, array: true, required: true },
    { key: "teamId", type: "string", size: 100 },
    { key: "teamRole", type: "string", size: 100 },
    { key: "label", type: "string", size: 100 },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_slug", type: "unique", columns: ["slug"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_name", type: "key", columns: ["name"] },
  ]);

  await createTable("role_assignments", "Role Assignments", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "roleId", type: "string", size: 36, required: true },
    { key: "assignedBy", type: "string", size: 36, required: true },
    { key: "assignedAt", type: "string", size: 30, required: true },
    { key: "expiresAt", type: "string", size: 30 },
    { key: "scopeType", type: "string", size: 30, required: true },
    { key: "scopeId", type: "string", size: 100 },
    { key: "isActive", type: "boolean", required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_role", type: "key", columns: ["roleId"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_expiry", type: "key", columns: ["expiresAt"] },
    { key: "idx_assigned", type: "key", columns: ["assignedAt"] },
  ]);

  await createTable("tickets", "Tickets", [
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "userId", type: "string", size: 36, required: true },
    { key: "registrationId", type: "string", size: 36, required: true },
    { key: "ticketCode", type: "string", size: 20, required: true },
    { key: "qrData", type: "string", size: 65535, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "issuedAt", type: "string", size: 30 },
    { key: "checkedInAt", type: "string", size: 30 },
    { key: "checkedInBy", type: "string", size: 36 },
    { key: "invalidatedAt", type: "string", size: 30 },
    { key: "invalidatedBy", type: "string", size: 36 },
    { key: "invalidatedReason", type: "string", size: 65535 },
    { key: "transferredTo", type: "string", size: 36 },
    { key: "transferHistory", type: "string", size: 65535 },
    { key: "entryCount", type: "integer", required: true },
    { key: "maxEntries", type: "integer", required: true },
    { key: "metadata", type: "string", size: 65535 },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_event", type: "key", columns: ["eventId"] },
    { key: "idx_ticket_code", type: "unique", columns: ["ticketCode"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_issued", type: "key", columns: ["issuedAt"] },
    { key: "idx_event_user", type: "key", columns: ["eventId", "userId"] },
    { key: "idx_registration", type: "key", columns: ["registrationId"] },
  ]);

  await createTable("ticket_verifications", "Ticket Verifications", [
    { key: "ticketId", type: "string", size: 36, required: true },
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "verifiedBy", type: "string", size: 36, required: true },
    { key: "method", type: "string", size: 50, required: true },
    { key: "result", type: "string", size: 50, required: true },
    { key: "verifiedAt", type: "string", size: 30, required: true },
    { key: "metadata", type: "string", size: 65535 },
  ], [
    { key: "idx_ticket", type: "key", columns: ["ticketId"] },
    { key: "idx_event", type: "key", columns: ["eventId"] },
    { key: "idx_verifier", type: "key", columns: ["verifiedBy"] },
  ]);

  await createTable("resources", "Resources", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "type", type: "string", size: 50, required: true },
    { key: "url", type: "string", size: 500 },
    { key: "fileId", type: "string", size: 36 },
    { key: "layer", type: "string", size: 50, required: true },
    { key: "departmentId", type: "string", size: 36 },
    { key: "designationId", type: "string", size: 36 },
    { key: "tags", type: "string", size: 100, array: true },
    { key: "uploadedBy", type: "string", size: 36, required: true },
    { key: "isActive", type: "boolean", required: true },
    { key: "displayOrder", type: "integer" },
    { key: "category", type: "string", size: 50, required: true },
    { key: "requiredRole", type: "string", size: 100 },
    { key: "uploadedByName", type: "string", size: 255, required: true },
    { key: "downloads", type: "integer", required: true },
  ], [
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_category", type: "key", columns: ["category"] },
    { key: "idx_dept", type: "key", columns: ["departmentId"] },
    { key: "idx_role", type: "key", columns: ["requiredRole"] },
  ]);

  await createTable("notifications", "Notifications", [
    { key: "userId", type: "string", size: 36, required: true },
    { key: "type", type: "string", size: 100, required: true },
    { key: "title", type: "string", size: 255, required: true },
    { key: "body", type: "string", size: 65535, required: true },
    { key: "letter", type: "string", size: 65535 },
    { key: "data", type: "string", size: 65535 },
    { key: "read", type: "boolean", required: true },
    { key: "readAt", type: "string", size: 30 },
    { key: "createdAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_read", type: "key", columns: ["read"] },
    { key: "idx_created", type: "key", columns: ["createdAt"] },
  ]);

  await createTable("audit_logs", "Audit Logs", [
    { key: "actorId", type: "string", size: 36, required: true },
    { key: "actorName", type: "string", size: 255, required: true },
    { key: "actorRole", type: "string", size: 50, required: true },
    { key: "action", type: "string", size: 100, required: true },
    { key: "entityType", type: "string", size: 50, required: true },
    { key: "entityId", type: "string", size: 36, required: true },
    { key: "details", type: "string", size: 65535 },
    { key: "ipAddress", type: "string", size: 45 },
    { key: "userAgent", type: "string", size: 65535 },
    { key: "timestamp", type: "string", size: 30, required: true },
  ], [
    { key: "idx_actor", type: "key", columns: ["actorId"] },
    { key: "idx_entity", type: "key", columns: ["entityType", "entityId"] },
    { key: "idx_action", type: "key", columns: ["action"] },
    { key: "idx_timestamp", type: "key", columns: ["timestamp"] },
  ]);

  await createTable("gallery", "Gallery", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "imageUrl", type: "string", size: 500, required: true },
    { key: "thumbnailUrl", type: "string", size: 500 },
    { key: "category", type: "string", size: 50, required: true },
    { key: "uploadedBy", type: "string", size: 36, required: true },
    { key: "eventId", type: "string", size: 36 },
    { key: "departmentId", type: "string", size: 36 },
    { key: "status", type: "string", size: 50, required: true },
    { key: "approvedBy", type: "string", size: 36 },
    { key: "approvedAt", type: "string", size: 30 },
    { key: "rejectionReason", type: "string", size: 65535 },
    { key: "tags", type: "string", size: 100, array: true },
    { key: "isActive", type: "boolean", required: true },
    { key: "displayOrder", type: "integer" },
  ], [
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_category", type: "key", columns: ["category"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_order", type: "key", columns: ["displayOrder"] },
    { key: "idx_uploader", type: "key", columns: ["uploadedBy"] },
  ]);

  await createTable("approval_workflows", "Approval Workflows", [
    { key: "entityType", type: "string", size: 50, required: true },
    { key: "entityId", type: "string", size: 36, required: true },
    { key: "currentStep", type: "integer", required: true },
    { key: "totalSteps", type: "integer", required: true },
    { key: "steps", type: "string", size: 65535, required: true },
    { key: "status", type: "string", size: 50, required: true },
    { key: "initiatedBy", type: "string", size: 36, required: true },
    { key: "initiatedAt", type: "string", size: 30, required: true },
    { key: "completedAt", type: "string", size: 30 },
  ], [
    { key: "idx_entity", type: "key", columns: ["entityType", "entityId"] },
    { key: "idx_status", type: "key", columns: ["status"] },
  ]);

  await createTable("authorized_activities", "Authorized Activities", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535, required: true },
    { key: "requestedBy", type: "string", size: 36, required: true },
    { key: "approvedBy", type: "string", size: 36 },
    { key: "target", type: "string", size: 500, required: true },
    { key: "scope", type: "string", size: 65535, required: true },
    { key: "techniques", type: "string", size: 255, array: true },
    { key: "dataBoundary", type: "string", size: 65535, required: true },
    { key: "purpose", type: "string", size: 2000, required: true },
    { key: "startsAt", type: "string", size: 30, required: true },
    { key: "endsAt", type: "string", size: 30, required: true },
    { key: "status", type: "string", size: 30, required: true },
    { key: "createdAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_requested", type: "key", columns: ["requestedBy"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_created", type: "key", columns: ["createdAt"] },
    { key: "idx_target", type: "key", columns: ["target"] },
  ]);

  await createTable("incident_reports", "Incident Reports", [
    { key: "reportedBy", type: "string", size: 36, required: true },
    { key: "title", type: "string", size: 255, required: true },
    { key: "description", type: "string", size: 65535, required: true },
    { key: "severity", type: "string", size: 30, required: true },
    { key: "affectedResource", type: "string", size: 500, required: true },
    { key: "status", type: "string", size: 30, required: true },
    { key: "assignedTo", type: "string", size: 36 },
    { key: "resolution", type: "string", size: 65535 },
    { key: "createdAt", type: "string", size: 30, required: true },
    { key: "updatedAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_reporter", type: "key", columns: ["reportedBy"] },
    { key: "idx_created", type: "key", columns: ["createdAt"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_severity", type: "key", columns: ["severity"] },
  ]);

  await createTable("governance_records", "Governance Records", [
    { key: "recordType", type: "string", size: 30, required: true },
    { key: "title", type: "string", size: 255, required: true },
    { key: "body", type: "string", size: 65535, required: true },
    { key: "meetingDate", type: "string", size: 30 },
    { key: "visibility", type: "string", size: 30, required: true },
    { key: "status", type: "string", size: 30, required: true },
    { key: "createdBy", type: "string", size: 36, required: true },
    { key: "createdAt", type: "string", size: 30, required: true },
    { key: "updatedAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_type", type: "key", columns: ["recordType"] },
    { key: "idx_visibility", type: "key", columns: ["visibility"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_updated", type: "key", columns: ["updatedAt"] },
    { key: "idx_date", type: "key", columns: ["meetingDate"] },
  ]);

  await createTable("office_assignments", "Office Assignments", [
    { key: "officeId", type: "string", size: 100, required: true },
    { key: "userId", type: "string", size: 36, required: true },
    { key: "appointedBy", type: "string", size: 36, required: true },
    { key: "selectionMethod", type: "string", size: 30, required: true },
    { key: "termStart", type: "string", size: 30, required: true },
    { key: "termEnd", type: "string", size: 30 },
    { key: "status", type: "string", size: 30, required: true },
    { key: "notes", type: "string", size: 2000 },
    { key: "createdAt", type: "string", size: 30, required: true },
  ], [
    { key: "idx_office", type: "key", columns: ["officeId"] },
    { key: "idx_user", type: "key", columns: ["userId"] },
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_term", type: "key", columns: ["termStart", "termEnd"] },
  ]);

  await createTable("event_types", "Event Types", [
    { key: "name", type: "string", size: 100, required: true },
    { key: "displayName", type: "string", size: 100, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "icon", type: "string", size: 100 },
    { key: "fields", type: "string", size: 65535, required: true },
    { key: "registrationConfig", type: "string", size: 65535, required: true },
    { key: "ticketConfig", type: "string", size: 65535, required: true },
    { key: "workflowConfig", type: "string", size: 65535, required: true },
    { key: "isActive", type: "boolean", required: true },
    { key: "displayOrder", type: "integer" },
  ], [
    // Type names are looked up by exact match (getByName): duplicates would
    // make event creation resolve to an arbitrary schema.
    { key: "idx_name", type: "unique", columns: ["name"] },
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_order", type: "key", columns: ["displayOrder"] },
  ]);

  await createTable("event_type_data", "Event Type Data", [
    { key: "eventId", type: "string", size: 36, required: true },
    { key: "eventTypeId", type: "string", size: 36, required: true },
    { key: "fieldData", type: "string", size: 65535, required: true },
  ], [
    // One payload row per event: /api/events/data upserts into the same row.
    { key: "idx_event", type: "unique", columns: ["eventId"] },
  ]);

  await createTable("blogs", "Blogs", [
    { key: "title", type: "string", size: 255, required: true },
    { key: "slug", type: "string", size: 255, required: true },
    { key: "excerpt", type: "string", size: 500, required: true },
    { key: "content", type: "string", size: 65535, required: true },
    { key: "coverImage", type: "string", size: 500, required: true },
    { key: "category", type: "string", size: 100, required: true },
    { key: "tags", type: "string", size: 100, array: true },
    { key: "authorId", type: "string", size: 36, required: true },
    { key: "authorName", type: "string", size: 255, required: true },
    { key: "authorEmail", type: "string", size: 255, required: true },
    { key: "authorAvatar", type: "string", size: 500 },
    { key: "status", type: "string", size: 50, required: true },
    { key: "rejectionReason", type: "string", size: 65535 },
    { key: "approvedBy", type: "string", size: 36 },
    { key: "approvedAt", type: "string", size: 30 },
    { key: "reviewedBy", type: "string", size: 36 },
    { key: "publishedBy", type: "string", size: 36 },
    { key: "publishedAt", type: "string", size: 30 },
    { key: "views", type: "integer", required: true },
    { key: "likes", type: "integer", required: true },
    { key: "featured", type: "boolean", required: true },
    { key: "readTime", type: "integer", required: true },
  ], [
    { key: "idx_status", type: "key", columns: ["status"] },
    { key: "idx_slug", type: "unique", columns: ["slug"] },
    { key: "idx_category", type: "key", columns: ["category"] },
    { key: "idx_author", type: "key", columns: ["authorId"] },
    { key: "idx_featured", type: "key", columns: ["featured"] },
    { key: "idx_published", type: "key", columns: ["publishedAt"] },
  ]);

  await createTable("sponsors", "Sponsors", [
    { key: "name", type: "string", size: 255, required: true },
    { key: "logo", type: "string", size: 500, required: true },
    { key: "website", type: "string", size: 500, required: true },
    { key: "tier", type: "string", size: 50, required: true },
    { key: "description", type: "string", size: 65535 },
    { key: "category", type: "string", size: 100 },
    { key: "isActive", type: "boolean", required: true },
    { key: "displayOrder", type: "integer", required: true },
    { key: "featured", type: "boolean", required: true },
    { key: "startDate", type: "string", size: 30, required: true },
    { key: "endDate", type: "string", size: 30 },
  ], [
    { key: "idx_active", type: "key", columns: ["isActive"] },
    { key: "idx_order", type: "key", columns: ["displayOrder"] },
    { key: "idx_featured", type: "key", columns: ["featured"] },
    { key: "idx_tier", type: "key", columns: ["tier"] },
  ]);

  // ===== BUCKETS =====
  console.log("\n\x1b[36m  Buckets:\x1b[0m");

  await createBucket("event-images", "Event Images", 10 * MB, ["jpg","jpeg","png","gif","webp"]);
  await createBucket("sponsor-logos", "Sponsor Logos", 5 * MB, ["jpg","jpeg","png","svg","webp"]);
  await createBucket("blog-images", "Blog Images", 10 * MB, ["jpg","jpeg","png","gif","webp"]);
  await createBucket("profile-pictures", "Profile Pictures", 5 * MB, ["jpg","jpeg","png","gif","webp"]);
  await createBucket("gallery-images", "Gallery Images", 10 * MB, ["jpg","jpeg","png","gif","webp"]);
  // Learning resources are gated content: the API already requires membership.
  await createBucket("resources", "Resources", 50 * MB, ["pdf","doc","docx","xls","xlsx","ppt","pptx","zip","rar","txt","csv","mp4","mp3"], "members");
  await createBucket("general", "General Storage", 50 * MB, ["jpg","jpeg","png","gif","webp","pdf","doc","docx"]);

  // ===== SUMMARY =====
  console.log("\n\x1b[35m============================================\x1b[0m");
  console.log("\x1b[35m  Setup Complete!\x1b[0m");
  console.log("\x1b[35m============================================\x1b[0m");
  console.log(`  \x1b[32mSuccess : ${ok}\x1b[0m`);
  console.log(`  \x1b[31mFailed  : ${fail}\x1b[0m`);
  console.log("");
  console.log("Next steps:");
  console.log(`  1. Set NEXT_PUBLIC_APPWRITE_DATABASE_ID=${DB_ID} in .env.local`);
  console.log("  2. Seed initial data with: npm run db:seed");
  console.log("");

  if (fail > 0) {
    process.exitCode = 1;
  }
})();
