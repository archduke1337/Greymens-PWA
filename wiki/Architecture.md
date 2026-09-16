# Architecture

## Shape

Next.js 16 App Router + React 19 + HeroUI v3 + Tailwind 4, backed by
Appwrite tables. There is no separate backend process: **the 43 route
handlers under `app/api/` are the backend**.

```
Browser → proxy.ts (cookie pre-filter, never authorizes)
       → app/layout.tsx (Providers > Auth > Permission, Navbar/main/Footer)
       → client pages ("use client", useAuth + usePermissions)
       → fetch() → app/api/**/route.ts
       → lib/server-auth.ts (session + status) + lib/access-control.ts (capabilities)
       → createAdminClient() (API key — Appwrite ACLs are bypassed)
       → Appwrite tables
```

## Key rule

Route-handler checks are the **only** enforcement. `proxy.ts`, the sidebar,
and `PermissionGate` are presentation/UX conveniences and must never be
treated as access control. Every privileged API re-checks from the verified
session.

## Session bridge (read this before touching auth)

The browser SDK talks to Appwrite directly, but its `a_session_*` cookie
belongs to the API domain — it never reaches this app on cross-domain
deployments (or localhost under third-party-cookie blocking). Plain
`fetch()` calls to `/api/*` therefore arrived anonymous even right after a
successful login. The fix: `AuthContext` mirrors the SDK's session secret
into a first-party `gm_session` cookie (`syncSessionCookie` /
`clearSessionCookie` in `lib/appwrite.ts`), which `proxy.ts` and
`resolveSessionSecret` (`lib/server-auth.ts`) read. The value is verified
against Appwrite per request, never trusted blindly.

## Modules

- `lib/capabilities.ts` — the capability vocabulary (client-safe).
- `lib/access-control.ts` — server capability enforcement (server-only).
- `lib/permissions.ts` — legacy client permission resolution (pure, client-safe).
- `lib/governance.ts` — offices, charter metadata, governed pages (display).
- `lib/server-auth.ts` — session verification + status derivation.
- `lib/server/tickets.ts` — HMAC ticket signing + shared issuance.
- `lib/database.ts` — table-name map. `lib/api.ts` — response envelope.
- `context/AuthContext.tsx` + `context/PermissionContext.tsx` — client state.

## Conventions

- Writes use explicit field allowlists, never `...body`.
- Mutations derive the actor from the session and write an audit row.
- `DELETE` endpoints accept the id on the query string (body fallback kept
  for older clients) because proxies/CDNs may drop DELETE bodies.
- Statuses: `no_account → account → applicant → member → core_member → lead
  → head → admin/dev`, plus terminal `banned/suspended/deactivated`.
