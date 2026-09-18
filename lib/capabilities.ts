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
  "projects.manage",
  "sponsors.manage",
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
