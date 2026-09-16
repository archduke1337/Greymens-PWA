# Greymens — Access Model

This document describes how authorization actually works in this repository, and
what still has to change before the Appwrite tables can be locked down fully.

## 1. Layer overview

```
Appwrite Account session           (who you are)
        ↓
derived membership tier            (resolveMembershipStatus, lib/server-auth.ts)
  ← memberships.status             (member / restriction)
  ← applications.status            (applicant / approved)
  ← user_roles.role                (admin / dev — the only source of that tier)
  ← user_designations + designations.level  (lead / head)
user_departments / user_designations / user_powers   (scoped grants)
role_templates / role_assignments  (capability bundles, with scope + expiry)
office_assignments                 (constitutional office, with term)
        ↓
effective capabilities             (lib/access-control.ts)
        ↓
server API routes                  (lib/server-auth.ts + lib/access-control.ts guards)
        ↓
UI gating                          (context/PermissionContext.tsx, cosmetic only)
```

There is no `profiles.status` column, and no membership state is writable by the
account it describes. `account.updatePrefs()` lets a user write their own
`user.prefs`, so anything read from `prefs` — `role`, `status`, or otherwise — is
attacker-controlled input and must never reach an authorization decision. The
client's copy of the tier is a display convenience fetched from
`/api/permissions`; it proves nothing.

`context/PermissionContext.tsx` is **not** a security boundary. It exists to hide
controls the server already refuses. Every mutation must be re-checked server
side.

## 2. Membership tier

The tier is **derived**, never stored: `resolveMembershipStatus(userId)` in
`lib/server-auth.ts` computes it from the rows that actually own each fact.

The ladder is `no_account` → `account` → `applicant` → `member` → `core_member`
→ `lead` → `head` → `admin` → `dev`, plus the terminal states `banned` and
`deactivated` (and `suspended`).

Precedence is deliberate and load-bearing:

1. **A restriction wins absolutely.** `memberships.status` of `banned`,
   `suspended` or `deactivated` is returned before anything else is considered.
   This ordering is the security property, not a detail: when the role check ran
   first, banning an administrator left them fully privileged, so the ban only
   appeared to work.
2. **`user_roles` decides `admin` / `dev`.** That table is the only legitimate
   source of the tier. A row is keyed by user id, so an account holds exactly one
   role row — the resolver reads with `limit(1)` and no ordering, and multiple
   active rows would make the resolved tier whichever one Appwrite returned
   first.
3. **Everything else is derived**: an active membership or an approved
   application makes a member; a pending/reapplied/rejected application makes an
   applicant; designation level ≥ 6 is `head` and ≥ 5 is `lead`, on top of an
   active membership; an active `user_departments` row with role `core_member`
   or `lead` (and no qualifying designation) is `core_member`. `core_member`
   was previously unreachable — the resolver never returned it — and is now
   the only path that produces the status the dashboards and the client
   permission ladder already handled.

Tier grants coarse permissions (`lib/permissions.ts`). It is deliberately *not*
used as the only source of authority for office-level actions.

The first administrator cannot be created through the API — holding the
capability to write `user_roles` is the thing being granted. Use
`npm run grant-admin -- <email>`, which writes the role row and an audit entry
and needs the Appwrite API key. See §8.

## 3. Capabilities

`lib/access-control.ts` resolves capabilities from:

- role templates (`role_templates`) assigned through `role_assignments`
- legacy `powers` / `user_powers` grants, kept working during migration
- expiry (`expiresAt`) and scope (`global`, `department`, `team`, `project`)

An assignment with a scope only satisfies a scoped check. Unscoped checks accept
global assignments only — a department-scoped lead cannot act outside their
department.

Server routes use `requireCapability(capability, { scope })`. Notable rules:

- an author can never approve or publish their own blog post
- publishing is a separate capability from approving
- role template creation and role assignment write an audit record

## 4. Native Appwrite Teams and labels

Not used yet. The intended end state is a *projection*, never a source of truth:

- **Teams** for organizational grouping and Appwrite resource permissions
  (`Role.team(...)`), one team per directorate/department/project.
- **Labels** for broad gates only (`club-member`, `active-member`, `officer`,
  `faculty-coordinator`, `security-authorized`, `suspended`).

Term dates, elections, authorisations, and incident state stay in the database.
A server-side reconciler would add/remove memberships and labels when a term
ends, an authorisation expires, or a member is suspended.

## 5. Table permission classes

Defined in `scripts/setup-appwrite.js`:

| Class | Access | Members |
|---|---|---|
| `PUBLIC_READ_TABLES` | anyone may read | events, projects, departments, designations, powers, event_types, blogs, sponsors |
| `AUTHENTICATED_READ_TABLES` | any signed-in user may read | event_type_data, profiles, applications, memberships, user_departments, user_designations, user_powers, tickets, ticket_verifications, resources, approval_workflows |
| `SERVER_ONLY_TABLES` | server API key only | gallery, role_templates, role_assignments, user_roles, authorized_activities, incident_reports, governance_records, office_assignments, audit_logs, notifications |

**No table grants client write permission.** Every mutation is expected to go
through an authenticated API route.

An unclassified table fails closed and prints a warning during setup.

### 5.1 `AUTHENTICATED_READ_TABLES` is a known exposure, not a safe target

`Role.users()` grants **every signed-in account** read access to **every row**.
The tables listed above hold per-member data (profiles with phone, address and
URN; applications; memberships; tickets with their check-in tokens). Any account
created on the project can currently read all of it through the browser SDK.

That is why each of these tables is an explicit migration target rather than an
accepted end state, and why the setup script prints the warning inline.

### 5.2 Tables already moved to server-only

| Table | Endpoint | Notes |
|---|---|---|
| `audit_logs` | `/api/audit` | `GET` is admin-only. `POST` derives the actor from the session and ignores client-supplied identity, so an entry cannot be attributed to another account. Rate limited per account. |
| `notifications` | `/api/notifications` | Member `GET` is scoped to the session owner. `POST` (send to another account) is admin-only. `PATCH`/`DELETE` verify ownership and return 404 otherwise. |

Both endpoints exist because the previous browser-side writers could never have
worked: neither table grants client write permission, so every write failed. The
notifications writer also never set the required `createdAt` column.

## 6. Known gap: legacy browser-side data access

The remaining browser-SDK readers are `eventTypes` (event-type catalogue),
`blog` (published posts — world-readable by design) and `notifications`
(fetch-based client). The dead browser writers (`profiles`, `memberships`,
`applications`, `departments`, `designations`, `powers`, `gallery`, `sponsors`,
`resources`) were removed; those tables grant no client access and every live
screen reads or mutates them through `/api/*` routes. Until the tables in
§5.1 are migrated, the permission classes above cannot be applied to a live
project without breaking the affected screens.

This is why the setup script is intentionally explicit about classification: it
is the target contract, and the gap is visible rather than silent.

### Already migrated

| Area | Endpoint | Status |
|---|---|---|
| Profile read/write + avatar upload | `/api/profile` | Done. `PATCH` validates every editable field, rejects unknown fields, requires http(s) URLs, and caps array lengths and item sizes to the column limits. |
| Own tickets read | `/api/profile` (`GET`) | Done, returned alongside the profile. |
| Notifications | `/api/notifications` | Done. |
| Audit trail | `/api/audit` | Done. |
| Legacy powers page | `/api/powers` | Done. |
| Contact + feedback | `/api/send-email`, `/api/feedback` | Done. Both rate limited and validated; both really deliver through `lib/contact-mailer.ts`. |
| Client permission context | `/api/permissions` | Done. Replaced nine browser reads on every authenticated page load (including `departmentService.getAll()`, `designationService.getAll()` and `powerService.getAll()`), and made the server the authority on membership status. |
| Event registration / cancellation + own tickets | `/api/events/register` | Done. `POST`/`DELETE` already existed but were unused; the pages wrote registrations from the browser and kept the result in `localStorage`. |
| Gallery upload | `/api/gallery` | Done. Accepts a validated file or http(s) URL; moderation status is derived from verified authority, never from the request body. |
| Ticket lookup + check-in | `/api/tickets/verify` | Done. Email lookup now resolves through the Users API (there is no `profiles.email` column); check-in and invalidation write a `ticket_verifications` row. |
| Team directory | server component | Done. Rendered from `designations`/`user_designations`, and honours `profileVisibility`/`showOnAboutPage`. The unconsumed `/api/team` was removed. |
| Admin user console | `/api/admin/users` | Done. `GET` returns every account joined to its membership and its department/designation/power assignments in five queries (it was four hundred for a hundred accounts). `PATCH` handles profile edits, governance status, membership status and promotion, and audits each one. |
| Membership queue | `/api/admin/membership` | Done. `GET?status=` serves the pending, approved and rejected screens. `POST` approves or rejects: it validates the transition, creates or reactivates the membership with a collision-checked number, assigns the applicant's departments idempotently, notifies the applicant by name, and audits the decision. |
| Blog authoring and review | `/api/blogs`, `/api/blogs/image`, `/api/blogs/views` | Done. `GET?scope=mine\|review\|all` for the authoring screens, `PATCH` for approve/reject/feature (each requiring its own capability), `DELETE` with ownership rules, and a rate-limited public view counter. |
| Ticket scanner and door list | `/api/tickets/verify` | Done. QR, code, email and event lookups plus check-in and invalidation, gated on admin, an unexpired `ticket_verifier` grant, or event ownership. Every admission writes a `ticket_verifications` row and an audit entry. |

Supporting change: `profiles.status` is now settable from the console, and promotion writes both the governance status and an active membership. Previously `handlePromoteRole` set the membership to active and never stored the new role, so it reported success while changing nothing.

### Schema drift that broke the authorisation layer

The code read `profiles.status` in `getMembershipStatus`, `isAdminUser`, `/api/me`
and `/api/events/data`, but the provisioning script never declared that column.
Consequences, all of which were silent:

- `getMembershipStatus` returned `"account"` for every real member, so any
  server check keyed on membership was unreachable and the client (which derives
  status from memberships and applications) disagreed with the server.
- The `/admin` user status endpoint wrote to a non-existent column, so changing
  a user's status always failed.
- The admin bypass in `/api/events/data` could never be true.

Fixed by (a) declaring `status` on `profiles`, (b) deriving status from the rows
that actually own it — membership, application and designation level — and using
an explicit stored status only as a governance override, and (c) making
`scripts/setup-appwrite.js` reconcile columns and indexes on tables that already
exist, so schema changes reach an already-provisioned database instead of being
skipped as `EXISTS`.

`profiles` also has no name or email column. Names come from the account
(`getAccountNames`), and email lookups go through the Users API
(`findUserIdByEmail`); duplicating either into a queryable table would create a
second, stale copy of personal data.

### Remaining migration, in priority order

The remaining gap is larger than "mostly migrated": as provisioned, **no**
client-side write can succeed, because no table and no bucket grants client
write permission. Every un-migrated mutation listed below therefore fails at
runtime with a permission error rather than being merely unhardened. Migrating a
call site is what makes it work, not only what makes it safe.

Migrated so far (see the table above): profiles/tickets/notifications/audit,
permission context, event registration and tickets, gallery upload, blog
authoring and review, and the admin user and membership consoles.

What remains, in priority order:

1. **Writes first** — a client-side write is a privilege bypass.
   - `app/admin/events` + `app/admin/events/create` — create/publish events →
     `/api/admin/events` and `/api/events` cover part of this.
   - `app/admin/resources`, `app/admin/sponsors`, `app/admin/gallery` — uploads
     and destructive edits. (The public gallery upload path already goes through
     `/api/gallery`.)
   - `app/admin/departments`, `app/admin/designations`, `app/admin/powers` —
     assignment and catalogue edits.
   - `app/admin/projects`, `app/admin/notifications` — create/edit/delete.
2. **Reads second** — screens that still read `profiles`, `applications`,
   `memberships`, `departments`, `user_departments`, `user_powers` and
   `resources` directly:
   - `app/admin/departments`, `app/admin/designations`, `app/admin/powers`,
     `app/admin/gallery`, `app/admin/resources`, `app/admin/notifications`.
   - `components/dashboards/*` — the Admin/Head/Lead/Member dashboards read
     `applications`, `memberships`, `departments` and `resources`. The member
     dashboard's ticket read has already moved to `/api/events/register`.
   - `app/onboarding` still reads the department catalogue.
3. **Then** move the remaining `AUTHENTICATED_READ_TABLES` down to
   `SERVER_ONLY_TABLES` and delete the corresponding browser service methods in
   `lib/profiles.ts`, `lib/applications.ts`, `lib/memberships.ts`,
   `lib/departments.ts`, `lib/designations.ts`, `lib/powers.ts`,
   `lib/resources.ts`. (`lib/tickets.ts` has already been deleted.)
4. **Then** add the Appwrite Teams/labels projection and reconciliation job.

Note that the browser services in `lib/` are now mostly unreachable dead weight
for the migrated areas; they are kept only for the call sites still listed in
step 1 and 2, and should be removed once those migrate.

## 7. Server helpers

- `requireAuthenticatedUser(request)` — valid session or 401 response.
- `requireAdmin(request)` — session, then `isAdminUser`: the `ADMIN_EMAILS`
  allowlist, else a resolved tier of `admin` or `dev` from `user_roles`.
- `requireMember(request)` — session plus a member-or-above status; used by
  member-facing writes such as gallery uploads and the team directory.
- `resolveMembershipStatus(userId)` / `getMembershipStatus(user)` — the single
  derivation of governance status (restriction → explicit appointment →
  membership/application → designation level). The client consumes the same
  value from `/api/permissions` so the UI and the server cannot disagree.
- `hasPower(userId, powerId)` (in `lib/access-control.ts`) — legacy
  `user_powers` check for operational grants that the capability vocabulary does
  not yet cover.
- `findUserIdByEmail` / `getAccountNames` (in `lib/server-users.ts`) — account
  lookups through `node-appwrite`. Server-only: never import this from a client
  component.
- `isHttpUrl(value)` (in `lib/validation.ts`) — rejects `javascript:` and `data:`
  before a URL is stored and later rendered.
- `CAPABILITIES` / `Capability` / `isCapability` live in `lib/capabilities.ts`
  (dependency-free) so client components can read the vocabulary without
  importing the server-only `lib/access-control.ts`.
- `recordAudit({ request, actor, action, entityType, entityId, details })` (in
  `lib/server-audit.ts`) — writes a governance record with the actor taken from
  the verified session. It logs and swallows failures on purpose: the mutation
  it describes has already been applied by then, so failing the request would
  misreport the state of the database.
- `validateProfilePatch(body, { unknownFields })` and `validateGovernanceRole`
  (in `lib/profile-fields.ts`) — one set of profile rules shared by
  `/api/profile` and the admin console, so the two cannot drift apart.
  `unknownFields: "reject"` is for member self-service; the console uses
  `"ignore"` because it round-trips a whole document and drops immutable keys
  rather than writing them. `validateGovernanceRole` accepts only `admin` or
  `dev`; there is no writable membership-status enum, because membership status
  belongs to the membership row, seniority to designation assignments, and the
  governance tier to `user_roles`.
- `welcomeLetter` / `promotionLetter` / `designationLetter` (in `lib/letters.ts`)
  — pure formatters, kept dependency-free so server routes can render a letter
  without importing the browser-oriented `lib/notifications.ts`.
- `generateSlug` / `calculateReadTime` / `blogCategories` / `Blog` (in
  `lib/blog-format.ts`) — same reason: the authoring screens need the helpers
  without the browser SDK.
- `requireCapability(request, capability, scope)` (in `lib/access-control.ts`)
  — session plus resolved capability; used by governance, office, blog, and
  access routes.
- `consumeRateLimit(key, limit, windowMs)` (in `lib/rate-limit.ts`) — in-process
  limiter for unauthenticated and quota-spending endpoints. Note this is
  per-instance state: behind multiple serverless instances the effective limit is
  multiplied by the instance count, so it raises the cost of abuse rather than
  capping it precisely.
- `readString` / `readOptionalString` / `isEmailAddress` / `isRecord` (in
  `lib/validation.ts`) — bounded, type-checked reads of untrusted request input.
- `PUBLIC_FILE_PERMISSIONS` / `MEMBER_FILE_PERMISSIONS` (in `lib/storage.ts`) —
  buckets are provisioned with `fileSecurity: true`, so a file's own read
  permission decides who can open it. Uploads must pass one of these or the
  resulting URL is unreadable in the browser.

`ADMIN_EMAILS` remains as a break-glass override: it is checked before any
database lookup, so a misconfigured or unreachable database cannot lock every
administrator out of the console. It is an environment variable rather than a
data path — the durable source of the `admin`/`dev` tier is `user_roles`, and
`ADMIN_EMAILS` should hold as few addresses as possible.

## 8. Governance roles and the bootstrap path

`user_roles` is the most sensitive table in the database: a row there grants
`admin` or `dev`, which resolves to `ALL_PERMISSIONS`. It is created
`SERVER_ONLY` — no client read, no client write — and the only two ways to write
it are:

- `PATCH /api/admin/users` with `{ action: "set_governance_role", userId, role }`
  where `role` is `"admin"`, `"dev"`, or `null` to revoke. The actor comes from
  the verified session, self-revocation is refused (regaining the tier would then
  require project credentials), and every change writes an audit record.
- `npm run grant-admin -- <email> [--role dev] [--revoke] [--list]`, for the
  first administrator and for recovery. This is the only path that can create
  the tier from nothing, because it authenticates with the Appwrite API key
  instead of an application session.

**Designation levels stop at 9.** Level 10 used to map to `ALL_PERMISSIONS`,
and because designation management accepted any level from 1 to 10, "create a
level-10 designation and assign it" was a second, unaudited route to total
access that bypassed governance entirely. The wildcard now comes from exactly
one place — `resolvePermissions` returning early for a governance role — so any
level-10 row already in a database grants no more than level 9. The API caps the
field at 9 and the console's number input is bounded to match, but the server
check is the one that counts.

## 9. Request interception

Route protection is `proxy.ts`. Next.js 16 renamed the `middleware.ts`
convention to `proxy.ts` and the exported function from `middleware` to `proxy`;
the old names still work but are deprecated, and having both files would make it
ambiguous which one runs, so there is exactly one.

What is deliberately **not** there: authorization. `proxy.ts` reads only whether
a session cookie is present, which proves nothing — a forged or expired cookie
passes and is rejected later by the API routes. Treating it as the access-control
boundary is the mistake it exists to avoid.
