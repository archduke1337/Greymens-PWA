# Permissions — retired

> **There is no separate permission system.** Authority is **capabilities**,
> resolved server-side in `lib/access-control.ts` and enforced by
> `requireCapability` / `requireAnyCapability`. Read
> **[ACCESS_MODEL.md](./ACCESS_MODEL.md)** — that document is the model.
>
> The module this file used to describe (`lib/permissions.ts`) has been deleted,
> along with the type surface it fed (`Permission`, `PermissionCheck`, the
> `hasPermission`/`hasAnyPermission`/`hasAllPermissions` members of
> `PermissionContext`). Nothing imports it; nothing consults it.

## What it was

A second, browser-side authority model built on a vocabulary of its own —
`register_events`, `verify_tickets`, `approve_applications`,
`manage_department_team` — resolved from membership status, department roles,
designation levels and legacy power grants. It ran entirely on the client, so it
granted nothing and enforced nothing; it decided only which buttons rendered.

That was survivable while the server checked the same strings. It stopped being
survivable once the server moved to capabilities, because the two vocabularies
drifted and the client kept answering questions nobody had asked:

- `app/blog/write` asked `hasPermission("blog.create")` — a *capability* name
  handed to the legacy resolver, which does not contain it. Result: the writing
  surface was admin-only, even though `POST /api/blogs` accepts `blog.create`.
- `app/gallery` gated upload on `upload_gallery` and approval on
  `approve_gallery`, while the routes required membership and `gallery.manage`.
- The dashboards gated buttons on `draft_events` and `manage_department_team`,
  capabilities no route enforces.

Each of those was invisible in the console and wrong in both directions: hidden
from people who could act, shown to people who could not.

## Why deleting it was safe

The last server-side use of the legacy vocabulary was the power bridge
(`POWER_GRANTS`), which `POWER_CAPABILITIES` replaced: each of the sixteen seeded
powers now translates into capabilities the server actually checks.
`tests/auth-matrix.test.ts` asserts that every capability is either gated by a
route, reached through a per-action map, or read by a payload to choose a view —
so a name cannot be reintroduced into the client without an enforcement site
behind it.

## What to use instead

| Need | Use |
|---|---|
| Gate a control in the UI | `usePermissions().hasCapability("events.create")`, or `<PermissionGate capability="...">` |
| Gate a route | `requireCapability(request, "events.create", scope?)` |
| One action reachable by either of two grants | `requireAnyCapability(request, ["events.manage", "events.approve"])` |
| Display tier (dashboard persona, badges) | `status` from `/api/permissions` — a presentation convenience that proves nothing |

A client gate is never authorization. Every action is re-checked server-side;
hiding a button is a courtesy, not a control.
