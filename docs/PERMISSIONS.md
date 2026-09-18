# Greymens — Permission Resolution (legacy presentation layer)

> **This file no longer describes authorization.** Authority is **capabilities**,
> resolved server-side in `lib/access-control.ts` and enforced by
> `requireCapability`. Read **[ACCESS_MODEL.md](./ACCESS_MODEL.md)** for that.
>
> `lib/permissions.ts` survives for two narrow jobs:
> 1. the few client-side gates the capability vocabulary does not cover, and
> 2. the client's *display* tier (`/api/permissions`), which is a convenience
>    and proves nothing.
>
> No API route calls `hasPermission`. Every earlier draft of this document —
> including the "API Route Protection" example, `requirePermission`, and the
> designation-level permissions table — was never the shipped authority model.
> The sections below describe what the legacy resolver actually does today, and
> what it no longer does.

---

## 1. Status → base permissions (`STATUS_PERMISSIONS`)

Real, and client-only. Used for presentation; the server derives the same tier in
`resolveMembershipStatus` for its own coarse checks.

| Status | Base permission strings |
|--------|------------------------|
| `applicant` | `view_public_content`, `view_resources`, `view_roadmaps`, `view_members`, `submit_application`, `edit_own_application` |
| `member` | + `register_events`, `view_member_resources`, `manage_own_profile`, `view_all_members`, `request_department_assignment` |
| `core_member` | + `manage_department_resources`, `participate_in_department_events` |
| `lead` | + `view_department_stats` |
| `head` | + `approve_events_in_scope`, `manage_multiple_departments`, `view_operations_stats` |
| `admin` / `dev` | `ALL_PERMISSIONS` (wildcard) |
| `banned` / `suspended` / `deactivated` | none — a restriction outranks everything |

## 2. Powers → capabilities, and the legacy strings

A `user_powers` grant is an **authority** grant. It reaches the server through
`POWER_CAPABILITIES` in `lib/access-control.ts` (e.g. `event_manager` →
`events.create`, `events.update`, `events.manage`, `events.approve`,
`events.publish`, `registrations.view`, `registrations.manage`).

The old `POWER_GRANTS` map in `lib/permissions.ts` translates the same grants into
the **legacy** permission strings (`create_events`, `publish_events`, …). Those
strings are consulted only by legacy client gates; no server route reads them.
Four powers currently translate to nothing on the server — `gallery_uploader`
(uploading is membership-open), `social_media_manager`, `pr_manager`,
`design_manager` — because the capability vocabulary has no equivalent. They are
listed in `POWER_CAPABILITIES` with empty arrays so the gap is visible.

## 3. Designations: the level grants nothing, the capability list does

`DESIGNATION_LEVEL_PERMISSIONS` has been deleted. It used to hand real
permissions to a badge by level (`5 → approve_events_in_scope`,
`6 → manage_multiple_departments`, `7-9 → manage_organization`,
`10 → ALL_PERMISSIONS`) — authority no console displayed, and at level 6 the very
permission that gated power granting.

A title's authority is now the explicit `capabilities` list on its catalogue row,
read by `getEffectiveCapabilities` and written only through
`/api/admin/designations`. Empty is the default and means an honour with no
authority; anything listed obeys the same no-grant-beyond-hold rule as roles and
offices. See ACCESS_MODEL.md §3.2.

`level` is descriptive seniority. It no longer raises the membership tier: the
5 → `lead`, 6 → `head` lift was removed from `resolveMembershipStatus`, so a
badge cannot choose a dashboard.

## 4. Department roles (`DEPARTMENT_ROLE_PERMISSIONS`)

Real, client-only, and **scoped** — `lib/permissions.ts` emits these as
`<capability>:department:<id>` and `hasPermission` refuses a scoped capability
asked without a scope.

| Department role | Scoped permission strings |
|---|---|
| `member` | — |
| `core_member` | `manage_department_resources` |
| `lead`, `head` | `manage_department_team`, `draft_events` |

`manage_department_team` and `draft_events` are listed in
`SCOPED_CAPABILITIES`; they have **no capability equivalent**, so no server route
enforces them. The two client gates that asked for them (`LeadDashboard`'s "New
Event" and "Manage Team" buttons) now ask for `events.create` and
`departments.manage` instead, because those are what the server actually checks —
a button gated on a permission the server ignores disagrees with the server in
both directions.

## 5. Where the real answers live

| Question | File |
|---|---|
| What capabilities exist? | `lib/capabilities.ts` (`CAPABILITIES`, `OFFICE_CAPABILITIES`) |
| Who has which capability, and how? | `lib/access-control.ts` (`getEffectiveCapabilities`, `requireCapability`, `POWER_CAPABILITIES`, `officeCapabilities`) |
| What does the model mean? | `docs/ACCESS_MODEL.md` |
| What do the tables look like? | `scripts/setup-appwrite.js` |

## 6. Superseded design sketch

The original planning tables in this file — "Scoped Powers" with a
`blog_reviewer → approve_blogs` column, "Who Can Grant What" (`canGrantPower`),
the department/cross-department matrix, and the implementation checklist naming
`requirePermission` and `lib/hooks/usePermissions.ts` — describe a design that was
largely not built. `canGrantPower` still exists and is still tested, but the
server grants powers through `requireCapability("powers.manage")` plus the
no-grant-beyond-hold rule; the map is not the authority.
