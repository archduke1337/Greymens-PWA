/**
 * Governance source of truth — GREYMEN's CLUB Constitution & Governance Charter.
 * Offices, charter metadata, membership categories, principles, plus RBAC page mapping.
 */

import { OFFICE_CAPABILITIES, REVIEW_QUEUE_CAPABILITIES } from "./capabilities";

export interface GovernanceOffice {
  id: string;
  title: string;
  layer: "executive" | "general_council" | "technical" | "security";
  elected: boolean;
}

export const GOVERNANCE_OFFICES: GovernanceOffice[] = [
  { id: "president", title: "President", layer: "executive", elected: true },
  {
    id: "vice_president",
    title: "Vice President",
    layer: "executive",
    elected: true,
  },
  {
    id: "general_secretary",
    title: "General Secretary",
    layer: "executive",
    elected: true,
  },
  { id: "treasurer", title: "Treasurer", layer: "executive", elected: true },
  {
    id: "cto",
    title: "CTO / Technical Director",
    layer: "executive",
    elected: false,
  },
  {
    id: "cybersecurity_lead",
    title: "Cybersecurity Lead",
    layer: "executive",
    elected: false,
  },
  {
    id: "research_projects_director",
    title: "Research & Projects Director",
    layer: "executive",
    elected: false,
  },
  {
    id: "communications_lead",
    title: "Communications Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "editorial_lead",
    title: "Editorial Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "marketing_lead",
    title: "Marketing Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "social_media_lead",
    title: "Social Media Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "documentation_lead",
    title: "Documentation Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "membership_lead",
    title: "Membership Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "community_lead",
    title: "Community Lead",
    layer: "general_council",
    elected: false,
  },
  {
    id: "software_web_lead",
    title: "Software & Web Development Lead",
    layer: "technical",
    elected: false,
  },
  {
    id: "ai_ml_data_lead",
    title: "AI/ML & Data Lead",
    layer: "technical",
    elected: false,
  },
  {
    id: "infrastructure_systems_lead",
    title: "Infrastructure / Systems Lead",
    layer: "technical",
    elected: false,
  },
  {
    id: "ctf_lead",
    title: "CTF & Competitive Security Lead",
    layer: "security",
    elected: false,
  },
];

/** Display title for a constitution office id, or `null` when unknown. */
export function officeTitle(officeId?: string | null): string | null {
  if (!officeId) return null;

  return (
    GOVERNANCE_OFFICES.find((office) => office.id === officeId)?.title ?? null
  );
}

/**
 * The club's titled roles, seeded as `designations`.
 *
 * A designation is a title, not a term: the office templates above are the
 * Charter's seats, while these are the names a member actually wears on their
 * profile — and (since the designation row can carry capabilities) the same
 * title can hand out the authority that belongs with the job. Department
 * leads therefore mirror the office of the same charter role rather than
 * inventing a second, drifting grant: one list decides what "AI/ML Lead"
 * means everywhere.
 *
 * Levels are seniority for display and ordering (1–9, never a permission:
 * the old level→permission table was removed for that reason). Honour-only
 * titles (Faculty Coordinator, Alumni Mentor, Honorary Member) list no
 * capabilities on purpose — they are recognition, not authority.
 */
export interface DesignationDefinition {
  slug: string;
  name: string;
  description: string;
  level: number;
  category: "department" | "operations" | "executive" | "special";
  badgeIcon: string;
  badgeColor: string;
  capabilities?: string[];
  maxHolders?: number;
}

export const DESIGNATION_CATALOGUE: DesignationDefinition[] = [
  {
    slug: "president",
    name: "President",
    description: "Elected head of the club; chairs the Executive Board.",
    level: 9,
    category: "executive",
    badgeIcon: "Crown",
    badgeColor: "#eab308",
    capabilities: OFFICE_CAPABILITIES.president,
    maxHolders: 1,
  },
  {
    slug: "vice-president",
    name: "Vice President",
    description:
      "Deputy to the President; stands in whenever the chair is vacant.",
    level: 8,
    category: "executive",
    badgeIcon: "Medal",
    badgeColor: "#6366f1",
    capabilities: OFFICE_CAPABILITIES.vice_president,
    maxHolders: 1,
  },
  {
    slug: "general-secretary",
    name: "General Secretary",
    description:
      "Keeps the club's records, minutes, and official correspondence.",
    level: 8,
    category: "executive",
    badgeIcon: "ScrollText",
    badgeColor: "#14b8a6",
    capabilities: OFFICE_CAPABILITIES.general_secretary,
    maxHolders: 1,
  },
  {
    slug: "secretary",
    name: "Secretary",
    description: "Supports the General Secretary with day-to-day paperwork.",
    level: 6,
    category: "executive",
    badgeIcon: "FolderKanban",
    badgeColor: "#0ea5e9",
  },
  {
    slug: "treasurer",
    name: "Treasurer",
    description: "Owns the club's finances, budgets, and sponsor accounts.",
    level: 8,
    category: "executive",
    badgeIcon: "Wallet",
    badgeColor: "#eab308",
    capabilities: OFFICE_CAPABILITIES.treasurer,
    maxHolders: 1,
  },
  {
    slug: "cto",
    name: "CTO / Technical Director",
    description: "Leads the technical programme across departments.",
    level: 8,
    category: "executive",
    badgeIcon: "Hammer",
    badgeColor: "#f97316",
    capabilities: OFFICE_CAPABILITIES.cto,
    maxHolders: 1,
  },
  {
    slug: "cybersecurity-lead",
    name: "Cybersecurity Lead",
    description:
      "Leads security work: authorizations, incidents, and response.",
    level: 7,
    category: "department",
    badgeIcon: "Shield",
    badgeColor: "#ef4444",
    capabilities: OFFICE_CAPABILITIES.cybersecurity_lead,
  },
  {
    slug: "research-projects-director",
    name: "Research & Projects Director",
    description: "Directs the project portfolio and technical research.",
    level: 7,
    category: "department",
    badgeIcon: "Microscope",
    badgeColor: "#8b5cf6",
    capabilities: OFFICE_CAPABILITIES.research_projects_director,
    maxHolders: 1,
  },
  {
    slug: "communications-lead",
    name: "Communications Lead",
    description: "Runs club-wide announcements and external messaging.",
    level: 6,
    category: "department",
    badgeIcon: "Megaphone",
    badgeColor: "#ec4899",
    capabilities: OFFICE_CAPABILITIES.communications_lead,
  },
  {
    slug: "editorial-lead",
    name: "Editorial Lead",
    description:
      "Edits and approves everything that gets published to the blog.",
    level: 6,
    category: "department",
    badgeIcon: "PenTool",
    badgeColor: "#14b8a6",
    capabilities: OFFICE_CAPABILITIES.editorial_lead,
  },
  {
    slug: "marketing-lead",
    name: "Marketing Lead",
    description: "Grows the club's presence and manages sponsor relationships.",
    level: 6,
    category: "department",
    badgeIcon: "TrendingUp",
    badgeColor: "#f43f5e",
    capabilities: OFFICE_CAPABILITIES.marketing_lead,
  },
  {
    slug: "social-media-lead",
    name: "Social Media Lead",
    description: "Runs the club's social channels and visual presence.",
    level: 6,
    category: "department",
    badgeIcon: "Smartphone",
    badgeColor: "#ec4899",
    capabilities: OFFICE_CAPABILITIES.social_media_lead,
  },
  {
    slug: "documentation-lead",
    name: "Documentation Lead",
    description: "Curates the club's shared knowledge and resource library.",
    level: 6,
    category: "department",
    badgeIcon: "BookOpen",
    badgeColor: "#22c55e",
    capabilities: OFFICE_CAPABILITIES.documentation_lead,
  },
  {
    slug: "membership-lead",
    name: "Membership Lead",
    description: "Guides applicants in and handles membership questions.",
    level: 6,
    category: "department",
    badgeIcon: "IdCard",
    badgeColor: "#6366f1",
    capabilities: OFFICE_CAPABILITIES.membership_lead,
  },
  {
    slug: "community-lead",
    name: "Community Lead",
    description: "Keeps the community active and proposes events for it.",
    level: 6,
    category: "department",
    badgeIcon: "Handshake",
    badgeColor: "#06b6d4",
    capabilities: OFFICE_CAPABILITIES.community_lead,
  },
  {
    slug: "events-lead",
    name: "Events Lead",
    description: "Plans and coordinates the club's events end to end.",
    level: 6,
    category: "department",
    badgeIcon: "Calendar",
    badgeColor: "#06b6d4",
    capabilities: OFFICE_CAPABILITIES.event_coordinator,
  },
  {
    slug: "software-web-lead",
    name: "Software & Web Development Lead",
    description: "Leads web and software builds for the club.",
    level: 6,
    category: "department",
    badgeIcon: "Globe",
    badgeColor: "#22c55e",
    capabilities: OFFICE_CAPABILITIES.software_web_lead,
  },
  {
    slug: "ai-ml-data-lead",
    name: "AI/ML & Data Lead",
    description: "Leads machine learning and data work.",
    level: 6,
    category: "department",
    badgeIcon: "Bot",
    badgeColor: "#6366f1",
    capabilities: OFFICE_CAPABILITIES.ai_ml_data_lead,
  },
  {
    slug: "infrastructure-systems-lead",
    name: "Infrastructure / Systems Lead",
    description: "Runs the club's systems, tooling, and platform security.",
    level: 6,
    category: "department",
    badgeIcon: "Settings",
    badgeColor: "#f97316",
    capabilities: OFFICE_CAPABILITIES.infrastructure_systems_lead,
  },
  {
    slug: "ctf-lead",
    name: "CTF & Competitive Security Lead",
    description: "Trains and fields the club's CTF team.",
    level: 6,
    category: "department",
    badgeIcon: "Flag",
    badgeColor: "#ef4444",
    capabilities: OFFICE_CAPABILITIES.ctf_lead,
  },
  {
    slug: "design-lead",
    name: "Design Lead",
    description: "Owns the club's visual identity and gallery curation.",
    level: 6,
    category: "department",
    badgeIcon: "Palette",
    badgeColor: "#f43f5e",
    capabilities: ["gallery.manage"],
  },
  {
    slug: "pr-lead",
    name: "PR Lead",
    description: "Handles outreach, press, and partner conversations.",
    level: 6,
    category: "department",
    badgeIcon: "Megaphone",
    badgeColor: "#8b5cf6",
    capabilities: ["blog.create", "notifications.send", "sponsors.manage"],
  },
  {
    slug: "devops-lead",
    name: "DevOps Lead",
    description: "Keeps builds, deployments, and infrastructure healthy.",
    level: 6,
    category: "department",
    badgeIcon: "Wrench",
    badgeColor: "#0891b2",
    capabilities: ["security.contain", "audit.view"],
  },
  {
    slug: "faculty-coordinator",
    name: "Faculty Coordinator",
    description:
      "School faculty liaison for the club; an honour, not an authority.",
    level: 7,
    category: "special",
    badgeIcon: "GraduationCap",
    badgeColor: "#0ea5e9",
  },
  {
    slug: "alumni-mentor",
    name: "Alumni Mentor",
    description: "Former member who mentors current projects.",
    level: 4,
    category: "special",
    badgeIcon: "Sprout",
    badgeColor: "#22c55e",
  },
  {
    slug: "honorary-member",
    name: "Honorary Member",
    description: "Recognised contributor who is not on the active roster.",
    level: 3,
    category: "special",
    badgeIcon: "Star",
    badgeColor: "#eab308",
  },
];

export const CHARTER_METADATA = {
  name: "GREYMEN's CLUB Constitution & Governance Charter",
  status: "In Force",
  version: "1.0",
  school: "School of Engineering (SoE), ADYPU",
  president: "Aditya Yadav",
  presidentUrn: "E25B021436",
  batch: "BCA 2025 – BCA Cybersecurity",
  facultyCoordinators: ["Ranjana Singh", "Suyog Deshmukh"],
  reviewCycle: "At least once each academic year",
};

export const MEMBERSHIP_CATEGORIES = [
  {
    id: "general",
    title: "General Member",
    description:
      "Student admitted under the membership process. Participates in open activities subject to rules.",
  },
  {
    id: "active",
    title: "Active Member",
    description:
      "General Member meeting participation requirements. Voting eligibility and specified opportunities.",
  },
  {
    id: "officer",
    title: "Officer",
    description:
      "Holds a formal elected or appointed office while in good standing.",
  },
  {
    id: "project",
    title: "Project / Specialized Team Member",
    description:
      "Temporarily assigned scope-limited access for a project, research, or CTF team.",
  },
  {
    id: "alumni",
    title: "Alumni / Former Member",
    description:
      "Advisory or honorary participation; no ordinary voting unless expressly granted.",
  },
];

export const CONSTITUTIONAL_PRINCIPLES: string[] = [
  "Student-led governance within institutional oversight.",
  "Cybersecurity as the core technical identity.",
  "Interdisciplinary participation without academic boundary.",
  "Authorized and responsible use of technology.",
  "Competence-based responsibility and least privilege.",
  "Proportionate discipline, fairness, and right to respond.",
  "Documentation, continuity, and responsible handover.",
  "Non-discriminatory access subject to institutional rules.",
  "Protection of people, systems, information, and resources.",
  "Continuous improvement through periodic review.",
];

/**
 * Governance-required pages, forms, and their RBAC mapping.
 * Source: Charter Article 52 authority matrix.
 * Page lists required capability; form lists required fields for audit.
 * Server enforces via requireCapability(); sidebar and PermissionGate only hide.
 */
import type { Capability } from "@/lib/capabilities";

export interface GovernedPage {
  href: string;
  label: string;
  office: string;
  capabilities: Capability[];
  form?: string;
  auditAction?: string;
}

export const GOVERNED_PAGES: GovernedPage[] = [
  {
    href: "/admin",
    label: "Executive overview",
    office: "president",
    capabilities: ["governance.manage"],
  },
  {
    href: "/admin/membership",
    label: "Membership review",
    office: "membership_lead",
    capabilities: ["membership.view_applications"],
    form: "approve/reject + reason",
    auditAction: "approve_application / reject_application",
  },
  {
    href: "/admin/membership/approved",
    label: "Approved members",
    office: "membership_lead",
    capabilities: ["membership.view_applications"],
  },
  {
    href: "/admin/membership/rejected",
    label: "Rejected applications",
    office: "membership_lead",
    capabilities: ["membership.view_applications"],
  },
  {
    href: "/admin/users",
    label: "User directory",
    office: "general_secretary",
    capabilities: ["users.view"],
    form: "set_governance_role / set_membership_status",
    auditAction: "users.update_governance_role",
  },
  {
    href: "/admin/events",
    label: "Event pipeline",
    office: "cto",
    // The list and lifecycle PATCH admit every event capability, so the
    // registry says so: a reviewer holding only events.approve reaches this
    // page and its queue, not just the manager who created it.
    capabilities: ["events.manage", "events.approve", "events.publish", "events.update"],
    form: "draft -> review -> approve -> publish (reject / cancel per phase)",
    auditAction: "event.approve / event.publish / event.reject / event.cancel",
  },
  {
    // One screen for everything waiting on a decision across the queues the
    // caller can act on — same capability union as REVIEW_QUEUES / sidebar
    // badges / GET /api/admin/pending. Listed with every queue-cap so a
    // reviewer who can act on blogs (etc.) still sees this destination in
    // AccessCard, not only presidents.
    href: "/admin/pending",
    label: "Awaiting review (all queues)",
    office: "president",
    capabilities: REVIEW_QUEUE_CAPABILITIES,
  },
  {
    href: "/admin/events/create",
    label: "Create event",
    office: "event_coordinator",
    capabilities: ["events.create"],
    form: "title/slug/type/date/venue/capacity/audience",
    auditAction: "event.create",
  },
  {
    // Self-service: the author's own writing surface, gated by blog.create
    // (granted by the `blog_creator` power). Listed here so a member holding
    // that capability is shown where it takes them.
    href: "/blog/write",
    label: "Write a blog",
    office: "self",
    capabilities: ["blog.create"],
    auditAction: "blog.create",
  },
  {
    href: "/admin/blog",
    label: "Editorial review",
    office: "editorial_lead",
    // The queue list admits any editorial capability; each action narrows
    // server-side. Registering only blog.review would say approve-only
    // reviewers reach no door, which stopped being true.
    capabilities: ["blog.review", "blog.approve", "blog.publish", "blog.feature"],
    form: "approve / reject + reason / publish / feature",
    auditAction: "blog.approve / blog.reject / blog.publish",
  },
  {
    href: "/admin/gallery",
    label: "Gallery moderation",
    // The social media lead holds the gallery queue; communications runs
    // broadcasts. The old attribution named an office with no gallery grant.
    office: "social_media_lead",
    capabilities: ["gallery.manage", "gallery.approve"],
    form: "approve / reject + reason",
    auditAction: "gallery.approve / gallery.reject",
  },
  {
    href: "/admin/resources",
    label: "Resources",
    office: "documentation_lead",
    capabilities: ["resources.manage", "resources.approve"],
  },
  {
    href: "/admin/projects",
    label: "Research portfolio",
    office: "research_projects_director",
    capabilities: ["projects.manage", "projects.approve"],
  },
  {
    href: "/admin/sponsors",
    label: "Sponsorships",
    office: "treasurer",
    capabilities: ["sponsors.manage", "sponsors.approve"],
  },
  {
    href: "/admin/notifications",
    label: "Broadcast",
    office: "communications_lead",
    capabilities: ["notifications.send"],
    form: "audience + body (text-only render)",
    auditAction: "notification.send",
  },
  {
    // Everything that grants authority lives here: roles, charter offices
    // (a template plus a term) and operational powers. The page splits tabs by
    // capability; each tab is filtered again server-side.
    href: "/admin/access",
    label: "Access & powers (roles + offices + operational powers)",
    office: "president",
    capabilities: [
      "access.assign_roles",
      "governance.manage_offices",
      "powers.manage",
    ],
    form: "create_role / assign_role + scope + expiry · assign office + term · grant / revoke power",
    auditAction:
      "access.role_assigned / office.assign / office.end / power.grant / power.revoke",
  },
  {
    // Titles only: a designation grants no capability, so this is not access
    // administration and is deliberately separate from /admin/access.
    href: "/admin/positions",
    label: "Designations (titles)",
    office: "general_secretary",
    capabilities: ["designations.assign"],
    form: "assign / revoke designation",
    auditAction: "designation.assign / designation.revoke",
  },
  {
    // `governance.manage` is the whole story for this screen: /api/admin/governance
    // gates every method — including GET — on it, and the rows it serves include
    // `restricted` visibility. A read-only `governance.view_records` used to be
    // granted by two offices while no route read it; it was dropped rather than
    // wired, because handing out read access here needs a visibility filter
    // first. See docs/ACCESS_MODEL.md.
    href: "/admin/governance",
    label: "Constitutional records",
    office: "general_secretary",
    capabilities: ["governance.manage"],
  },
  {
    href: "/admin/departments",
    label: "Departments",
    office: "general_secretary",
    capabilities: ["departments.manage"],
  },
  {
    href: "/admin/audit",
    label: "Audit trail",
    office: "general_secretary",
    capabilities: ["audit.view"],
  },
  {
    href: "/events/[id]/tickets",
    label: "Door list",
    office: "event_coordinator",
    capabilities: ["tickets.view"],
  },
];

export function pagesForCapabilities(
  caps: Set<string> | string[],
): GovernedPage[] {
  const set = caps instanceof Set ? caps : new Set(caps);

  if (set.has("*")) return GOVERNED_PAGES;

  return GOVERNED_PAGES.filter((p) => p.capabilities.some((c) => set.has(c)));
}

/**
 * Governed pages a caller can actually open. Template routes
 * (`/events/[id]/tickets`) are excluded: they name a screen, not an address,
 * and a link to one resolves to a literal "[id]" path that never renders.
 */
export function accessiblePages(caps: Set<string> | string[]): GovernedPage[] {
  return pagesForCapabilities(caps).filter((p) => !p.href.includes("["));
}
