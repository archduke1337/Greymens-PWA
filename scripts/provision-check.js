#!/usr/bin/env node
// Static provision-declaration check (no credentials needed).
// Verifies setup-appwrite.js declares: unique table IDs, unique index keys
// per table, required tables, required unique constraints, index-vs-column
// consistency (every indexed column must exist), and the gallery privacy rule.
// Run in CI: `node scripts/provision-check.js`.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "setup-appwrite.js"), "utf-8");
// Indexes arg is optional (some tables may pass columns only).
const tableRe = /await createTable\("([^"]+)", "([^"]+)", \[([\s\S]*?)\](?:, \[([\s\S]*?)\])?\);/g;

const tables = new Map();
let m;
let failures = 0;
const fail = (message) => {
  console.error(message);
  failures += 1;
};
while ((m = tableRe.exec(src))) {
  const [, id, name, cols, idx = ""] = m;
  if (tables.has(id)) {
    fail(`DUPLICATE table id: ${id}`);
  }
  tables.set(id, { name, cols, idx });
  const keys = [...idx.matchAll(/key:\s*"([^"]+)"/g)].map((x) => x[1]);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) {
    fail(`DUPLICATE index keys in ${id}: ${dupes.join(", ")}`);
  }
  // Every indexed column must be declared on the same table. This is the check
  // that would have caught profiles.idx_status (index on a missing column).
  const columns = new Set(
    [...cols.matchAll(/key:\s*"([^"]+)"/g)].map((x) => x[1]),
  );
  for (const indexBlock of idx.matchAll(
    /\{\s*key:\s*"([^"]+)"[^}]*columns:\s*\[([^\]]*)\]/g,
  )) {
    const [, indexKey, columnList] = indexBlock;
    for (const col of columnList.matchAll(/"([^"]+)"/g)) {
      if (!columns.has(col[1])) {
        fail(`INDEX ON MISSING COLUMN: ${id}.${indexKey} -> "${col[1]}"`);
      }
    }
  }
}

const REQUIRED_TABLES = [
  "events",
  "registrations",
  "projects",
  "profiles",
  "applications",
  "memberships",
  "departments",
  "user_departments",
  "designations",
  "user_designations",
  "powers",
  "user_powers",
  "user_roles",
  "role_templates",
  "role_assignments",
  "tickets",
  "ticket_verifications",
  "resources",
  "notifications",
  "audit_logs",
  "gallery",
  "approval_workflows",
  "authorized_activities",
  "incident_reports",
  "governance_records",
  "office_assignments",
  "event_types",
  "event_type_data",
  "blogs",
  "sponsors",
];
for (const required of REQUIRED_TABLES) {
  if (!tables.has(required)) {
    fail(`MISSING required table: ${required}`);
  }
}

// Uniqueness constraints the application logic depends on (single-row-per-user
// tables, slug/name vocabularies, anti-double-registration).
const must = [
  ["profiles", "idx_user", "unique"],
  ["applications", "idx_user", "unique"],
  ["memberships", "idx_user", "unique"],
  ["memberships", "idx_member_number", "unique"],
  ["departments", "idx_slug", "unique"],
  ["designations", "idx_slug", "unique"],
  ["powers", "idx_name", "unique"],
  ["event_types", "idx_name", "unique"],
  ["event_type_data", "idx_event", "unique"],
  ["tickets", "idx_ticket_code", "unique"],
  ["registrations", "idx_event_user", "unique"],
  ["role_templates", "idx_slug", "unique"],
  ["blogs", "idx_slug", "unique"],
];
for (const [t, key, type] of must) {
  const block = tables.get(t)?.idx ?? "";
  const typeRe = new RegExp(
    `\\{\\s*key:\\s*"${key}"\\s*,\\s*type:\\s*"${type}"`,
  );
  if (!typeRe.test(block)) {
    fail(`MISSING ${type} index ${key} on ${t}`);
  }
}

// Gallery must never be world-readable: pending/rejected submissions would leak
// (reads go through GET /api/gallery, which filters approved + active only).
if (/const PUBLIC_READ_TABLES = new Set\(\[([\s\S]*?)\]\);/.test(src)) {
  const publicBlock = src.match(
    /const PUBLIC_READ_TABLES = new Set\(\[([\s\S]*?)\]\);/,
  )[1];
  if (publicBlock.includes('"gallery"')) {
    fail("PRIVACY: gallery must not be in PUBLIC_READ_TABLES");
  }
} else {
  fail("PUBLIC_READ_TABLES declaration not found");
}

console.log(`Checked ${tables.size} tables. ${failures === 0 ? "OK" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
