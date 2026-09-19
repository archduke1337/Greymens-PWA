/**
 * Governance source of truth — GREYMEN's CLUB Constitution & Governance Charter.
 * Offices, charter metadata, membership categories, principles, plus RBAC page mapping.
 */

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
    capabilities: ["events.manage"],
    form: "draft -> review -> publish",
    auditAction: "event.publish",
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
    capabilities: ["blog.review"],
    form: "approve / request_revision / reject",
    auditAction: "blog.review",
  },
  {
    href: "/admin/gallery",
    label: "Gallery moderation",
    office: "communications_lead",
    capabilities: ["gallery.manage", "gallery.approve"],
    form: "approve / reject",
    auditAction: "gallery.moderate",
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
