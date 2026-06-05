# Mind Mesh Club Operating System — Product Spec

## 1. Vision

A full club operating system for a large multi-unit college tech club. Not a brochure site — a governed platform for onboarding, membership, events, tickets, resources, and leadership operations.

**Scale:** Large multi-unit club (multiple departments/streams, multiple leadership layers, regular events across semesters).

**Tech Stack:** Next.js 16 + Appwrite (auth, database, storage) + TypeScript

---

## 2. Core Architecture Decisions

### 2.1 Account ≠ Membership

Account creation and club membership are **separate states**.

```
Signup (account) → Application Form → Applicant (pending review) → Member (approved)
```

- **Account:** email/password auth. Creates an Appwrite user.
- **Application:** after signup, user fills academic/club profile form, accepts oath, terms, and constitution.
- **Applicant:** can view basic club info, roadmaps, and public resources. Cannot register for member-only events.
- **Member:** approved by admin/senior role. Full member access unlocked.

### 2.2 Hybrid Roles + Powers

Two-layer model:

1. **Status Ladder** (stable access model):
   ```
   applicant → member → core_member → lead → head → admin/dev
   ```
   - `admin`: god-level control over everything
   - `dev`: system developer role (technical access)

2. **Scoped Powers** (narrow operational permissions):
   ```
   membership_approver, event_manager, ticket_verifier,
   blog_creator, blog_reviewer, gallery_manager, gallery_uploader,
   resource_manager, department_head, operations_head,
   profile_moderator, notification_admin, newsletter_manager,
   social_media_manager, pr_manager, design_manager
   ```

3. **Custom Designations** (admin-created badges):
   ```
   "CyberSec Lead", "AI/ML Lead", "Head of Technical Operations",
   "Treasurer", "Secretary", "Social Media Lead", "Design Lead",
   "Editorial Lead", "PR Lead", etc.
   ```
   - Created by admin
   - Assigned to approved members
   - Appear as profile badges
   - Can be revoked
   - Promotion/demotion triggers official letter (email + in-app)

### 2.3 Organization Graph

```
Admin / Dev (god-level / technical)
├── Operations Heads (e.g., Head of Technical Operations)
│   ├── Technical Departments
│   │   ├── AI/ML
│   │   ├── Cybersecurity
│   │   ├── DevOps
│   │   └── Web Development
│   └── ...
├── Operations Heads (e.g., Head of Non-Technical Operations)
│   ├── Content & Communication
│   │   ├── Social Media
│   │   ├── PR & Outreach
│   │   ├── Editorial Board (newsletter/blogs)
│   │   └── Design
│   ├── Operations
│   │   ├── Treasury
│   │   └── Events & Logistics
│   └── ...
└── ...
```

**Departments (College Club Focused):**

| Category | Departments |
|----------|------------|
| Technical | AI/ML, Cybersecurity, DevOps, Web Development |
| Content & Communication | Social Media, PR & Outreach, Editorial Board, Design |
| Operations | Treasury, Events & Logistics |

- Members can **request** department placement
- Admin/heads **approve/assign** after review
- Leads manage their department's core team
- Operations heads sit above multiple departments
- Admin has global override on everything
- Admin can access **ALL dashboards** (applicant, member, lead, head views)

### 2.4 Event System — Fully Separate Event Types

Each event type has its own:
- Creation workflow/form
- Field schema
- Validation rules
- Registration flow
- Ticket behavior
- Verification rules

**Extensible from day one** — not a fixed set. New event types can be added by extending the schema.

### 2.5 Ticket System — Advanced Lifecycle

Tickets are **first-class records** with:
- Unique ticket ID + QR code
- Lifecycle states: `issued → active → checked_in → completed | invalidated | transferred`
- Waitlist promotion states
- Approval-aware issuance (for exclusive events)
- Transfer restrictions
- Multiple entry rules
- Companion tickets
- Rich attendance logs
- Both QR scan and manual verification paths

### 2.6 Progressive Dashboards

Shared app shell, but role-specific landing pages for high-responsibility personas.

### 2.7 Resources — Layered Content

Three axes:
1. **Common Library:** constitution, onboarding docs, club roadmap, announcements
2. **Stream/Department Collections:** AI/ML resources, CyberSec resources, etc.
3. **Role/Designation-Specific:** lead playbooks, head operations guides, admin procedures

### 2.8 Profile Edits — Diff-Audited

- Sensitive fields (phone, URN, address, department prefs, academic details) are audited
- Changes logged with before/after diff (git-style)
- **Mixed enforcement:** some changes apply immediately, some require review
- Admin can revert any change

### 2.9 Communications

Official approvals/promotions produce:
- **In-app notification**
- **Email delivery**
- **Audit history record**

### 2.10 Auth

- Email/password now
- Google + GitHub later (architecture ready)

---

## 3. Membership Status Machine

```
                    ┌─────────────┐
                    │  no_account  │
                    └──────┬──────┘
                           │ signup
                    ┌──────▼──────┐
                    │   account    │
                    └──────┬──────┘
                           │ submit application
                    ┌──────▼──────┐
                    │  applicant   │◄── rejected (can re-apply)
                    └──────┬──────┘
                           │ admin/senior approves
                    ┌──────▼──────┐
                    │   member     │ ◄── receives welcome letter
                    └──────┬──────┘
                           │ promoted
                    ┌──────▼──────┐
                    │ core_member  │
                    └──────┬──────┘
                           │ appointed
                    ┌──────▼──────┐
                    │    lead      │ ◄── receives promotion letter
                    └──────┬──────┘
                           │ appointed
                    ┌──────▼──────┐
                    │    head      │ ◄── receives promotion letter
                    └──────┬──────┘
                           │ system role
                    ┌──────▼──────┐
                    │  admin/dev   │ (admin = god-level, dev = technical)
                    └─────────────┘

    At any point, admin can: ban, deactivate, revert
    All promotions trigger: in-app notification + email letter + audit log
```

**Status transitions:**
- `account → applicant`: submit application form (with pronouns, avatar)
- `applicant → member`: approved by admin or authorized senior → **welcome letter sent**
- `applicant → rejected`: rejected with reason (can re-apply)
- `member → core_member`: promoted by admin → **promotion letter sent**
- `core_member → lead`: appointed by admin/operations head → **promotion letter sent**
- `lead → head`: appointed by admin → **promotion letter sent**
- `head → admin/dev`: system role assignment by super-admin
- Any status → `banned`: admin action
- Any status → `deactivated`: admin action or self-deactivation

**Letters sent on:**
- Membership approval: Welcome letter with membership ID
- Promotion to lead: Lead appointment letter
- Promotion to head: Head appointment letter
- Designation assignment: Designation letter with badge details
- All letters: email + in-app notification + audit log

---

## 4. Permission Catalog

### 4.1 Base Permissions (tied to status)

| Status | Base Permissions |
|--------|-----------------|
| applicant | view_public_content, view_resources, view_roadmaps, view_members |
| member | + register_events, view_member_resources, manage_own_profile, view_all_members |
| core_member | + manage_department_resources |
| lead | + manage_department_team, draft_events |
| head | + approve_events, manage_multiple_departments |
| admin | ALL_PERMISSIONS (god-level, can access ALL dashboards) |
| dev | ALL_PERMISSIONS + system_developer_access |

### 4.2 Scoped Powers (admin-assignable)

| Power | Description | Scope |
|-------|-------------|-------|
| `membership_approver` | Can approve/reject membership applications | global or department |
| `event_manager` | Can create/edit/publish events | global or department |
| `ticket_verifier` | Can verify tickets at events | per-event |
| `blog_creator` | Can create blog posts | global |
| `blog_reviewer` | Can approve/reject blog submissions | global |
| `gallery_manager` | Can manage gallery (approve/delete) | global |
| `gallery_uploader` | Can upload gallery images | global or department |
| `resource_manager` | Can manage resources in scope | global or department |
| `department_head` | Can manage own department | own department |
| `operations_head` | Can manage multiple departments | multiple departments |
| `profile_moderator` | Can view/revert profile changes | global or department |
| `notification_admin` | Can send system notifications | global |
| `newsletter_manager` | Can manage newsletter/editorial content | global |
| `social_media_manager` | Can manage social media content | global |
| `pr_manager` | Can manage PR & outreach content | global |
| `design_manager` | Can manage design assets | global |

### 4.3 Permission Resolution

```
effective_permissions = base_permissions(status) ∪ scoped_powers ∪ department_permissions
admin bypass = true (always has ALL permissions, can access ALL dashboards)
```

---

## 5. Event System

### 5.1 Event Type Architecture

Each event type is a **schema definition** + **workflow config**:

```typescript
interface EventTypeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  
  // What fields does this event type need?
  fields: EventField[];
  
  // What registration rules?
  registration: RegistrationConfig;
  
  // What ticket behavior?
  tickets: TicketConfig;
  
  // What approval workflow?
  workflow: WorkflowConfig;
}

interface EventField {
  name: string;
  type: 'text' | 'number' | 'select' | 'multi-select' | 'boolean' | 'date' | 'file' | 'url' | 'json';
  label: string;
  required: boolean;
  options?: string[];
  validation?: any;
  appliesTo?: 'attendee' | 'organizer' | 'both';
}
```

**Common fields for ALL event types (beyond base):**
- `eventDocs`: Array of {name, url/file} — event documentation, rules, resources
- `externalLinks`: Array of {label, url} — external resources, hackathon websites
- `materials`: Array of {name, type: 'link'|'file', url/fileId} — materials shared with attendees
- `registrationUrl`: string — external registration link (for events like hackathons where registration happens externally)
- `eventWebsite`: string — dedicated event website URL (for hackathons, etc.)
- `contactEmail`: string — event-specific contact

### 5.2 Audience Models

| Audience | Who Can Register | Ticket Issued | Approval Needed |
|----------|-----------------|---------------|-----------------|
| `public` | Anyone with account (including applicants) | Yes, immediately | No |
| `member_only` | Approved members only | Yes, immediately | No |
| `exclusive` | Approved members only | Yes, after approval | Yes (head/admin) |

### 5.3 Event Workflow

```
draft → review → approved → published → active → completed
                ↘ rejected (with reason)
```

- **Leads** can draft events
- **Heads** can approve events in their scope
- **Admin** can override any state
- Events have an **owner** (creator) and **approver** (who approved)

### 5.4 PDF Generation

Admins and heads can generate PDF lists of event registrations:
- List of all registered participants
- Includes: name, email, URN, department, registration date, ticket status
- Filterable by status (confirmed, pending, waitlisted)
- Downloadable as PDF for offline use at events

### 5.5 Seeded Event Types (Initial Set)

| Type | Key Fields | Registration | Special Rules |
|------|-----------|--------------|---------------|
| `workshop` | prerequisites, tools_needed, difficulty_level, max_participants | member_only or public | tools list, prerequisites check |
| `hackathon` | team_size_min, team_size_max, judging_criteria, submission_rules, tracks | member_only or exclusive | team formation, submission portal |
| `seminar` | speakers[], topic_area, certificate_eligible | public or member_only | speaker profiles, attendance tracking |
| `competition` | scoring_rubric, submission_format, rounds[], prizes | exclusive or member_only | multi-round, scoring system |
| `bootcamp` | duration_weeks, curriculum[], homework_required, certification | member_only | progress tracking, completion |
| `meetup` | agenda[], refreshments, dress_code | public | casual format |
| `guest_lecture` | speaker_bio, speaker_company, recording_allowed | public | speaker management |
| `certification_exam` | exam_body, validity_period, retake_policy, passing_score | member_only | score tracking, certificates |

**Architecture is extensible** — new types added by defining schema + config.

---

## 6. Ticket System

### 6.1 Ticket States

```
                    ┌─────────────┐
                    │   pending    │ (approval-required exclusive)
                    └──────┬──────┘
                           │ approval granted
                    ┌──────▼──────┐
                    │   issued     │
                    └──────┬──────┘
                           │ event starts
                    ┌──────▼──────┐
                    │   active     │
                    └──────┬──────┘
                           │ scan/manual check-in
                    ┌──────▼──────┐
                    │ checked_in   │
                    └──────┬──────┘
                           │ event ends
                    ┌──────▼──────┐
                    │  completed   │
                    └─────────────┘

    At any point (except completed):
    ┌─────────────┐
    │ invalidated  │ (admin/verifier action, no-show, rule violation)
    └─────────────┘

    Before check-in:
    ┌─────────────┐
    │ transferred  │ (if transfer allowed by event config)
    └─────────────┘

    When capacity full:
    ┌─────────────┐
    │  waitlisted  │ → promoted to issued when slot opens
    └─────────────┘
```

### 6.2 Ticket Record

```typescript
interface Ticket {
  id: string;
  eventId: string;
  userId: string;
  status: 'pending' | 'issued' | 'active' | 'checked_in' | 'completed' | 'invalidated' | 'transferred' | 'waitlisted';
  qrCode: string; // unique QR data
  ticketCode: string; // human-readable code
  issuedAt: string;
  checkedInAt?: string;
  checkedInBy?: string; // verifier userId
  invalidatedAt?: string;
  invalidatedReason?: string;
  transferredTo?: string;
  transferHistory: TransferRecord[];
  entryCount: number; // for multi-entry events
  maxEntries: number;
  metadata: Record<string, any>; // event-type-specific data
}
```

### 6.3 Verification Flow

1. **QR Scan:** verifier scans QR → system looks up ticket → marks checked_in
2. **Manual Search:** verifier searches by name/email/URN → finds ticket → marks checked_in
3. **Fallback:** if system down, verifier can mark manually and sync later

---

## 7. Dashboard Modules

### 7.1 Applicant Dashboard

| Module | Content |
|--------|---------|
| Application Status | Current status, what's pending, next steps |
| Club Overview | About the club, mission, team |
| Roadmaps | Public learning roadmaps |
| Resources | Common library (constitution, onboarding docs) |
| Events | Public events only |

### 7.2 Member Dashboard

| Module | Content |
|--------|---------|
| Quick Stats | Events attended, tickets active, departments |
| My Events | Registered events, past events, tickets |
| Resources | Common + department-specific resources |
| Events | All member-accessible events |
| Community | Team directory, announcements |
| Profile | Profile with designation badges |

### 7.3 Lead Dashboard

| Module | Content |
|--------|---------|
| Department Overview | Team members, stats, recent activity |
| Event Drafts | Events pending approval |
| Team Management | Add/remove core members (within scope) |
| Resources | Department-specific resources |
| Approvals | Pending items in their scope |

### 7.4 Head Dashboard

| Module | Content |
|--------|---------|
| Operations Overview | Multi-department stats |
| Event Approvals | Events pending approval in their scope |
| Department Health | Activity metrics per department |
| Promotions | Can approve promotions within scope |
| Reports | Aggregated activity reports |

### 7.5 Admin Dashboard

| Module | Content |
|--------|---------|
| System Overview | Total users, members, events, tickets |
| Membership Queue | Pending applications to review |
| Event Management | All events, approval pipeline |
| User Management | Search, view, edit, moderate any profile |
| Designations | Create/manage designations, assign to members |
| Powers | Grant/revoke scoped powers |
| Audit Log | All system changes, profile diffs |
| Resources | Full resource management |
| Notifications | System-wide notification management |

---

## 8. Profile & Audit System

### 8.1 Profile Fields

**Public (visible to all):**
- Name, avatar, designation badges, department

**Member-only (visible to members):**
- Email, phone (if shared)

**Sensitive (reviewer-only or scoped access):**
- URN, address, academic details, application details

### 8.2 Profile Edit Rules

| Field Category | Edit Policy | Review Required |
|---------------|-------------|-----------------|
| Name, avatar | Immediate | No |
| Phone, email | Immediate + audit log | No |
| URN, address | Immediate + audit log | No (but audited) |
| Academic details | Immediate + audit log | No (but audited) |
| Department preference | Requires approval | Yes |
| Role/designation | Admin only | N/A |

### 8.3 Audit Record

```typescript
interface ProfileAudit {
  id: string;
  userId: string;
  changedBy: string;
  field: string;
  oldValue: any;
  newValue: any;
  timestamp: string;
  reason?: string;
  reverted: boolean;
  revertedBy?: string;
  revertedAt?: string;
}
```

---

## 9. Resource Organization

### 9.1 Three-Layer Model

```
Resources
├── Common Library (all users)
│   ├── Constitution
│   ├── Onboarding Docs
│   ├── Club Roadmap
│   ├── Announcements
│   └── General Opportunities
├── Department/Stream Collections
│   ├── AI/ML
│   │   ├── Learning Paths
│   │   ├── Project Guides
│   │   └── Tool Recommendations
│   ├── Cybersecurity
│   ├── DevOps
│   ├── Web Development
│   └── Management
└── Role/Designation-Specific
    ├── Lead Playbooks
    ├── Head Operations Guides
    └── Admin Procedures
```

### 9.2 Access Control

| Layer | Access |
|-------|--------|
| Common Library | All authenticated users |
| Department Collection | Members of that department + leads + heads + admin |
| Role-Specific | Users with that role/designation + admin |

---

## 10. Notification System

### 10.1 Notification Types

| Event | In-App | Email | Letter |
|-------|--------|-------|--------|
| Application approved | Yes | Yes | **Welcome Letter** with membership ID |
| Application rejected | Yes | Yes (with reason) | No |
| Role/status promoted | Yes | Yes | **Promotion Letter** (lead/head/board) |
| Designation assigned | Yes | Yes | **Designation Letter** with badge details |
| Role/designation revoked | Yes | Yes (with reason) | No |
| Event approved | Yes | Yes | No |
| Event rejected | Yes | Yes (with reason) | No |
| Ticket issued | Yes | Yes | No |
| Exclusive event registration approved | Yes | Yes | No |
| Exclusive event registration rejected | Yes | Yes (with reason) | No |
| New announcement | Yes | No | No |
| Department assignment | Yes | Yes | No |
| Gallery image approved | Yes | No | No |
| Blog published | Yes | No | No |

### 10.2 Letter Templates

**Welcome Letter:**
```
Subject: Welcome to Mind Mesh Club!

Dear [Name],

Congratulations! Your membership application has been approved.

Membership ID: MM-YYYY-XXXX
Department: [Assigned Department]
Date of Approval: [Date]

You now have full access to:
- Member-only events and workshops
- Department-specific resources
- Club community and team directory

Welcome aboard!

Best regards,
Mind Mesh Club Administration
```

**Promotion Letter:**
```
Subject: Promotion to [New Role/Designation]

Dear [Name],

We are pleased to inform you that you have been promoted to [Designation].

Previous Role: [Old Role]
New Role: [New Designation]
Effective Date: [Date]
Approved by: [Approver Name]

As a [Designation], you will have additional responsibilities and access to:
- [List of new permissions/access]

Congratulations on this achievement!

Best regards,
Mind Mesh Club Administration
```

### 10.3 Notification Record

```typescript
interface Notification {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  letter?: LetterData; // welcome letter, promotion letter, etc.
  data: Record<string, any>;
  read: boolean;
  createdAt: string;
}

interface LetterData {
  template: 'welcome' | 'promotion' | 'designation' | 'custom';
  subject: string;
  body: string;
  metadata: Record<string, any>;
}
```

---

## 11. Database Schema (Appwrite Collections)

### Collections to Create/Modify

| Collection | Purpose |
|------------|---------|
| `users` | Appwrite auth users (managed by Appwrite) |
| `profiles` | Extended profile data (academic, contact, social, **pronouns**) |
| `applications` | Club membership applications |
| `memberships` | Approved membership records |
| `designations` | Admin-created designation definitions |
| `user_designations` | User-designation assignments |
| `departments` | Department/stream definitions |
| `user_departments` | User-department assignments |
| `powers` | Scoped power definitions |
| `user_powers` | User-power assignments |
| `events` | Event records (base + **docs, materials, external links**) |
| `event_types` | Event type definitions (extensible) |
| `event_type_data` | Event-type-specific field values |
| `registrations` | Event registration records |
| `tickets` | Ticket records with lifecycle |
| `ticket_verifications` | Verification logs |
| `resources` | Resource records |
| `resource_access` | Resource access control |
| `notifications` | In-app notifications (**with letter data**) |
| `audit_logs` | **Comprehensive system-wide audit trail** |
| `approval_workflows` | Multi-step approval records |
| `gallery` | Gallery images (**new**) |
| `blogs` | Blog posts (already exists) |

### Comprehensive Audit Logging

**Every action in the system is logged.** This includes:
- Profile changes (with before/after diff)
- Membership approvals/rejections
- Role promotions/demotions
- Designation assignments/revocations
- Power grants/revocations
- Event creation/approval/publishing
- Ticket issuance/verification/invalidation
- Resource uploads/deletions
- Gallery uploads/approvals
- Blog creation/approval/publishing
- Notification sends
- Any admin action

**Audit log record:**
```typescript
interface AuditLog {
  id: string;
  actorId: string; // who did it
  actorName: string;
  actorRole: string;
  action: string; // e.g., "membership.approve", "event.publish", "profile.update"
  entityType: string; // "user", "event", "ticket", "resource", etc.
  entityId: string;
  details: Record<string, any>; // action-specific data
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}
```

---

## 12. Open Items (To Be Locked)

### 12.1 Seeded Event Types — LOCKED
All 8 event types seeded in v1: Workshop, Hackathon, Seminar, Competition, Bootcamp, Meetup, Guest Lecture, Certification Exam. Architecture is extensible for future types.

### 12.2 Permission Catalog — LOCKED
All 9 scoped powers available in v1: membership_approver, event_manager, ticket_verifier, blog_reviewer, resource_manager, department_head, operations_head, profile_moderator, notification_admin.

### 12.3 Dashboard Modules — LOCKED
All 5 persona dashboards fully built in v1: Applicant, Member, Lead, Head, Admin.

---

*This spec is a living document. Decisions will be locked as they're finalized.*
