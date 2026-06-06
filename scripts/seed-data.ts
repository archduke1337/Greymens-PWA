/**
 * Mind Mesh — Seed Data Script
 *
 * Seeds departments, powers, and event types into Appwrite.
 * Run with: npx tsx scripts/seed-data.ts
 */

import { Client, Databases, ID } from "appwrite";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env.local") });
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!)
  .setKey(process.env.APPWRITE_API_KEY!);

const databases = new Databases(client);
const DB_ID = process.env.NEXT_PUBLIC_APPWRITE_DATABASE_ID!;

// ============================================================
// Departments
// ============================================================

const DEPARTMENTS = [
  // Technical
  { name: "AI/ML", slug: "ai-ml", description: "Artificial Intelligence and Machine Learning", icon: "🤖", color: "#6366f1", category: "technical", displayOrder: 1 },
  { name: "Cybersecurity", slug: "cybersecurity", description: "Cybersecurity and ethical hacking", icon: "🛡️", color: "#ef4444", category: "technical", displayOrder: 2 },
  { name: "DevOps", slug: "devops", description: "DevOps and cloud infrastructure", icon: "⚙️", color: "#f97316", category: "technical", displayOrder: 3 },
  { name: "Web Development", slug: "web-dev", description: "Full-stack web development", icon: "🌐", color: "#22c55e", category: "technical", displayOrder: 4 },
  // Content & Communication
  { name: "Social Media", slug: "social-media", description: "Social media management and content", icon: "📱", color: "#ec4899", category: "content", displayOrder: 5 },
  { name: "PR & Outreach", slug: "pr-outreach", description: "Public relations and outreach", icon: "📢", color: "#8b5cf6", category: "content", displayOrder: 6 },
  { name: "Editorial Board", slug: "editorial", description: "Newsletter and blog editorial", icon: "✍️", color: "#14b8a6", category: "content", displayOrder: 7 },
  { name: "Design", slug: "design", description: "UI/UX design and branding", icon: "🎨", color: "#f43f5e", category: "content", displayOrder: 8 },
  // Operations
  { name: "Treasury", slug: "treasury", description: "Financial operations and budgeting", icon: "💰", color: "#eab308", category: "operations", displayOrder: 9 },
  { name: "Events & Logistics", slug: "events-logistics", description: "Event planning and logistics", icon: "🎪", color: "#06b6d4", category: "operations", displayOrder: 10 },
];

// ============================================================
// Powers
// ============================================================

const POWERS = [
  { name: "membership_approver", displayName: "Membership Approver", description: "Can approve/reject membership applications", category: "membership", scope: "global" },
  { name: "event_manager", displayName: "Event Manager", description: "Can create/edit/publish events", category: "events", scope: "global" },
  { name: "ticket_verifier", displayName: "Ticket Verifier", description: "Can verify tickets at events", category: "tickets", scope: "department" },
  { name: "blog_creator", displayName: "Blog Creator", description: "Can create blog posts", category: "content", scope: "global" },
  { name: "blog_reviewer", displayName: "Blog Reviewer", description: "Can approve/reject blog submissions", category: "content", scope: "global" },
  { name: "gallery_manager", displayName: "Gallery Manager", description: "Can manage gallery (approve/delete)", category: "gallery", scope: "global" },
  { name: "gallery_uploader", displayName: "Gallery Uploader", description: "Can upload gallery images", category: "gallery", scope: "global" },
  { name: "resource_manager", displayName: "Resource Manager", description: "Can manage resources in scope", category: "resources", scope: "department" },
  { name: "department_head", displayName: "Department Head", description: "Can manage own department", category: "admin", scope: "department" },
  { name: "operations_head", displayName: "Operations Head", description: "Can manage multiple departments", category: "admin", scope: "global" },
  { name: "profile_moderator", displayName: "Profile Moderator", description: "Can view/revert profile changes", category: "admin", scope: "global" },
  { name: "notification_admin", displayName: "Notification Admin", description: "Can send system notifications", category: "admin", scope: "global" },
  { name: "newsletter_manager", displayName: "Newsletter Manager", description: "Can manage newsletter/editorial content", category: "content", scope: "global" },
  { name: "social_media_manager", displayName: "Social Media Manager", description: "Can manage social media content", category: "social", scope: "global" },
  { name: "pr_manager", displayName: "PR Manager", description: "Can manage PR & outreach content", category: "content", scope: "global" },
  { name: "design_manager", displayName: "Design Manager", description: "Can manage design assets", category: "gallery", scope: "global" },
];

// ============================================================
// Event Types
// ============================================================

const EVENT_TYPES = [
  {
    name: "workshop",
    displayName: "Workshop",
    description: "Hands-on learning sessions with tools, prerequisites, and practical exercises.",
    icon: "🔧",
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
    icon: "💻",
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
    icon: "🎓",
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
    icon: "🏆",
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
    icon: "🏕️",
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
    icon: "☕",
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
    icon: "🎤",
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
    icon: "📝",
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
// Designations (seeded)
// ============================================================

const DESIGNATIONS = [
  { name: "Secretary", slug: "secretary", description: "Club secretary", level: 6, category: "executive", displayOrder: 1 },
  { name: "Treasurer", slug: "treasurer", description: "Club treasurer", level: 6, category: "executive", displayOrder: 2 },
  { name: "Social Media Lead", slug: "social-media-lead", description: "Lead for social media operations", level: 5, category: "department" },
  { name: "Editorial Lead", slug: "editorial-lead", description: "Lead for editorial board", level: 5, category: "department" },
  { name: "Design Lead", slug: "design-lead", description: "Lead for design team", level: 5, category: "department" },
  { name: "PR Lead", slug: "pr-lead", description: "Lead for PR & outreach", level: 5, category: "department" },
  { name: "AI/ML Lead", slug: "ai-ml-lead", description: "Lead for AI/ML department", level: 5, category: "department" },
  { name: "CyberSec Lead", slug: "cybersec-lead", description: "Lead for Cybersecurity department", level: 5, category: "department" },
  { name: "DevOps Lead", slug: "devops-lead", description: "Lead for DevOps department", level: 5, category: "department" },
  { name: "Web Dev Lead", slug: "web-dev-lead", description: "Lead for Web Development department", level: 5, category: "department" },
  { name: "Events Lead", slug: "events-lead", description: "Lead for events & logistics", level: 5, category: "department" },
];

// ============================================================
// Seed Functions
// ============================================================

async function seedDepartments() {
  console.log("\n=== Seeding Departments ===");
  for (const dept of DEPARTMENTS) {
    try {
      await databases.createDocument(DB_ID, "departments", ID.unique(), {
        ...dept,
        isActive: true,
      });
      console.log(`  ✓ ${dept.name}`);
    } catch (e: any) {
      console.log(`  ! ${dept.name}: ${e.message}`);
    }
  }
}

async function seedPowers() {
  console.log("\n=== Seeding Powers ===");
  for (const power of POWERS) {
    try {
      await databases.createDocument(DB_ID, "powers", ID.unique(), power);
      console.log(`  ✓ ${power.displayName}`);
    } catch (e: any) {
      console.log(`  ! ${power.displayName}: ${e.message}`);
    }
  }
}

async function seedEventTypes() {
  console.log("\n=== Seeding Event Types ===");
  for (const et of EVENT_TYPES) {
    try {
      await databases.createDocument(DB_ID, "event_types", ID.unique(), {
        ...et,
        isActive: true,
      });
      console.log(`  ✓ ${et.displayName}`);
    } catch (e: any) {
      console.log(`  ! ${et.displayName}: ${e.message}`);
    }
  }
}

async function seedDesignations() {
  console.log("\n=== Seeding Designations ===");
  for (const desig of DESIGNATIONS) {
    try {
      await databases.createDocument(DB_ID, "designations", ID.unique(), {
        ...desig,
        isActive: true,
      });
      console.log(`  ✓ ${desig.name}`);
    } catch (e: any) {
      console.log(`  ! ${desig.name}: ${e.message}`);
    }
  }
}

async function main() {
  console.log("=== Mind Mesh — Seed Data ===");

  if (!process.env.APPWRITE_API_KEY) {
    console.error("ERROR: APPWRITE_API_KEY not found in .env.local");
    process.exit(1);
  }

  await seedDepartments();
  await seedPowers();
  await seedEventTypes();
  await seedDesignations();

  console.log("\n=== Seeding complete ===");
}

main().catch(console.error);
