# Access Control

## Model

Capabilities are the vocabulary (`lib/capabilities.ts`); offices, roles,
powers, departments, and designations are how accounts earn them. `admin` /
`dev` resolve to the `*` wildcard. Everything else resolves via powers,
department roles, and designation levels — fail-closed and expiry-aware.

Entry points: `lib/capabilities.ts` (vocabulary) → `lib/governance.ts`
(offices + governed pages) → enforced by `lib/access-control.ts` +
`lib/permissions.ts` → audited to `audit_logs`.

## Non-negotiables

1. **Restriction outranks everything.** Banned/suspended/deactivated accounts
   keep no capability and no power, even with stale grant rows
   (`getEffectiveCapabilities`, `hasPower`, `requireCapability`).
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
