# Decisions

Accepted architecture decisions. Newest first. Each entry records what was
decided, why, and what reopens it — so settled questions stay settled. When
this log and the code disagree, **the code wins** — please fix the log.

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
