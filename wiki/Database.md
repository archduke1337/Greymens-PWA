# Database

30 tables + storage buckets, provisioned by `scripts/setup-appwrite.js`.

## One-row-per-account tables (unique `userId`)

`profiles`, `applications`, `memberships` (plus unique `membershipNumber`).
Re-applications and re-approvals reuse the same row — never insert a second
one or the unique index will reject it.

## Vocabulary uniques

`departments.slug`, `designations.slug`, `powers.name`, `event_types.name`,
`role_templates.slug`, `blogs.slug`, `events.slug`, `tickets.ticketCode`,
`event_type_data.eventId`, `registrations(eventId+userId)`.

## Assignment tables keep history

`user_departments`, `user_designations`, `user_powers` use soft-deactivate,
not delete, so re-joins create new rows. Do **not** add composite uniques
there — they would break rejoin/re-grant flows.

## Privacy classes

- Public-read catalogues: events, projects, departments, designations,
  powers, event_types, blogs, sponsors.
- `gallery` is **server-only** (reads via `GET /api/gallery`, approved +
  active only) — table-level public read would leak pending submissions.
- Everything identity/governance is authenticated-read (migration target) or
  server-only.

## Migrations

`npm run db:setup` reconciles columns, indexes, and read permissions on
re-run. For destructive changes (column renames, type changes), write the
steps down first, back up, and apply via the console — the script only adds,
never alters or drops.
