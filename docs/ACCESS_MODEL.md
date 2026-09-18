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
user_powers                        (legacy operational grants)
role_templates / role_assignments  (capability bundles, with scope + expiry)
  ← a template with an `officeId` IS a charter office
office_assignments                 (the term half of an office grant)
designations / user_designations   (a title, plus any capabilities listed on it)
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

A designation level does **not** affect the tier. It used to (5 → `lead`,
6 → `head`), which let a badge choose a dashboard; that lift was removed. A
title's only route to authority is the explicit capability list on its catalogue
row (§3.2).

The first administrator cannot be created through the API — holding the
capability to write `user_roles` is the thing being granted. Use
`npm run grant-admin -- <email>`, which writes the role row and an audit entry
and needs the Appwrite API key. See §8.

## 3. Capabilities

`lib/access-control.ts` resolves capabilities from:

- role templates (`role_templates`) assigned through `role_assignments`
- charter offices (`office_assignments` + the template it points at) — see §3.1
- designations, for the capabilities listed on the catalogue row — see §3.2
- legacy `powers` / `user_powers` grants, translated through `POWER_CAPABILITIES`
- expiry (`expiresAt`, `termEnd`) and scope (`global`, `department`, `team`, `project`)

An assignment with a scope only satisfies a scoped check. Unscoped checks accept
global assignments only — a department-scoped lead cannot act outside their
department. An inactive template grants nothing, and neither does one with a past
term end: time alone revokes an office, no human needed.

Server routes use `requireCapability(capability, { scope })`. Notable rules:

- an author can never approve or publish their own blog post
- publishing is a separate capability from approving
- role template creation and role assignment write an audit record
- **no grant beyond hold**: `unheldCapabilities()` refuses to write a grant
  carrying a capability the actor does not hold (admins hold `"*"` and bypass).
  This applies to role templates, role assignments **and** office assignments —
  the office route used to skip it, so the same grant was checked through one
  door and unchecked through the other.

### 3.1 Roles and offices are one thing

They are the same grant — a bundle of capabilities given to an account — and
this repository used to implement them twice, under two names:

| | Role | Office (before) |
|---|---|---|
| Capabilities come from | `role_templates.capabilities` (editable) | `OFFICE_CAPABILITIES` in `lib/capabilities.ts` (compile-time) |
| Assignment row | `role_assignments` + scope + `expiresAt` | `office_assignments` + `termStart`/`termEnd` + `selectionMethod` |
| Console | `/admin/access` (Roles tab) | `/admin/positions` (Offices tab) |
| Audit action | `access.role_assigned` | `office.assign` |
| No-grant-beyond-hold | enforced | **not enforced** |

The seed made the duplication literal: `scripts/seed-data.ts` wrote one
`role_templates` row per office, id `office-<id>`, with
`capabilities = OFFICE_CAPABILITIES[id]`. So the same authority existed twice,
and the editable copy was the one that did *nothing* — editing the President
template did not change what the President could do, because the resolver read
the compile-time map.

They are now one:

- a template carrying an `officeId` **is** the office; office capabilities are
  read from it, and `OFFICE_CAPABILITIES` is only the seed default used until
  that row exists,
- `office_assignments` survives as the **term**: who holds it, how they were
  selected, when it started and ends. A role assignment cannot express a
  single-holder invariant or a date-bounded term, so collapsing the table would
  have traded a real invariant for tidiness,
- both are administered in `/admin/access` (People / Roles / Offices / Powers),
  and the People tab joins all three,
- `/admin/positions` is titles only, because a designation grants no capability
  and therefore is not access administration.

Office templates are deliberately **not** offered in the Roles tab's assign
picker: assigning one there would be a second, termless route to the same
authority.

### 3.2 A designation is an honour, unless it lists capabilities

`designations.capabilities` is the fourth grant source. It exists because the
previous mechanism for a title to carry authority was *implicit*: a level →
permissions table (`5: approve_events_in_scope`, `6: manage_multiple_departments`,
`7-9: manage_organization`, `10: ALL_PERMISSIONS`). That was deleted — it granted
rights no console displayed and the Charter does not describe, and at level 6 it
conferred the permission that gated power granting.

Now:

- a designation with an empty `capabilities` list grants nothing — the common
  case, and the default,
- a designation with a list is a real grant: same vocabulary, same authorizer and
  same **no-grant-beyond-hold** rule as roles and offices,
- the list is written only through `/api/admin/designations`, which rejects
  unknown capability strings rather than dropping them (a typo must not read as
  "granted"),
- the Access console's People tab shows every title a person holds, and the
  capabilities it carries, so a title-based grant is visible where grants are
  inspected,
- a title still confers no **tier** lift — level is now purely descriptive, and
  `resolveMembershipStatus` no longer reads the designation tables at all.

One consequence worth knowing: `designations` is in `PUBLIC_READ_TABLES`
because the public team page renders titles. The capability list is therefore
readable by anyone. It reveals the vocabulary, not who holds what — the
assignments live in `user_designations` — but if the catalogue capability lists
are ever considered sensitive, that table has to move behind an API route like
the admin consoles did.

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
   - `app/admin/departments`, `app/admin/designations` — assignment and
     catalogue edits. (Powers already writes through `/api/admin/powers`; its
     UI now lives in the Access console as `components/admin/PowersManager.tsx`.)
   - `app/admin/projects`, `app/admin/notifications` — create/edit/delete.
2. **Reads second** — screens that still read `profiles`, `applications`,
   `memberships`, `departments`, `user_departments`, `user_powers` and
   `resources` directly:
   - `app/admin/departments`, `app/admin/designations`, `app/admin/gallery`,
     `app/admin/resources`, `app/admin/notifications`. (Powers reads through
     `/api/admin/powers`.)
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
- `unheldCapabilities(actorId, caps)` (in `lib/access-control.ts`) — the
  no-grant-beyond-hold rule (§3), shared by the role and office routes.
- `officeCapabilities(officeId, templates)` / `getOfficeCapabilities(officeId)`
  (in `lib/access-control.ts`) — an office's capabilities, read from the
  template that carries its `officeId`; `OFFICE_CAPABILITIES` is only the seed
  default. The pure form takes an already-loaded template list so the resolver
  does not re-read the table per office.
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
  — session plus resolved capability. After the roles/offices merge there is no
  second guard: office, role, gallery (`gallery.manage`) and door
  (`tickets.verify`) checks all go through this one.
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

**Designation levels grant nothing, and lift nothing.** `level` is descriptive
seniority for display. `resolveMembershipStatus` used to read the designation
tables to lift the tier (5 → `lead`, 6 → `head`), which made a badge choose a
dashboard; those reads are gone, so a status resolution costs two fewer queries
and a title cannot affect routing. Authority a title carries is the explicit
`capabilities` list (§3.2).

Level 10 previously mapped to `ALL_PERMISSIONS`, which made "create a level-10
designation and assign it" a second, unaudited route to total access. The field
is still capped at 9 by the API and by the console's number input.

## 9. Request interception

Route protection is `proxy.ts`. Next.js 16 renamed the `middleware.ts`
convention to `proxy.ts` and the exported function from `middleware` to `proxy`;
the old names still work but are deprecated, and having both files would make it
ambiguous which one runs, so there is exactly one.

What is deliberately **not** there: authorization. `proxy.ts` reads only whether
a session cookie is present, which proves nothing — a forged or expired cookie
passes and is rejected later by the API routes. Treating it as the access-control
boundary is the mistake it exists to avoid.
