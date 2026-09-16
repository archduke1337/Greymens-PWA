# Setup

## Prerequisites

- Node.js ≥ 20.9
- An Appwrite project (Cloud or self-hosted) + an API key with
  `users.read` and `tables.*` scopes

## Steps

```bash
cp .env.example .env.local   # then fill every value
npm install --legacy-peer-deps
npm run db:setup             # create / reconcile tables, indexes, permissions
npm run db:seed              # idempotent catalogue upserts
npm run dev
```

## Environment

See `.env.example` for the full list. Rules:

- `NEXT_PUBLIC_*` is public. Everything else is server-only — never add the
  `NEXT_PUBLIC_` prefix to `APPWRITE_API_KEY`, `ADMIN_EMAILS`, or
  `TICKET_HMAC_SECRET`.
- `TICKET_HMAC_SECRET`: generate with `openssl rand -hex 32`. Ticket issuance
  **refuses to run** without it (fail-closed by design).
- `ADMIN_EMAILS`: break-glass bootstrap admins only. Real admins live in the
  `user_roles` table — create them with:

```bash
npx tsx scripts/grant-admin.ts -- <email> --role admin
```

## Database notes

- Default database id is `greymens_db` (`NEXT_PUBLIC_APPWRITE_DATABASE_ID`).
  Deployments provisioned before the Greymens rebrand may still use
  `mindmesh_db` — set the variable explicitly instead of renaming data.
- `db:setup` is safe to re-run: it adds missing columns/indexes and aligns
  read permissions. Unique-index upgrades print manual remediation steps when
  duplicate rows block them — dedupe, then re-run.
- `node scripts/provision-check.js` statically validates the provisioning
  declarations (tables, index↔column consistency, uniqueness, gallery
  privacy). Run it in CI.

## Verify

```bash
npm run type-check && npm run lint && npm test && npm run build
```
