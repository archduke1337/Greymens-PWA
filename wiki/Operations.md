# Operations

## Everyday commands

```bash
npm run dev | build | start
npm run type-check && npm run lint && npm test
node scripts/provision-check.js
npx tsx scripts/grant-admin.ts -- <email> --role admin|dev [--revoke] | --list
```

## Deploy (Vercel)

Build: `npm run build` · install: `npm install --legacy-peer-deps` ·
region: `iad1` (see `vercel.json`). Set every variable from `.env.example`
in the project environment — the build only needs the public Appwrite trio.

## Security headers

Declared once in `next.config.js` (CSP, HSTS, framing, referrer,
camera-only permissions policy) and applied to `/:path*`.

## Audit & review

- Admin actions land in `audit_logs` (actor derived from session).
- Review via `/admin/audit` (`audit.view`) or per-user from the users console.
- `details` payloads are size-capped per value so stored rows stay valid JSON.

## If something breaks

1. `/api/health` — environment + Appwrite reachability, minimal disclosure.
2. `/diagnostics`, `/connectivity-check` — client-side environment checks.
3. Logs: API routes log server-side; email-shaped values inside audit details
   are redacted centrally by the audit serializer, but raw `console.error`
   lines elsewhere can carry identifiers — never paste raw logs with PII
   into issues.
