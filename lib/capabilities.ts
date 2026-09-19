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
  // The money-facing offices own the sponsor relationship end to end, so the
  // review verdict (sponsors.approve) sits with the record itself.
  treasurer: ["sponsors.manage", "sponsors.approve"],
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
  research_projects_director: [
    "projects.manage",
    "projects.approve",
    "blog.approve",
  ],
  communications_lead: ["notifications.send"],
  editorial_lead: ["blog.review", "blog.approve", "blog.publish"],
  marketing_lead: ["sponsors.manage", "sponsors.approve"],
  // Social runs the visual side of the club, so the gallery queue is theirs to
  // decide; the library belongs to documentation, same reasoning.
  social_media_lead: ["notifications.send", "gallery.approve"],
  documentation_lead: ["resources.manage", "resources.approve"],
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
    // Coordinators run the door list: reading it without being able to decide
    // it left them asking an admin to approve every walk-in.
    "registrations.manage",
    "tickets.view",
  ],
};

/**
 * The operational power catalogue — one list that both the seeder and the
 * authorizer read.
 *
 * The console offers a Roles tab (capabilities on a role template) and a
 * Powers tab (legacy `user_powers` grants). A power only means something if it
 * is (a) seeded so it can be granted and (b) mapped to capabilities so the
 * grant reaches a `requireCapability` check. Those were two lists before, and
 * they drifted: 14 of 16 seeded powers satisfied no check, and four conferred
 * nothing at all — an administrator ticked a box the server had never heard
 * of. Now the seed *is* the catalogue: scripts/seed-data.ts imports this, and
 * POWER_CAPABILITIES derives from it, so a power cannot be seeded without its
 * meaning nor mapped without a row to grant it.
 *
 * A power with an empty list is honest, not an oversight — and there are none
 * left: every catalogue entry below confers at least one enforced capability.
 * `gallery_uploader` was removed for exactly that reason: uploading is open to
 * every member, so there was no gate for the power to hold.
 */
export interface PowerDefinition {
  name: string;
  displayName: string;
  description: string;
  category: string;
  scope: "global" | "department";
  capabilities: Capability[];
}

export const POWER_CATALOGUE: PowerDefinition[] = [
  {
    name: "membership_approver",
    displayName: "Membership Approver",
    description:
      "Reads membership applications and decides them (approve or reject).",
    category: "membership",
    scope: "global",
    capabilities: [
      "membership.view_applications",
      "membership.approve",
      "membership.reject",
    ],
  },
  {
    name: "event_manager",
    displayName: "Event Manager",
    description:
      "Runs the whole event lifecycle: propose, edit, approve, publish, and manage registrations.",
    category: "events",
    scope: "global",
    capabilities: [
      "events.create",
      "events.update",
      "events.manage",
      "events.approve",
      "events.publish",
      "registrations.view",
      "registrations.manage",
    ],
  },
  {
    name: "event_proposer",
    displayName: "Event Proposer",
    description:
      "Submits event proposals for review without gaining the event console.",
    category: "events",
    scope: "global",
    capabilities: ["events.create"],
  },
  {
    name: "registration_manager",
    displayName: "Registration Manager",
    description:
      "Reads an event's registrations and approves or rejects them.",
    category: "events",
    scope: "department",
    capabilities: ["registrations.view", "registrations.manage"],
  },
  {
    name: "ticket_verifier",
    displayName: "Ticket Verifier",
    description: "Verifies and invalidates event tickets at the door.",
    category: "tickets",
    scope: "department",
    capabilities: ["tickets.view", "tickets.verify", "tickets.invalidate"],
  },
  {
    name: "blog_creator",
    displayName: "Blog Creator",
    description: "Writes and submits blog posts (review still applies).",
    category: "content",
    scope: "global",
    capabilities: ["blog.create"],
  },
  {
    name: "blog_reviewer",
    displayName: "Blog Reviewer",
    description: "Reviews and approves or sends back blog submissions.",
    category: "content",
    scope: "global",
    capabilities: ["blog.review", "blog.approve"],
  },
  {
    name: "content_publisher",
    displayName: "Content Publisher",
    description: "Publishes what review approved: posts and event listings.",
    category: "content",
    scope: "global",
    capabilities: ["blog.publish", "events.publish"],
  },
  {
    name: "newsletter_manager",
    displayName: "Newsletter Manager",
    description: "Sends club-wide notices and newsletter-style updates.",
    category: "content",
    scope: "global",
    capabilities: ["notifications.send", "blog.create"],
  },
  {
    name: "project_manager",
    displayName: "Project Manager",
    description: "Creates, edits, and removes portfolio projects.",
    category: "projects",
    scope: "department",
    capabilities: ["projects.manage"],
  },
  {
    name: "project_reviewer",
    displayName: "Project Reviewer",
    description:
      "Decides member project proposals without gaining edit or delete rights.",
    category: "projects",
    scope: "global",
    capabilities: ["projects.approve"],
  },
  {
    name: "gallery_manager",
    displayName: "Gallery Manager",
    description: "Curates the photo gallery: uploads, ordering, and deletion.",
    category: "gallery",
    scope: "global",
    capabilities: ["gallery.manage"],
  },
  {
    name: "gallery_reviewer",
    displayName: "Gallery Reviewer",
    description: "Decides member photo submissions without delete rights.",
    category: "gallery",
    scope: "global",
    capabilities: ["gallery.approve"],
  },
  {
    name: "design_manager",
    displayName: "Design Manager",
    description:
      "Curates visual assets in the gallery on behalf of the design team.",
    category: "gallery",
    scope: "global",
    capabilities: ["gallery.manage"],
  },
  {
    name: "resource_manager",
    displayName: "Resource Manager",
    description: "Adds, edits, and removes items in the resource library.",
    category: "resources",
    scope: "department",
    capabilities: ["resources.manage"],
  },
  {
    name: "resource_reviewer",
    displayName: "Resource Reviewer",
    description: "Decides member resource uploads without edit rights.",
    category: "resources",
    scope: "global",
    capabilities: ["resources.approve"],
  },
  {
    name: "sponsor_manager",
    displayName: "Sponsor Manager",
    description: "Maintains sponsor records and their tiers.",
    category: "sponsors",
    scope: "global",
    capabilities: ["sponsors.manage"],
  },
  {
    name: "sponsor_reviewer",
    displayName: "Sponsor Reviewer",
    description: "Decides member sponsor proposals before they reach the wall.",
    category: "sponsors",
    scope: "global",
    capabilities: ["sponsors.approve"],
  },
  {
    name: "department_head",
    displayName: "Department Head",
    description: "Reads the department directory for their area.",
    category: "admin",
    scope: "department",
    // No department-scoped capability exists yet, so this maps to the global
    // directory view rather than inventing a wider grant.
    capabilities: ["departments.view"],
  },
  {
    name: "operations_head",
    displayName: "Operations Head",
    description:
      "Runs departments, approves events, assigns titles, and reads registrations.",
    category: "admin",
    scope: "global",
    capabilities: [
      "departments.manage",
      "events.approve",
      "designations.assign",
      "registrations.view",
    ],
  },
  {
    name: "profile_moderator",
    displayName: "Profile Moderator",
    description: "Reads member profiles, corrects them, and keeps the audit trail.",
    category: "admin",
    scope: "global",
    capabilities: ["users.view", "users.update", "audit.view"],
  },
  {
    name: "notification_admin",
    displayName: "Notification Admin",
    description: "Sends targeted and club-wide notifications.",
    category: "admin",
    scope: "global",
    capabilities: ["notifications.send"],
  },
  {
    name: "security_officer",
    displayName: "Security Officer",
    description:
      "Authorizes security activity, runs incident response, and can contain an account.",
    category: "security",
    scope: "global",
    capabilities: [
      "security.authorize_activity",
      "security.manage_incidents",
      "security.contain",
    ],
  },
  {
    name: "social_media_manager",
    displayName: "Social Media Manager",
    description:
      "Runs the club's visual presence: curates the gallery and broadcasts.",
    category: "social",
    scope: "global",
    capabilities: ["gallery.manage", "notifications.send"],
  },
  {
    name: "pr_manager",
    displayName: "PR Manager",
    description:
      "Handles outreach: writes updates, broadcasts them, and maintains sponsor relations.",
    category: "content",
    scope: "global",
    capabilities: ["blog.create", "notifications.send", "sponsors.manage"],
  },
];

/**
 * Power name -> the capabilities it confers, derived from POWER_CATALOGUE so
 * the two cannot drift. Keys are the power names; the authorizer accepts a
 * `user_powers` row id or name and looks the grant up here.
 */
export const POWER_CAPABILITIES: Record<string, Capability[]> =
  Object.fromEntries(
    POWER_CATALOGUE.map((power) => [power.name, power.capabilities]),
  );

/**
 * Ready-made reviewer roles: the verdict half of a content queue with none of
 * the management half.
 *
 * The approve capabilities were split out of `*.manage` so a reviewer can be
 * scoped to decisions alone, but nothing granted them — an administrator had
 * to assemble the same single-capability role by hand, once per queue. These
 * are seeded as plain roles (no office) by scripts/seed-data.ts, so assigning
 * a reviewer is one pick in Access & Powers instead of four ticks and a slug.
 *
 * Events, blogs and membership already have office templates conferring their
 * review powers (president/VP, editorial lead, membership lead), so only the
 * four queues with no other grant path get a reviewer role.
 */
export const REVIEWER_ROLE_TEMPLATES: Array<{
  id: string;
  name: string;
  slug: string;
  description: string;
  capabilities: Capability[];
}> = [
  {
    id: "reviewer-projects",
    name: "Project Reviewer",
    slug: "project-reviewer",
    description:
      "Decides member project proposals (approve or send back). Cannot create, edit, or delete projects.",
    capabilities: ["projects.approve"],
  },
  {
    id: "reviewer-gallery",
    name: "Gallery Reviewer",
    slug: "gallery-reviewer",
    description:
      "Decides member gallery uploads (approve or send back). Cannot delete or reorder photos.",
    capabilities: ["gallery.approve"],
  },
  {
    id: "reviewer-resources",
    name: "Resource Reviewer",
    slug: "resource-reviewer",
    description:
      "Decides member resource uploads (approve or send back). Cannot add, edit, or remove library items.",
    capabilities: ["resources.approve"],
  },
  {
    id: "reviewer-sponsors",
    name: "Sponsor Reviewer",
    slug: "sponsor-reviewer",
    description:
      "Decides member sponsor proposals (approve or send back). Cannot create or edit sponsor records.",
    capabilities: ["sponsors.approve"],
  },
];

/**
 * The review queues that carry a count badge in the console sidebar.
 *
 * Shared by the sidebar (which queue hangs off which nav entry) and
 * /api/admin/queues (which capability opens which count), so the two cannot
 * drift: one entry is one queue, one href, one gate. `capabilities` lists who
 * can decide the queue — a badge counts work, and work only exists for
 * someone who can act on it.
 */
export const REVIEW_QUEUES: Array<{
  key: string;
  href: string;
  label: string;
  capabilities: Capability[];
}> = [
  {
    key: "membership",
    href: "/admin/membership",
    label: "Membership applications",
    capabilities: ["membership.approve", "membership.reject"],
  },
  {
    key: "events",
    href: "/admin/events",
    label: "Event proposals",
    capabilities: ["events.approve", "events.manage"],
  },
  {
    key: "blogs",
    href: "/admin/blog",
    label: "Blog posts",
    capabilities: ["blog.review", "blog.approve"],
  },
  {
    key: "resources",
    href: "/admin/resources",
    label: "Resource uploads",
    capabilities: ["resources.approve", "resources.manage"],
  },
  {
    key: "gallery",
    href: "/admin/gallery",
    label: "Gallery photos",
    capabilities: ["gallery.approve", "gallery.manage"],
  },
  {
    key: "projects",
    href: "/admin/projects",
    label: "Project proposals",
    capabilities: ["projects.approve", "projects.manage"],
  },
  {
    key: "sponsors",
    href: "/admin/sponsors",
    label: "Sponsor proposals",
    capabilities: ["sponsors.approve", "sponsors.manage"],
  },
];
