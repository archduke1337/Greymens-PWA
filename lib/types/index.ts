/**
 * Mind Mesh Club Operating System — Type Definitions
 * 
 * Centralized types for the entire club OS.
 */

import type { Models } from "appwrite";

// ============================================================
// Extended User (runtime fields from Appwrite)
// ============================================================

export type ExtendedUser<Preferences extends Models.Preferences = Models.DefaultPreferences> = Models.User<Preferences> & {
  email: string;
  phone: string;
  phoneVerification: boolean;
  emailVerification: boolean;
  prefs: Preferences;
  status: boolean;
  registration: string;
  accessedAt: string;
  mfa: boolean;
  targets: any[];
};

// ============================================================
// Membership Status
// ============================================================

export type MembershipStatus =
  | "no_account"
  | "account"
  | "applicant"
  | "member"
  | "core_member"
  | "lead"
  | "head"
  | "admin"
  | "dev"
  | "banned"
  | "deactivated";

// ============================================================
// Profile
// ============================================================

export interface Profile {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  avatar?: string;
  pronouns?: "he/him" | "she/her" | "they/them" | "he/they" | "she/they" | "prefer_to_say";
  phone?: string;
  urn?: string;
  program?: string;
  branch?: string;
  year?: string;
  semester?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: "male" | "female" | "other" | "prefer_not_to_say";
  githubUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  experience?: string;
  whyJoin?: string;
  availability?: "full" | "partial" | "event_only";
  profileVisibility?: "public" | "members_only" | "private";
  showOnAboutPage?: boolean;
}

// ============================================================
// Application
// ============================================================

export interface Application {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "reapplied";
  profileId: string;
  oathAccepted: boolean;
  termsAccepted: boolean;
  constitutionAccepted: boolean;
  preferredDepartments?: string[];
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  submittedAt: string;
}

// ============================================================
// Membership
// ============================================================

export interface Membership {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  applicationId: string;
  status: "active" | "inactive" | "suspended" | "banned";
  membershipNumber: string;
  approvedBy: string;
  approvedAt: string;
  department?: string;
  joinedAt: string;
}

// ============================================================
// Department
// ============================================================

export interface Department {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  name: string;
  slug: string;
  description?: string;
  icon?: string;
  color?: string;
  parentId?: string;
  headId?: string;
  isActive: boolean;
  displayOrder?: number;
  category: "technical" | "content" | "operations";
}

// ============================================================
// User-Department
// ============================================================

export interface UserDepartment {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  departmentId: string;
  role: "member" | "core_member" | "lead";
  assignedBy: string;
  assignedAt: string;
  isActive: boolean;
}

// ============================================================
// Designation
// ============================================================

export interface Designation {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  name: string;
  slug: string;
  description?: string;
  level: number;
  category: "department" | "operations" | "executive" | "special";
  departmentId?: string;
  badgeIcon?: string;
  badgeColor?: string;
  isActive: boolean;
  maxHolders?: number;
}

// ============================================================
// User-Designation
// ============================================================

export interface UserDesignation {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  designationId: string;
  assignedBy: string;
  assignedAt: string;
  revokedAt?: string;
  revokedBy?: string;
  isActive: boolean;
}

// ============================================================
// Power
// ============================================================

export interface Power {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  name: string;
  displayName: string;
  description?: string;
  category: "membership" | "events" | "tickets" | "content" | "resources" | "admin" | "gallery" | "social";
  scope: "global" | "department" | "own";
}

// ============================================================
// User-Power
// ============================================================

export interface UserPower {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  powerId: string;
  grantedBy: string;
  grantedAt: string;
  departmentId?: string;
  expiresAt?: string;
  isActive: boolean;
}

// ============================================================
// Event
// ============================================================

export interface Event {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  title: string;
  slug: string;
  description: string;
  image?: string;
  eventTypeId: string;
  status: "draft" | "review" | "approved" | "published" | "active" | "completed" | "cancelled";
  audience: "public" | "member_only" | "exclusive";
  date: string;
  time: string;
  endDate?: string;
  venue: string;
  location: string;
  capacity: number;
  registered: number;
  price: number;
  discountPrice?: number;
  organizerName: string;
  organizerAvatar?: string;
  ownerId: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  tags?: string[];
  isFeatured: boolean;
  isPremium: boolean;
  // Common event-type-specific fields
  eventDocs?: EventDoc[];
  externalLinks?: EventLink[];
  materials?: EventMaterial[];
  registrationUrl?: string;
  eventWebsite?: string;
  contactEmail?: string;
}

export interface EventDoc {
  name: string;
  type: "link" | "file";
  url?: string;
  fileId?: string;
}

export interface EventLink {
  label: string;
  url: string;
}

export interface EventMaterial {
  name: string;
  type: "link" | "file";
  url?: string;
  fileId?: string;
}

// ============================================================
// Event Type
// ============================================================

export interface EventType {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  name: string;
  displayName: string;
  description?: string;
  icon?: string;
  fields: EventField[];
  registrationConfig: RegistrationConfig;
  ticketConfig: TicketConfig;
  workflowConfig: WorkflowConfig;
  isActive: boolean;
  displayOrder?: number;
}

export interface EventField {
  name: string;
  type: "text" | "textarea" | "number" | "select" | "multi-select" | "boolean" | "date" | "url" | "file" | "json" | "array";
  label: string;
  required: boolean;
  options?: string[];
  validation?: any;
  appliesTo?: "attendee" | "organizer" | "both";
  placeholder?: string;
  defaultValue?: any;
}

export interface RegistrationConfig {
  defaultAudience: "public" | "member_only" | "exclusive";
  allowGuestRegistration: boolean;
  requiresApproval: boolean;
  maxTeamSize: number | "dynamic";
  teamFormationEnabled?: boolean;
  waitlistEnabled: boolean;
  cancellationAllowed: boolean;
  cancellationDeadline?: string;
}

export interface TicketConfig {
  ticketType: "standard" | "team" | "exam_seat";
  maxEntries: number;
  qrEnabled: boolean;
  transferAllowed: boolean;
  verificationMethods: ("qr_scan" | "manual_search" | "manual_entry" | "id_verification")[];
  teamTicket?: boolean;
}

export interface WorkflowConfig {
  draftPermission: string[];
  approvalRequired: boolean;
  approverRoles: string[];
  publishAfterApproval: boolean;
  autoActivateAtEventTime: boolean;
}

// ============================================================
// Event Type Data
// ============================================================

export interface EventTypeData {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  eventId: string;
  eventTypeId: string;
  fieldData: Record<string, any>;
}

// ============================================================
// Registration
// ============================================================

export interface Registration {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  eventId: string;
  userId: string;
  status: "pending" | "approved" | "rejected" | "cancelled" | "waitlisted";
  registeredAt: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  metadata?: Record<string, any>;
}

// ============================================================
// Ticket
// ============================================================

export interface Ticket {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  eventId: string;
  userId: string;
  registrationId: string;
  ticketCode: string;
  qrData: string;
  status: "pending" | "issued" | "active" | "checked_in" | "completed" | "invalidated" | "transferred" | "waitlisted";
  issuedAt?: string;
  checkedInAt?: string;
  checkedInBy?: string;
  invalidatedAt?: string;
  invalidatedReason?: string;
  transferredTo?: string;
  transferHistory?: TransferRecord[];
  entryCount: number;
  maxEntries: number;
  metadata?: Record<string, any>;
}

export interface TransferRecord {
  from: string;
  to: string;
  transferredAt: string;
  reason?: string;
}

// ============================================================
// Ticket Verification
// ============================================================

export interface TicketVerification {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  ticketId: string;
  eventId: string;
  verifiedBy: string;
  method: "qr_scan" | "manual_search" | "manual_entry";
  result: "success" | "already_checked_in" | "invalid_ticket" | "event_not_active";
  verifiedAt: string;
  metadata?: Record<string, any>;
}

// ============================================================
// Resource
// ============================================================

export interface Resource {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  title: string;
  description?: string;
  type: "document" | "link" | "video" | "file" | "announcement";
  url?: string;
  fileId?: string;
  layer: "common" | "department" | "role";
  departmentId?: string;
  designationId?: string;
  tags?: string[];
  uploadedBy: string;
  isActive: boolean;
  displayOrder?: number;
}

// ============================================================
// Notification
// ============================================================

export interface Notification {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  letter?: LetterData;
  data?: Record<string, any>;
  read: boolean;
  readAt?: string;
}

export interface LetterData {
  template: "welcome" | "promotion" | "designation" | "custom";
  subject: string;
  body: string;
  metadata?: Record<string, any>;
}

// ============================================================
// Audit Log
// ============================================================

export interface AuditLog {
  $id?: string;
  $createdAt?: string;
  actorId: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

// ============================================================
// Gallery
// ============================================================

export interface GalleryImage {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  title: string;
  description?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  category: "events" | "workshops" | "hackathons" | "team" | "projects" | "other";
  uploadedBy: string;
  eventId?: string;
  departmentId?: string;
  status: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
  tags?: string[];
  isActive: boolean;
  displayOrder?: number;
}

// ============================================================
// Approval Workflow
// ============================================================

export interface ApprovalWorkflow {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  entityType: "membership" | "event" | "registration" | "promotion" | "department_assignment";
  entityId: string;
  currentStep: number;
  totalSteps: number;
  steps: ApprovalStep[];
  status: "pending" | "in_progress" | "approved" | "rejected";
  initiatedBy: string;
  initiatedAt: string;
  completedAt?: string;
}

export interface ApprovalStep {
  stepNumber: number;
  name: string;
  approverRole: string;
  approverId?: string;
  status: "pending" | "approved" | "rejected";
  timestamp?: string;
  notes?: string;
}

// ============================================================
// Permission System Types
// ============================================================

export type Permission =
  | "view_public_content"
  | "view_resources"
  | "view_roadmaps"
  | "view_members"
  | "register_events"
  | "view_member_resources"
  | "manage_own_profile"
  | "view_all_members"
  | "manage_department_resources"
  | "manage_department_team"
  | "draft_events"
  | "approve_events"
  | "manage_multiple_departments"
  | "manage_organization"
  | "view_reports"
  | "ALL_PERMISSIONS"
  | string; // allow custom permissions

export interface PermissionCheck {
  hasPermission: (permission: string, scope?: string) => boolean;
  hasAnyPermission: (permissions: string[], scope?: string) => boolean;
  hasAllPermissions: (permissions: string[], scope?: string) => boolean;
}

// ============================================================
// Dashboard Types
// ============================================================

export type DashboardPersona = "applicant" | "member" | "lead" | "head" | "admin";

export interface DashboardModule {
  id: string;
  name: string;
  description: string;
  icon: string;
  requiredPermission?: string;
  requiredStatus?: MembershipStatus[];
}

// ============================================================
// Letter Templates
// ============================================================

export interface LetterTemplate {
  template: "welcome" | "promotion" | "designation" | "custom";
  generate: (data: Record<string, any>) => LetterData;
}
