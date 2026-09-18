# Decisions

Accepted architecture decisions. Newest first. Each entry records what was
decided, why, and what reopens it — so settled questions stay settled. When
this log and the code disagree, **the code wins** — please fix the log.

## ADR-003 — A title carries authority only when it lists capabilities

- **Status:** Accepted 2026-09-18
- **Context:** Removing `DESIGNATION_LEVEL_PERMISSIONS` (ADR-002) left two
  problems. First, a designation still chose a dashboard: `resolveMembershipStatus`
  lifted the tier from the designation level (5 → `lead`, 6 → `head`), so a badge
  held implicit authority that no console displayed. Second, deleting the level
  table would have left titles with no way to carry authority at all, which is
  the opposite failure — a genuine need for "this title also grants X" would have
  been answered by inventing another implicit rule.
- **Decision:** Two changes, in one direction.
  1. **Levels stop lifting the tier.** `resolveMembershipStatus` no longer reads
     `user_designations` or `designations` at all. A designation is descriptive
     seniority; it cannot select a dashboard, and any dashboard a title used to
     pick must now come from an office or a role.
  2. **Titles get an explicit capability list.** `designations.capabilities`
     (array, empty by default) is read by `getEffectiveCapabilities` and written
     only through `/api/admin/designations`, which rejects unknown capability
     strings rather than dropping them and enforces no-grant-beyond-hold. The
     Access console's People tab shows every title and the capabilities it
     carries.
- **Why:**
  - Authority becomes explicit at every one of the four sources — role, office,
    power, title — and all four are visible in the Access console.
  - The tier can no longer be moved by anything but a restriction, a governance
    role, membership/application, or department seniority, so "which dashboard do
    I get" is answerable from four known places.
  - Status resolution does two fewer queries per call, and `getEffectiveCapabilities`
    reads the designation catalogue only when the account actually holds a title.
- **Consequences:** An account whose only leadership signal was a badge now
  resolves to `member` and lands on the member dashboard. That is the intended
  trade: give it an office or a role and it gets both the dashboard and the
  authority. `designations` is in `PUBLIC_READ_TABLES` because the public team
  page renders titles, so capability lists on the catalogue are world-readable —
  that reveals the vocabulary, not the holders; move the table behind an API
  route if that ever changes. Revisit trigger: if titles need scoped or expiring
  authority, extend the catalogue row rather than re-deriving anything from
  `level`.

## ADR-002 — Roles and offices are one grant; designations are titles

- **Status:** Accepted 2026-09-18
- **Context:** Roles and charter offices were two implementations of the same
  thing — "give this account a bundle of capabilities" — with two tables, two
  consoles, two audit vocabularies, and two different answers to "what is this
  account allowed to do?". `scripts/seed-data.ts` wrote one `role_templates`
  row per office, so the duplication was literal. Worse, the editable copy did
  nothing: office capabilities were read from the compile-time
  `OFFICE_CAPABILITIES` map, so editing the President template changed nothing.
  The role route enforced no-grant-beyond-hold; the office route did not, so the
  same grant was checked through one door and unchecked through the other.
- **Decision:** A `role_templates` row carrying an `officeId` **is** the office,
  and office capabilities are read from it. `OFFICE_CAPABILITIES` is demoted to
  the seed default, used only until that row exists. `office_assignments` is kept
  as the *term* (holder, selection method, start/end), because a role assignment
  cannot express a single-holder invariant or a date-bounded term. Both are
  administered in `/admin/access` (People / Roles / Offices / Powers) and the
  office route now applies the same no-grant-beyond-hold rule as the role route.
  `/admin/positions` becomes titles only — a designation grants no capability, so
  it is not access administration.
- **Why:**
  - One source of truth for capability grants. Editing a template now changes
    what the office can do, with no code change and no redeploy.
  - The People tab can show every source of authority in one place; offices used
    to be invisible in the console where grants are inspected.
  - Collapsing `office_assignments` into `role_assignments` was rejected: it
    would have traded a real invariant (one active holder per office) for
    tidiness, and required a data migration that could revoke access if it went
    wrong.
- **Consequences:** `scripts/setup-appwrite.js` adds `role_templates.officeId`
  (re-running setup adds the column to an existing table); `scripts/seed-data.ts`
  sets it. `hasPower` is gone — gallery moderation and door authority now ask for
  `gallery.manage` / `tickets.verify`, so a cybersecurity officer can actually
  work the door. `DESIGNATION_LEVEL_PERMISSIONS` is deleted; the tier lift that
  replaced it was then removed too — see ADR-003.
  Revisit trigger: if office terms ever need scope-based checks
  (`scopeType`/`scopeId`), fold them into the role assignment rather than
  re-growing a second grant table.

## ADR-001 — Appwrite labels stay a projection, never the RBAC source

- **Status:** Accepted 2026-09-17
- **Context:** Proposal to replace power management, access management, and
  positions (offices + designations) management with Appwrite user labels.
- **Decision:** The tables + capability engine remain the sole source of
  truth (`lib/capabilities.ts` vocabulary, enforced by
  `lib/access-control.ts`, managed through the admin consoles). Labels are
  permitted only as a derived, broad-gate projection as already specified in
  `docs/ACCESS_MODEL.md` §4 — never as an input to authorization, and console
  label editing is not an admin path.
- **Why:**
  - Labels are bare strings: no terms, no expiry, no scopes, no
    single-holder/`maxHolders` enforcement, no provenance.
  - No audit trail: no actor/timestamp/reason per grant (cf. `recordAudit` on
    every table-backed grant/revoke).
  - No guardrails: typos fail closed while the admin believes access was
    granted; duplicates and over-grants are unpreventable.
  - Replace-not-append writes (`users.updateLabels` overwrites the whole
    array) clobber concurrent edits; holder listing has no efficient query.
  - Writing labels needs `users.write` on `APPWRITE_API_KEY`, expanding the
    most powerful key from row access to identity rewriting (today it carries
    only `users.read + tables.*` and the server never writes user objects).
- **Consequences:** Nothing to build. Revisit trigger: the first
  direct-client-access requirement (Realtime-gated reads, label-gated
  buckets/storage) — at which point add the one-way reconciler and the broad
  vocabulary (`club-member`, `active-member`, `officer`, …), output-only.
- **Note:** `docs/ACCESS_MODEL.md` §6's migration roadmap looks stale against
  the current tree (steps it lists as pending appear done). Its currency was
  not audited for this decision.
