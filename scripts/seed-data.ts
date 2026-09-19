/**
 * Greymens — Seed Data Script
 *
 * Seeds departments, powers, event types, designations, and governance
 * role_templates (Option B) into Appwrite.
 * Run with: npx tsx scripts/seed-data.ts
 */

import { Client, TablesDB } from "node-appwrite";
import dotenv from "dotenv";
import path from "path";
import {
  OFFICE_CAPABILITIES,
  POWER_CATALOGUE,
  REVIEWER_ROLE_TEMPLATES,
} from "../lib/capabilities";
import {
  DESIGNATION_CATALOGUE,
  GOVERNANCE_OFFICES,
} from "../lib/governance";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ENDPOINT = process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT;
const PROJECT_ID = process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID;
const API_KEY = process.env.APPWRITE_API_KEY;
// Same default as scripts/setup-appwrite.js; must match the provisioned DB.
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID || "greymens_db";

if (!ENDPOINT || !PROJECT_ID || !API_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_APPWRITE_ENDPOINT, NEXT_PUBLIC_APPWRITE_PROJECT_ID, or APPWRITE_API_KEY.\n" +
      "Add them to .env.local (see .env.example), then re-run.",
  );
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT_ID).setKey(API_KEY);

const databases = new TablesDB(client);

let okCount = 0;
let failCount = 0;
const failures: string[] = [];

/**
 * Single-call create-or-update by deterministic row id.
 *
 * The previous list-then-create flow needed a lookup index per table and
 * masked the real error behind a fallback update retry. `upsertRow` is one
 * round trip and idempotent across reruns.
 */
async function upsertRow(
  tableId: string,
  rowId: string,
  data: Record<string, any>,
  label: string,
): Promise<void> {
  try {
    await databases.upsertRow({ databaseId: DB_ID, tableId, rowId, data });
    okCount += 1;
    console.log(`  ✓ ${label}`);
  } catch (e: any) {
    failCount += 1;
    failures.push(`${tableId}/${rowId}: ${e?.message ?? e}`);
    console.log(`  ! ${label}: ${e?.message ?? e}`);
  }
}

// ============================================================
// Departments
// ============================================================

const DEPARTMENTS = [
  // Technical
  { name: "AI/ML", slug: "ai-ml", description: "Artificial Intelligence and Machine Learning", icon: "Bot", color: "#6366f1", category: "technical", displayOrder: 1 },
  { name: "Cybersecurity", slug: "cybersecurity", description: "Cybersecurity and ethical hacking", icon: "Shield", color: "#ef4444", category: "technical", displayOrder: 2 },
  { name: "DevOps", slug: "devops", description: "DevOps and cloud infrastructure", icon: "Settings", color: "#f97316", category: "technical", displayOrder: 3 },
  { name: "Web Development", slug: "web-dev", description: "Full-stack web development", icon: "Globe", color: "#22c55e", category: "technical", displayOrder: 4 },
  // Content & Communication
  { name: "Social Media", slug: "social-media", description: "Social media management and content", icon: "Smartphone", color: "#ec4899", category: "content", displayOrder: 5 },
  { name: "PR & Outreach", slug: "pr-outreach", description: "Public relations and outreach", icon: "Megaphone", color: "#8b5cf6", category: "content", displayOrder: 6 },
  { name: "Editorial Board", slug: "editorial", description: "Newsletter and blog editorial", icon: "PenTool", color: "#14b8a6", category: "content", displayOrder: 7 },
  { name: "Design", slug: "design", description: "UI/UX design and branding", icon: "Palette", color: "#f43f5e", category: "content", displayOrder: 8 },
  // Operations
  { name: "Treasury", slug: "treasury", description: "Financial operations and budgeting", icon: "Wallet", color: "#eab308", category: "operations", displayOrder: 9 },
  { name: "Events & Logistics", slug: "events-logistics", description: "Event planning and logistics", icon: "Calendar", color: "#06b6d4", category: "operations", displayOrder: 10 },
];

// ============================================================
// Event Types
// ============================================================

const EVENT_TYPES = [
  {
    name: "workshop",
    displayName: "Workshop",
    description: "Hands-on learning sessions with tools, prerequisites, and practical exercises.",
    icon: "Wrench",
    displayOrder: 1,
    fields: JSON.stringify([
      { name: "prerequisites", type: "array", label: "Prerequisites", required: false, placeholder: "What attendees should know" },
      { name: "toolsNeeded", type: "array", label: "Tools Needed", required: false, placeholder: "Software/tools to install" },
      { name: "difficultyLevel", type: "select", label: "Difficulty Level", required: true, options: ["beginner", "intermediate", "advanced"] },
      { name: "durationHours", type: "number", label: "Duration (hours)", required: true },
      { name: "handsOn", type: "boolean", label: "Hands-on Exercises", required: true },
      { name: "certificatesProvided", type: "boolean", label: "Certificates Provided", required: true },
      { name: "materialsUrl", type: "url", label: "Pre-workshop Materials URL", required: false },
      { name: "recordingAllowed", type: "boolean", label: "Recording Allowed", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "member_only", allowGuestRegistration: false, requiresApproval: false, maxTeamSize: 1, waitlistEnabled: true, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: true, transferAllowed: false, verificationMethods: ["qr_scan", "manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: true }),
  },
  {
    name: "hackathon",
    displayName: "Hackathon",
    description: "Multi-hour coding competitions with teams, tracks, judging, and submissions.",
    icon: "Laptop",
    displayOrder: 2,
    fields: JSON.stringify([
      { name: "teamSizeMin", type: "number", label: "Min Team Size", required: true },
      { name: "teamSizeMax", type: "number", label: "Max Team Size", required: true },
      { name: "tracks", type: "array", label: "Tracks/Themes", required: true, placeholder: "Competition track" },
      { name: "judgingCriteria", type: "json", label: "Judging Criteria", required: true },
      { name: "submissionRules", type: "textarea", label: "Submission Rules", required: true },
      { name: "submissionDeadline", type: "date", label: "Submission Deadline", required: false },
      { name: "prizes", type: "json", label: "Prizes", required: false },
      { name: "mentorsAvailable", type: "boolean", label: "Mentors Available", required: true },
      { name: "durationHours", type: "number", label: "Duration (hours)", required: true },
      { name: "teamFormationAllowed", type: "boolean", label: "Team Formation Allowed", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "member_only", allowGuestRegistration: false, requiresApproval: false, maxTeamSize: "dynamic", teamFormationEnabled: true, waitlistEnabled: true, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "team", maxEntries: 1, qrEnabled: true, transferAllowed: false, verificationMethods: ["qr_scan", "manual_search"], teamTicket: true }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: false }),
  },
  {
    name: "seminar",
    displayName: "Seminar",
    description: "Educational sessions with speakers, topic-focused presentations, and knowledge sharing.",
    icon: "GraduationCap",
    displayOrder: 3,
    fields: JSON.stringify([
      { name: "speakers", type: "json", label: "Speakers", required: true },
      { name: "topicArea", type: "text", label: "Topic Area", required: true },
      { name: "certificateEligible", type: "boolean", label: "Certificate Eligible", required: true },
      { name: "recordingAllowed", type: "boolean", label: "Recording Allowed", required: true },
      { name: "presentationSlidesUrl", type: "url", label: "Slides URL", required: false },
      { name: "targetAudience", type: "text", label: "Target Audience", required: false },
      { name: "qnaAllowed", type: "boolean", label: "Q&A Session Included", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "public", allowGuestRegistration: true, requiresApproval: false, maxTeamSize: 1, waitlistEnabled: true, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: true, transferAllowed: true, verificationMethods: ["qr_scan", "manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: true }),
  },
  {
    name: "competition",
    displayName: "Competition",
    description: "Competitive events with scoring, rounds, submissions, and prizes.",
    icon: "Trophy",
    displayOrder: 4,
    fields: JSON.stringify([
      { name: "scoringRubric", type: "json", label: "Scoring Rubric", required: true },
      { name: "submissionFormat", type: "text", label: "Submission Format", required: true },
      { name: "rounds", type: "json", label: "Rounds", required: true },
      { name: "prizes", type: "json", label: "Prizes", required: false },
      { name: "allowLateSubmission", type: "boolean", label: "Allow Late Submission", required: true },
      { name: "teamCompetition", type: "boolean", label: "Team Competition", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "member_only", allowGuestRegistration: false, requiresApproval: false, maxTeamSize: "dynamic", waitlistEnabled: false, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: true, transferAllowed: false, verificationMethods: ["qr_scan", "manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: false }),
  },
  {
    name: "bootcamp",
    displayName: "Bootcamp",
    description: "Multi-day intensive training programs with curriculum, homework, and certification.",
    icon: "Tent",
    displayOrder: 5,
    fields: JSON.stringify([
      { name: "durationWeeks", type: "number", label: "Duration (weeks)", required: true },
      { name: "curriculum", type: "json", label: "Curriculum", required: true },
      { name: "homeworkRequired", type: "boolean", label: "Homework Required", required: true },
      { name: "certificationProvided", type: "boolean", label: "Certification Provided", required: true },
      { name: "passingCriteria", type: "text", label: "Passing Criteria", required: false },
      { name: "projectRequired", type: "boolean", label: "Final Project Required", required: true },
      { name: "attendanceRequired", type: "boolean", label: "Attendance Tracked", required: true },
      { name: "difficultyLevel", type: "select", label: "Difficulty Level", required: true, options: ["beginner", "intermediate", "advanced"] },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "member_only", allowGuestRegistration: false, requiresApproval: true, maxTeamSize: 1, waitlistEnabled: true, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: true, transferAllowed: false, verificationMethods: ["qr_scan", "manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: false }),
  },
  {
    name: "meetup",
    displayName: "Meetup",
    description: "Casual networking and discussion events.",
    icon: "Coffee",
    displayOrder: 6,
    fields: JSON.stringify([
      { name: "agenda", type: "json", label: "Agenda", required: false },
      { name: "refreshments", type: "boolean", label: "Refreshments Provided", required: true },
      { name: "dressCode", type: "text", label: "Dress Code", required: false },
      { name: "networkingFocused", type: "boolean", label: "Networking Focused", required: true },
      { name: "informalFormat", type: "boolean", label: "Informal Format", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "public", allowGuestRegistration: true, requiresApproval: false, maxTeamSize: 1, waitlistEnabled: false, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: false, transferAllowed: false, verificationMethods: ["manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager", "member"], approvalRequired: false, approverRoles: ["head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: true }),
  },
  {
    name: "guest_lecture",
    displayName: "Guest Lecture",
    description: "External expert presentations and industry talks.",
    icon: "Mic",
    displayOrder: 7,
    fields: JSON.stringify([
      { name: "speakerBio", type: "textarea", label: "Speaker Bio", required: true },
      { name: "speakerCompany", type: "text", label: "Speaker Company", required: true },
      { name: "speakerAvatar", type: "url", label: "Speaker Photo URL", required: false },
      { name: "speakerLinkedIn", type: "url", label: "Speaker LinkedIn", required: false },
      { name: "topicArea", type: "text", label: "Topic Area", required: true },
      { name: "recordingAllowed", type: "boolean", label: "Recording Allowed", required: true },
      { name: "certificateEligible", type: "boolean", label: "Certificate Eligible", required: true },
      { name: "qnaAllowed", type: "boolean", label: "Q&A Included", required: true },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "public", allowGuestRegistration: true, requiresApproval: false, maxTeamSize: 1, waitlistEnabled: true, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "standard", maxEntries: 1, qrEnabled: true, transferAllowed: true, verificationMethods: ["qr_scan", "manual_search"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: true }),
  },
  {
    name: "certification_exam",
    displayName: "Certification Exam",
    description: "Formal certification examinations with scoring and validity tracking.",
    icon: "FileText",
    displayOrder: 8,
    fields: JSON.stringify([
      { name: "examBody", type: "text", label: "Certifying Organization", required: true },
      { name: "validityPeriod", type: "text", label: "Validity Period", required: true },
      { name: "retakePolicy", type: "text", label: "Retake Policy", required: true },
      { name: "passingScore", type: "number", label: "Passing Score", required: true },
      { name: "maxScore", type: "number", label: "Maximum Score", required: true },
      { name: "examDuration", type: "number", label: "Exam Duration (minutes)", required: true },
      { name: "examFormat", type: "select", label: "Exam Format", required: true, options: ["online", "offline", "hybrid"] },
      { name: "studyMaterialsUrl", type: "url", label: "Study Materials URL", required: false },
    ]),
    registrationConfig: JSON.stringify({ defaultAudience: "member_only", allowGuestRegistration: false, requiresApproval: true, maxTeamSize: 1, waitlistEnabled: false, cancellationAllowed: true }),
    ticketConfig: JSON.stringify({ ticketType: "exam_seat", maxEntries: 1, qrEnabled: true, transferAllowed: false, verificationMethods: ["qr_scan", "manual_search", "id_verification"] }),
    workflowConfig: JSON.stringify({ draftPermission: ["lead", "event_manager"], approvalRequired: true, approverRoles: ["head", "operations_head", "admin"], publishAfterApproval: true, autoActivateAtEventTime: false }),
  },
];

// ============================================================
// Seed Functions
// ============================================================

async function seedDepartments() {
  console.log("\n=== Seeding Departments ===");
  for (const dept of DEPARTMENTS) {
    await upsertRow("departments", `dept-${dept.slug}`, { ...dept, isActive: true }, dept.name);
  }
}

async function seedPowers() {
  console.log("\n=== Seeding Powers ===");
  // Seeded straight from POWER_CATALOGUE: the row a grant points at and the
  // capability map the authorizer reads are the same record, so a power can no
  // longer be seeded without meaning nor mapped without a row to grant.
  // `capabilities` is stripped — the table has no such column; the mapping
  // lives in code, deliberately, so authority stays reviewable in one file.
  for (const { capabilities: _capabilities, ...power } of POWER_CATALOGUE) {
    // The row id is the power name: user_powers.powerId stores either form
    // and the grant map is keyed by name.
    await upsertRow("powers", power.name, { ...power }, power.displayName);
  }
}

async function seedEventTypes() {
  console.log("\n=== Seeding Event Types ===");
  for (const et of EVENT_TYPES) {
    await upsertRow(
      "event_types",
      `etype-${et.name}`,
      { ...et, isActive: true },
      et.displayName,
    );
  }
}

async function seedDesignations() {
  console.log("\n=== Seeding Designations ===");
  // Titles come from DESIGNATION_CATALOGUE (lib/governance). The ones that
  // carry authority mirror the charter office of the same name rather than
  // holding a second copy of the grant, so "AI/ML Lead" means one thing on a
  // profile and one thing to the server. Honour-only titles carry none.
  for (const [index, desig] of DESIGNATION_CATALOGUE.entries()) {
    await upsertRow(
      "designations",
      `desig-${desig.slug}`,
      { ...desig, displayOrder: index + 1, isActive: true },
      desig.name,
    );
  }
}

async function seedRoleTemplates() {
  // Option B: one role_template per Charter office, marked with `officeId` so
  // the authorizer can read an office's capabilities from its template instead
  // of the compile-time OFFICE_CAPABILITIES map. OFFICE_CAPABILITIES is now the
  // *seed* value, not the source of truth: editing the template in the console
  // is what changes what an office can do. Deterministic IDs make reruns
  // idempotent: create office-<id>, on conflict update capabilities.
  // Admin needs no template (wildcard "*"), so no admin template is seeded.
  console.log("\n=== Seeding Role Templates (offices) ===");
  for (const office of GOVERNANCE_OFFICES) {
    const caps = OFFICE_CAPABILITIES[office.id] ?? [];
    if (caps.length === 0) {
      console.log(`  - ${office.title} (no capabilities, skipped)`);
      continue;
    }
    const docId = `office-${office.id}`;
    // Optional string columns are omitted when unset: Appwrite rejects an
    // explicit null for a string column, which previously failed every
    // role_template row.
    const payload = {
      name: office.title,
      slug: office.id,
      description: `${office.title} — ${office.layer}${office.elected ? " (elected)" : " (appointed)"} per Charter`,
      capabilities: caps,
      label: office.layer,
      officeId: office.id,
      isActive: true,
    };
    await upsertRow("role_templates", docId, payload, office.title);
  }

  // Plain reviewer roles (no officeId): the approval half of a queue without
  // its management half, so a reviewer is one pick in Access & Powers instead
  // of a hand-assembled single-capability template. Same idempotent upsert —
  // deterministic ids, capabilities reconciled on rerun.
  console.log("\n=== Seeding Role Templates (reviewers) ===");
  for (const reviewer of REVIEWER_ROLE_TEMPLATES) {
    await upsertRow(
      "role_templates",
      reviewer.id,
      {
        name: reviewer.name,
        slug: reviewer.slug,
        description: reviewer.description,
        capabilities: reviewer.capabilities,
        isActive: true,
      },
      reviewer.name,
    );
  }
}

async function main() {
  console.log("=== Greymens — Seed Data ===");

  await seedDepartments();
  await seedPowers();
  await seedEventTypes();
  await seedDesignations();
  await seedRoleTemplates();

  console.log(`\n=== Seeding complete: ${okCount} ok, ${failCount} failed ===`);
  if (failCount > 0) {
    console.log("Failures:");
    for (const failure of failures) console.log(`  - ${failure}`);
    process.exitCode = 1;
  }
}

main().catch(console.error);
