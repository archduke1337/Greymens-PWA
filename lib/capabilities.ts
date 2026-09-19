/**
 * The capability vocabulary.
 *
 * This module is deliberately dependency-free so it can be imported from both
 * client components and server routes. `lib/access-control.ts` performs the
 * actual authorization checks and imports `next/server` and the admin Appwrite
 * client, so it must never be pulled into a client bundle — a client page that
 * needs to render a capability list imports from here instead.
 *
 * Governance alignment (GREYMEN's CLUB Charter):
 * - Executive Board: president, vp, gensec, treasurer, cto, cyber_lead, research_dir
 * - General Council: communications, editorial, marketing, social, docs, membership, community
 * - Technical: software_web, ai_ml_data, infra_systems, ctf
 * Capabilities below map 1:1 to Charter Article 52 authority matrix.
 *
 * An entry here is a promise that some route enforces it (or, for
 * `departments.view`, that a payload reads it to choose a view). A name that
 * nothing grants and nothing checks is not vocabulary, it is a trap: it shows
 * up in the capability picker, an administrator ticks it, and nothing happens.
 * `tests/auth-matrix.test.ts` fails the build when the two drift apart in
 * either direction, so deletions are cheap and silent dead names are not.
 */
export const CAPABILITIES = [
  "blog.create",
  "blog.review",
  "blog.approve",
  "blog.publish",
  "blog.feature",
  "access.assign_roles",
  "access.manage_role_templates",
  "governance.manage",
  "governance.manage_offices",
  "events.create",
  "events.update",
  "events.manage",
  "events.approve",
  "events.publish",
  "registrations.view",
  "registrations.manage",
  "tickets.view",
  "tickets.verify",
  "tickets.invalidate",
  "membership.view_applications",
  "membership.approve",
  "membership.reject",
  "users.view",
  "users.update",
  "departments.view",
  "departments.manage",
  "designations.assign",
  "powers.manage",
  "resources.manage",
  "gallery.manage",
  // Reviewing member submissions is its own authority everywhere content has
  // a review queue: a reviewer decides the queue without gaining the power to
  // edit or delete what is already published. `*.manage` keeps the editorial
  // work (create, rewrite, remove, publish-on-create).
  "resources.approve",
  "gallery.approve",
  "projects.manage",
  "projects.approve",
  "sponsors.manage",
  "sponsors.approve",
  "notifications.send",
  "audit.view",
  "security.authorize_activity",
  "security.manage_incidents",
  "security.contain",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: unknown): value is Capability {
  return (
    typeof value === "string" &&
    (CAPABILITIES as readonly string[]).includes(value)
  );
}

/**
 * Charter office -> capabilities. Single source for sidebar gating (presentation
 * only) and for seeding role_templates. Server still enforces via requireCapability.
 */
export const OFFICE_CAPABILITIES: Record<string, Capability[]> = {
  president: [
    "governance.manage",
    "events.approve",
    "membership.approve",
    "audit.view",
  ],
  vice_president: ["governance.manage", "events.approve"],
  // No governance.view_records: reading the constitutional record is not a
  // separate grant on its own screen — /admin/governance serves records of
  // `restricted` visibility to its readers, so a read-only capability there
  // would have to filter by visibility before it could be handed out.
  general_secretary: [
    "governance.manage",
    "membership.view_applications",
    "audit.view",
  ],
  treasurer: ["sponsors.manage"],
  cto: [
    "events.manage",
    "events.publish",
    "projects.manage",
    "resources.manage",
  ],
  cybersecurity_lead: [
    "security.authorize_activity",
    "security.manage_incidents",
    "security.contain",
    "tickets.verify",
  ],
  research_projects_director: ["projects.manage", "blog.approve"],
  communications_lead: ["notifications.send"],
  editorial_lead: ["blog.review", "blog.approve", "blog.publish"],
  marketing_lead: ["sponsors.manage"],
  social_media_lead: ["notifications.send"],
  documentation_lead: ["resources.manage"],
  membership_lead: [
    "membership.view_applications",
    "membership.approve",
    "membership.reject",
    "users.view",
  ],
  community_lead: ["events.create", "registrations.view"],
  software_web_lead: ["events.create", "events.update", "projects.manage"],
  ai_ml_data_lead: ["projects.manage", "resources.manage"],
  infrastructure_systems_lead: ["security.contain", "audit.view"],
  ctf_lead: ["events.create", "security.authorize_activity"],
  event_coordinator: [
    "events.create",
    "events.update",
    "registrations.view",
    "tickets.view",
  ],
};

/**
 * Operational power -> the capabilities it confers.
 *
 * The console has always offered both a Roles tab (capabilities on a role
 * template) and a Powers tab (legacy `user_powers` grants), but only two power
 * names were ever translated into capabilities — so 14 of the 16 seeded powers
 * looked authoritative in the UI and satisfied no `requireCapability` check.
 *
 * This table is the translation the Powers tab was missing: a power is now a
 * named bundle of capabilities, exactly like a role, and a grant made there
 * reaches the same server checks a role grant does.
 *
 * A power with an empty list is honest, not an oversight: the capability
 * vocabulary has no equivalent for it (`gallery_uploader` — uploading is
 * membership-open; `social_media_manager`, `pr_manager`, `design_manager` —
 * still legacy-only). Such a grant confers nothing today; the four are listed
 * here so the gap is visible instead of implied.
 *
 * Lives in this dependency-free module (not access-control) so the Powers
 * console can render what each power actually confers. A catalogue row whose
 * name is absent here confers nothing — the console warns about exactly that.
 */
export const POWER_CAPABILITIES: Record<string, Capability[]> = {
  membership_approver: [
    "membership.view_applications",
    "membership.approve",
    "membership.reject",
  ],
  event_manager: [
    "events.create",
    "events.update",
    "events.manage",
    "events.approve",
    "events.publish",
    "registrations.view",
    "registrations.manage",
  ],
  ticket_verifier: ["tickets.view", "tickets.verify", "tickets.invalidate"],
  blog_creator: ["blog.create"],
  blog_reviewer: ["blog.review", "blog.approve"],
  gallery_manager: ["gallery.manage"],
  gallery_uploader: [],
  resource_manager: ["resources.manage"],
  // No department-scoped capability exists yet, so these two map to the
  // global department views rather than inventing a wider grant.
  department_head: ["departments.view"],
  operations_head: [
    "departments.manage",
    "events.approve",
    "designations.assign",
    "registrations.view",
  ],
  profile_moderator: ["users.view", "users.update", "audit.view"],
  notification_admin: ["notifications.send"],
  newsletter_manager: ["notifications.send"],
  social_media_manager: [],
  pr_manager: [],
  design_manager: [],
};
