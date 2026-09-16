# Workflows

## Membership

`/` → `/register` → `/login?next=/onboarding` → `/onboarding` (5 steps,
prefilled once on reapply) → `POST /api/onboarding` (rate-limited, banned
accounts rejected) → application `pending` → `/admin/membership` approve /
reject (`membership.approve|reject`, state machine, idempotent) →
`memberships` row + `MM-YYYY-…` number + department assignment + notifications
(`membership_approved|rejected`, closed vocabulary).

Reject-after-approve deactivates the membership and department rows. Explicit
`user_powers` / `user_designations` grants are intentionally left intact and
must be reviewed manually on reject.

## Events & registration

Lead+ drafts (`POST /api/events`, forced `draft`) → admin lifecycle
(`approve → publish`) → public list (published only) → `POST
/api/events/register` (duplicate guard, audience gate, `exclusive → pending`,
full → `waitlisted`, signed ticket via shared issuance) → cancel promotes the
oldest waitlisted registration. Capacity/counter updates are read-modify-write
— the unique `registrations(eventId+userId)` index is the oversell backstop.

## Door verification

`GET /api/tickets/verify` (door authority: admin, unexpired
`ticket_verifier`, or event owner; uniform 404s) → `PATCH checkIn |
invalidate` (state machine `issued/active` only, event must be open,
`requestedEventId` enforced). `qr_scan` is recorded only with a verifiably
signed payload for that ticket+event; anything else is `manual_search`.

## Publishing

Blog: `blog.create` → `pending` → per-action review (`approve →
blog.approve`, `reject → blog.review`, `feature → blog.feature`). Authors
cannot approve/publish/feature their own posts on either the console or the
member route. Gallery: member uploads start `pending`; moderators publish
immediately. Resources: lead+ uploads; department files require department
membership to read.
