# MindMesh Club PWA

Club membership + events + tickets PWA for GREYMEN's MindMesh club.
Next.js 16 / React 19 / Appwrite (client `appwrite`, server `node-appwrite`) / Tailwind 4 / Vitest.

## Setup

1. `cp .env.example .env` and fill values (see below).
2. `npm install --legacy-peer-deps`
3. `npm run db:setup` — create tables/indexes from `scripts/setup-appwrite.js`.
4. `npm run db:seed` — idempotent upserts (`scripts/seed-data.ts`).
5. `npm run dev`

## Env vars (`.env.example`)

| Var | Scope |
|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT/PROJECT_ID/DATABASE_ID/BUCKET_ID` | public |
| `APPWRITE_API_KEY` | server only (users.read + tables.*) |
| `ADMIN_EMAILS` | server only |
| `TICKET_HMAC_SECRET` | server only, signs QR payloads (`openssl rand -hex 32`) |
| `EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY`, `CONTACT_INBOX_EMAIL` | server only |

## Scripts

- `dev` / `build` / `start` — Next.js
- `db:setup` — `node scripts/setup-appwrite.js`
- `db:seed` — `npx tsx scripts/seed-data.ts`
- `grant-admin -- <email> [--role admin|dev] [--revoke] | --list` — bootstrap `user_roles`
- `test` — `vitest run` · `type-check` — `tsc --noEmit` · `lint` — `eslint .`

## Branch note

Active work happens on the `Upgrade` worktree/branch; `master` stays deployable.
Open PRs against `Upgrade`, keep `app/` + API routes untouched unless the task says so.

## RBAC

Capabilities are the vocabulary, offices are the org chart: `admin`/`dev` resolve to
`*`, everything else resolves via powers, department roles and designation levels
(fail-closed, expiry-aware). Start at `lib/capabilities.ts` (vocabulary) and
`lib/governance.ts` (offices + governed pages), enforced by `lib/access-control.ts`
+ `lib/permissions.ts`, audited to `audit_logs`.

## PWA notes

Manifest + icons in `public/` (`manifest.json`, `icons/`, `offline.html`, `sw.js`).
QR ticket verify needs camera (`Permissions-Policy: camera=(self)` in `next.config.js`).
Remote images allowlisted: unsplash, `*.cloud.appwrite.io`, `ui-avatars.com`.
