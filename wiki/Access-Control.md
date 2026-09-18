# Access Control

## Model

Capabilities are the vocabulary (`lib/capabilities.ts`). Roles and charter
offices are the same grant — a template bundling capabilities, plus (for an
office) a term — and legacy powers translate into capabilities through
`POWER_CAPABILITIES`. `admin` / `dev` resolve to the `*` wildcard. Resolutions
are fail-closed and expiry-aware (assignment `expiresAt`, office `termEnd`).

A designation is a title: it grants **nothing** unless capabilities are listed on
its catalogue row, in which case it is a grant like the others and subject to the
same no-grant-beyond-hold rule. Designation levels no longer derive a leadership
tier, so a badge cannot choose a dashboard — see `docs/ACCESS_MODEL.md` §3.2.

Entry points: `lib/capabilities.ts` (vocabulary) → `lib/governance.ts`
(offices + governed pages) → enforced by `lib/access-control.ts` → audited to
`audit_logs`. The client's only authority check is `hasCapability`, reading the
same vocabulary the routes enforce; the legacy resolver it used to share the
browser with has been deleted.

## Non-negotiables

1. **Restriction outranks everything.** Banned/suspended/deactivated accounts
   keep no capability, even with stale grant rows (`getEffectiveCapabilities`,
   `requireCapability`).
2. **Never trust the client.** Ownership is re-checked server-side
   (`getOwnedEvent`, `getOwnedNotification`); uniform 404s avoid existence
   oracles.
3. **Role templates only mint known vocabulary.** Unknown capability strings
   (including `*`) in a template are ignored.
4. **Unknown scopes fail closed.** Malformed `scopeType` never widens into a
   global grant.

## Admin tiers

- `user_roles` (one row per account) is the only source of `admin`/`dev`.
- `ADMIN_EMAILS` is break-glass only: it satisfies `isAdminUser` /
  `requireAdmin`, **not** capability routes. Bootstrap admins must run
  `grant-admin` to get a real role row (the admin console shows setup
  guidance until then).

## Gaps being closed

`AUTHENTICATED_READ_TABLES` (any signed-in account can read every row) is a
documented temporary concession; tables move to API-only reads as routes
land. See `docs/ACCESS_MODEL.md` §5–6.
