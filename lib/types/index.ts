/**
 * Greymens Club Operating System — Type Definitions
 *
 * Centralized types for the entire club OS.
 */

import type { Models } from "appwrite";

// ============================================================
// Appwrite user preferences
// ============================================================

/**
 * Account-level preferences we rely on. Appwrite stores these as a free-form
 * JSON object, so they must be modelled explicitly to stay type-safe.
 */
export type UserPreferences = Models.DefaultPreferences & {
  profilePictureId?: string;
};

export type AppwriteUser = Models.User<UserPreferences>;

// ============================================================
// Extended User (runtime fields from Appwrite)
// ============================================================

export type ExtendedUser<
  Preferences extends Models.Preferences = Models.DefaultPreferences,
> = Models.User<Preferences> & {
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
  | "suspended"
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
  pronouns?:
    | "he/him"
    | "she/her"
    | "they/them"
    | "he/they"
    | "she/they"
    | "prefer_to_say";
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
  instagramUrl?: string;
  bio?: string;
  skills?: string[];
  interests?: string[];
  experience?: string;
  whyJoin?: string;
  availability?: "full" | "partial" | "event_only";
  profileVisibility?: "public" | "members_only" | "private";
  showOnAboutPage?: boolean;
  /**
   * Member preference for decision mail. Missing reads as opted in, so
   * accounts created before the switch existed keep receiving notices.
   */
  emailNotifications?: boolean;
  profilePictureId?: string;
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
  /**
   * Capabilities this title confers. Empty by default — a designation is an
   * honour, and it carries authority only when an administrator lists it here.
   */
  capabilities?: string[];
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
  category:
    | "membership"
    | "events"
    | "tickets"
    | "content"
    | "resources"
    | "admin"
    | "gallery"
    | "social";
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
// Project
// ============================================================

export interface Project {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  title: string;
  description: string;
  image: string;
  category: string;
  status: string;
  progress: number;
  technologies: string[];
  stars: number;
  forks: number;
  contributors: number;
  duration: string;
  isFeatured: boolean;
  demoUrl: string;
  repoUrl: string;
  teamMembers: string[];
  createdAt: string;
  /**
   * Review pipeline for member proposals (review -> approved/rejected),
   * independent of `status` (build progress). Missing on legacy rows, which
   * read as approved.
   */
  reviewStatus?: "review" | "approved" | "rejected";
  ownerId?: string;
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
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
  category?: string;
  /**
   * `rejected` is a review verdict on an unpublished event; `cancelled` takes
   * back one that had already been approved or was live. They used to share
   * `cancelled`, which made "never approved" and "called off" the same row.
   */
  status:
    | "draft"
    | "review"
    | "approved"
    | "published"
    | "active"
    | "completed"
    | "cancelled"
    | "rejected";
  audience: "public" | "member_only" | "exclusive";
  date: string;
  time: string;
  endDate?: string;
  venue: string;
  location: string;
  capacity: number;
  registered: number;
  price: number;
  discountPrice?: number | null;
  organizerName: string;
  organizerAvatar?: string;
  ownerId: string;
  approvedBy?: string;
  approvedAt?: string;
  publishedAt?: string;
  /** Reviewer's note on a rejection; `cancellationReason` is its mirror for a
   * pulled-back live event, so the two histories stay distinguishable. */
  rejectionReason?: string;
  cancellationReason?: string;
  cancelledAt?: string;
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
  type:
    | "text"
    | "textarea"
    | "number"
    | "select"
    | "multi-select"
    | "boolean"
    | "date"
    | "url"
    | "file"
    | "json"
    | "array";
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
  verificationMethods: (
    "qr_scan" | "manual_search" | "manual_entry" | "id_verification"
  )[];
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
  userName?: string;
  userEmail?: string;
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
  status:
    | "pending"
    | "issued"
    | "active"
    | "checked_in"
    | "completed"
    | "invalidated"
    | "transferred"
    | "waitlisted";
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
  method: "qr_scan" | "manual_search" | "manual_entry" | "id_verification";
  result:
    "success" | "already_checked_in" | "invalid_ticket" | "event_not_active";
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
  type: "document" | "link" | "video" | "file" | "newsletter" | "announcement";
  url?: string;
  fileId?: string;
  layer: "common" | "department" | "role";
  departmentId?: string;
  requiredRole?: string;
  designationId?: string;
  tags?: string[];
  uploadedBy: string;
  uploadedByName?: string;
  /**
   * Server-marked placeholder: the caller may know this exists (title +
   * scope) but must not open it. Stubs never carry url, fileId,
   * description, tags, or uploader fields.
   */
  locked?: boolean;
  status?: "pending" | "approved" | "rejected";
  approvedBy?: string;
  approvedAt?: string;
  rejectionReason?: string;
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
  /** Office id the notice was sent as (e.g. "president"), if any. */
  fromOffice?: string;
  letter?: LetterData;
  data?: Record<string, any>;
  read: boolean;
  readAt?: string;
}

export interface PushSubscription {
  $id?: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string;
  createdAt?: string;
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
  category:
    "events" | "workshops" | "hackathons" | "team" | "projects" | "other";
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
  /**
   * Shared by every image of one multi-file upload; the gallery renders one
   * card per album. Missing on legacy rows, which group solo.
   */
  albumId?: string;
  /**
   * The stored file behind imageUrl, when the image was uploaded rather than
   * linked. Approval flips that file's read permission from members-only to
   * public; legacy rows have no id and are already public.
   */
  storageFileId?: string;
}

// ============================================================
// Approval Workflow
// ============================================================

export interface ApprovalWorkflow {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  entityType:
    | "membership"
    | "event"
    | "registration"
    | "promotion"
    | "department_assignment";
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

/**
 * The global tier held in `user_roles` — the single server-owned source of the
 * `admin` and `dev` statuses.
 */
export type UserRoleName = "admin" | "dev";

export interface UserRole {
  $id?: string;
  $createdAt?: string;
  $updatedAt?: string;
  userId: string;
  role: UserRoleName;
  grantedBy: string;
  grantedAt: string;
  reason?: string;
  isActive: boolean;
}

// ============================================================
// Dashboard Types
// ============================================================

export type DashboardPersona =
  "applicant" | "member" | "lead" | "head" | "admin";

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
