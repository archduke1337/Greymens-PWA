# Mind Mesh — Phase 1 Design Document

## Overview

Full core implementation of the club operating system. Covers membership lifecycle, roles/permissions, departments, designations, dashboards, event types, ticket system, notifications, and audit logging.

**Timeline**: ~16 days (solo developer)
**Scope**: Core features (email delivery + PDF generation deferred to Phase 2)

---

## 1. Database Schema

### New Collections (15)

| # | Collection | Purpose | Key Fields |
|---|---|---|---|
| 1 | `profiles` | Extended user data | userId, avatar, pronouns, phone, urn, program, branch, year, skills[], bio |
| 2 | `applications` | Membership applications | userId, status, profileId, oathAccepted, preferredDepartments[] |
| 3 | `memberships` | Approved membership records | userId, applicationId, membershipNumber, status, department |
| 4 | `departments` | Department definitions | name, slug, icon, color, headId, category, isActive |
| 5 | `user_departments` | User-department assignments | userId, departmentId, role, assignedBy, isActive |
| 6 | `designations` | Designation definitions | name, slug, level, category, badgeIcon, badgeColor, isActive |
| 7 | `user_designations` | User-designation assignments | userId, designationId, assignedBy, isActive |
| 8 | `powers` | Power definitions | name, displayName, category, scope |
| 9 | `user_powers` | User-power assignments | userId, powerId, grantedBy, departmentId, isActive |
| 10 | `event_types` | Event type schemas | name, displayName, fields JSON, registrationConfig, ticketConfig, workflowConfig |
| 11 | `tickets` | Ticket records | eventId, userId, registrationId, ticketCode, qrData, status |
| 12 | `ticket_verifications` | Verification audit trail | ticketId, eventId, verifiedBy, method, result |
| 13 | `notifications` | In-app notifications | userId, type, title, body, letter JSON, read |
| 14 | `audit_logs` | System-wide audit trail | actorId, action, entityType, entityId, details JSON |
| 15 | `resources` | Resource records | title, type, url, layer, departmentId, tags[] |

### Modifications to Existing Collections

**`events`** — Add: eventTypeId, slug, audience, ownerId, approvedBy, approvedAt, publishedAt
**`registrations`** — Add: status, metadata

---

## 2. Service Layer

| File | Purpose |
|---|---|
| `lib/profiles.ts` | Profile CRUD, avatar upload |
| `lib/applications.ts` | Application submission, review, approval/rejection |
| `lib/memberships.ts` | Membership records, status management |
| `lib/departments.ts` | Department CRUD, user-department assignments |
| `lib/designations.ts` | Designation CRUD, user-designation assignments |
| `lib/powers.ts` | Power definitions, user-power assignments |
| `lib/notifications.ts` | Create, list, mark read, letter generation |
| `lib/audit.ts` | Log actions, query audit trail |
| `lib/eventTypes.ts` | Event type definitions, dynamic form rendering |
| `lib/tickets.ts` | Ticket generation, QR, check-in, lifecycle |
| `lib/resources.ts` | Resource CRUD, access control |

---

## 3. PermissionContext + Middleware

### PermissionContext
- Fetches user's powers, departments, designations on login
- Resolves permissions using `lib/permissions.ts`
- Provides `hasPermission()`, `hasAnyPermission()`, `hasAllPermissions()`

### Middleware
- Protects `/admin/*` (admin only)
- Protects `/dashboard` (authenticated)
- Protects `/onboarding` (auth + no existing application)
- Redirects logged-in users from `/login`, `/register`

---

## 4. Profile System

### Profile Page
- Header: Avatar, name, pronouns, designation badges
- About: Bio, skills, interests, social links
- Academic: Program, branch, year, semester, URN
- Activity: Events attended, tickets, departments
- Edit mode with audit logging for sensitive fields

---

## 5. Onboarding & Membership

### Onboarding Form (5 sections)
1. Personal Info
2. Academic Details
3. Club Interests
4. Social Profiles
5. Legal & Oath

### Flow
```
/register → /onboarding → submit → creates profiles + applications
→ /dashboard (applicant view)
```

### Admin Review
- Queue page with pending applications
- View full profile + application
- Approve → creates memberships doc, updates status to "member"
- Reject → requires reason

---

## 6. Admin Management

### Sections
- Departments: CRUD, head assignment
- Designations: CRUD, assign/revoke to members
- Powers: Grant/revoke to users with optional scope
- Users: Search, view, edit, promote, demote, ban

---

## 7. Dashboards

### Role-Based Routing
```
/dashboard → checks user status → renders appropriate dashboard
```

### Dashboards
- **Applicant**: Application status, club overview, quick links
- **Member**: Stats, my events, upcoming events, resources
- **Lead**: Department overview, event pipeline, team management
- **Head**: Operations overview, approvals, department health
- **Admin**: System overview, membership queue, quick links

---

## 8. Event Types

### Schema-Driven Forms
Each event type defines fields. Admin form dynamically renders based on selected type.

### 8 Seeded Types
Workshop, Hackathon, Seminar, Competition, Bootcamp, Meetup, Guest Lecture, Certification Exam

---

## 9. Ticket System

### Lifecycle
```
pending → issued → active → checked_in → completed
```

### Components
- QR code generation (via `qrcode` package)
- Check-in page (QR scan + manual search)
- Ticket display on event detail page
- Waitlist + transfer support

---

## 10. Notifications & Audit

### Notifications
- Bell icon in navbar with unread count
- In-app notification creation on key events
- Letter templates for welcome, promotion, designation

### Audit Logging
- Log all system actions with actor, action, entity, details
- Admin audit view with filters

---

## Decision Log

| # | Decision | Why |
|---|---|---|
| 1 | CLI scripts for collections | Repeatable, version-controlled |
| 2 | Service-per-entity pattern | Matches existing codebase |
| 3 | Client-side permission checking | Appwrite sessions are client-side |
| 4 | Single dashboard with role routing | Less duplication |
| 5 | Schema-driven event forms | Extensible |
| 6 | In-app notifications (v1) | Simpler, email deferred |
| 7 | QR via `qrcode` package | Already installed |
| 8 | Middleware for basic auth gates | Practical with client-side auth |
