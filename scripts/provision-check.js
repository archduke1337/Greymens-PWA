#!/usr/bin/env node
// Static provision-declaration check (no credentials needed).
// Verifies setup-appwrite.js declares: unique table IDs, unique index keys
// per table, and required audit/governance tables. Run in CI.
const fs = require("fs");
const path = require("path");

const src = fs.readFileSync(path.join(__dirname, "setup-appwrite.js"), "utf-8");
// Indexes arg is optional (e.g. ticket_verifications passes columns only).
const tableRe = /await createTable\("([^"]+)", "([^"]+)", \[([\s\S]*?)\](?:, \[([\s\S]*?)\])?\);/g;

const tables = new Map();
let m;
let failures = 0;
while ((m = tableRe.exec(src))) {
  const [, id, name, cols, idx = ""] = m;
  if (tables.has(id)) {
    console.error(`DUPLICATE table id: ${id}`);
    failures += 1;
  }
  tables.set(id, { name, cols, idx });
  const keys = [...idx.matchAll(/key:\s*"([^"]+)"/g)].map((x) => x[1]);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) {
    console.error(`DUPLICATE index keys in ${id}: ${dupes.join(", ")}`);
    failures += 1;
  }
}

for (const required of ["role_templates", "role_assignments", "office_assignments", "user_roles", "audit_logs", "tickets", "registrations", "memberships"]) {
  if (!tables.has(required)) {
    console.error(`MISSING required table: ${required}`);
    failures += 1;
  }
}

// tickets must keep unique ticketCode; memberships unique membershipNumber; registrations unique event+user
const must = [
  ["tickets", "idx_ticket_code", "unique"],
  ["memberships", "idx_member_number", "unique"],
  ["registrations", "idx_event_user", "unique"],
];
for (const [t, key, type] of must) {
  const block = tables.get(t)?.idx ?? "";
  if (!block.includes(`"${key}"`) || !block.includes(`"${type}"`)) {
    console.error(`MISSING ${type} index ${key} on ${t}`);
    failures += 1;
  }
}

console.log(`Checked ${tables.size} tables. ${failures === 0 ? "OK" : `${failures} FAILURE(S)`}`);
process.exit(failures === 0 ? 0 : 1);
