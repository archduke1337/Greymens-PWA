# Greymens Club PWA — Wiki Home

Welcome to the Greymens Club application wiki. Start here.

## Map

| Page | What it answers |
|---|---|
| [[Setup]] | How do I get a working local environment + provisioned database? |
| [[Architecture]] | How is the system put together? Where does what live? |
| [[Access-Control]] | Who can do what? How are bans, roles, and capabilities enforced? |
| [[Database]] | What tables exist, what do the setup/seed scripts do, and how do I migrate? |
| [[Workflows]] | What are the membership, event, ticket, and publishing flows end to end? |
| [[Operations]] | How do builds, deploys, and day-2 tasks (grant-admin, audits) work? |
| [[Decisions]] | What did we decide and why? Accepted ADRs. |

## Source of truth

- Application code: `app/`, `lib/`, `components/`, `context/`
- Deep design docs: `docs/` (`ACCESS_MODEL.md`, `AUTH_FLOW.md`, `DATABASE_SCHEMA.md`, `PRODUCT_SPEC.md`, …)
- Provisioning: `scripts/setup-appwrite.js` (+ `scripts/provision-check.js`)
- This wiki summarises; when wiki and code disagree, **the code wins** —
  please fix the wiki.

## Licence

Proprietary — © 2026 Greymens Club. All rights reserved. Not open source.
See `LICENSE` in the repository root.
