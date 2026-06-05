# Mind Mesh — Database Schema Design

## Appwrite Collections

All collections use Appwrite's document-based database. Each collection has:
- `$id` (document ID, auto-generated)
- `$createdAt`, `$updatedAt` (Appwrite timestamps)
- Permissions set per collection

---

## 1. profiles

Extended user profile data beyond Appwrite auth.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| avatar | string | no | Profile picture URL (storage file ID) |
| pronouns | string | no | "he/him", "she/her", "they/them", "he/they", "she/they", "prefer_to_say" |
| phone | string | no | Phone number |
| urn | string | no | University roll number |
| program | string | no | e.g., "B.Tech", "MCA" |
| branch | string | no | e.g., "Computer Science", "IT" |
| year | string | no | e.g., "1st", "2nd", "3rd", "4th" |
| semester | string | no | e.g., "1", "2", "3", "4", "5", "6", "7", "8" |
| address | string | no | Residential address |
| dateOfBirth | string | no | ISO date |
| gender | string | no | "male", "female", "other", "prefer_not_to_say" |
| githubUrl | string | no | GitHub profile URL |
| linkedinUrl | string | no | LinkedIn profile URL |
| portfolioUrl | string | no | Personal website/portfolio |
| bio | string | no | Short bio |
| skills | string[] | no | Array of skill tags |
| interests | string[] | no | Array of interest tags |
| experience | string | no | Prior experience description |
| whyJoin | string | no | Why they want to join the club |
| availability | string | no | "full", "partial", "event_only" |
| profileVisibility | string | no | "public", "members_only", "private" |
| showOnAboutPage | boolean | no | Whether to show on About page team section |

**Indexes:** userId (unique)

---

## 2. applications

Club membership applications. Created when user submits the onboarding form.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| status | string | yes | "pending", "approved", "rejected", "reapplied" |
| profileId | string | yes | FK → profiles |
| oathAccepted | boolean | yes | User accepted club oath |
| termsAccepted | boolean | yes | User accepted terms of service |
| constitutionAccepted | boolean | yes | User acknowledged constitution |
| preferredDepartments | string[] | no | Department/stream preferences |
| reviewedBy | string | no | FK → Appwrite auth user (admin/reviewer) |
| reviewedAt | string | no | ISO timestamp |
| rejectionReason | string | no | Why application was rejected |
| submittedAt | string | yes | ISO timestamp |

**Indexes:** userId (unique), status

---

## 3. memberships

Approved membership records. Created when application is approved.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| applicationId | string | yes | FK → applications |
| status | string | yes | "active", "inactive", "suspended", "banned" |
| membershipNumber | string | yes | Unique membership ID (e.g., "MM-2025-001") |
| approvedBy | string | yes | FK → Appwrite auth user |
| approvedAt | string | yes | ISO timestamp |
| department | string | no | Assigned department/stream |
| joinedAt | string | yes | ISO timestamp |

**Indexes:** userId (unique), status, department

---

## 4. departments

Department/stream definitions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | e.g., "AI/ML", "Cybersecurity" |
| slug | string | yes | URL-friendly identifier |
| description | string | no | Department description |
| icon | string | no | Icon or emoji |
| color | string | no | Theme color |
| parentId | string | no | FK → departments (for sub-departments) |
| headId | string | no | FK → Appwrite auth user (operations head) |
| isActive | boolean | yes | Whether department is active |
| displayOrder | number | no | Sort order |

**Indexes:** slug (unique), parentId, isActive

---

## 5. user_departments

User-department membership assignments.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| departmentId | string | yes | FK → departments |
| role | string | yes | "member", "core_member", "lead" |
| assignedBy | string | yes | FK → Appwrite auth user |
| assignedAt | string | yes | ISO timestamp |
| isActive | boolean | yes | Whether assignment is active |

**Indexes:** userId + departmentId (compound, unique), departmentId, role

---

## 6. designations

Admin-created designation definitions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | e.g., "CyberSec Lead", "Secretary" |
| slug | string | yes | URL-friendly identifier |
| description | string | no | What this designation means |
| level | number | yes | Hierarchy level (1=lowest, 10=highest) |
| category | string | yes | "department", "operations", "executive", "special" |
| departmentId | string | no | FK → departments (for department-specific designations) |
| badgeIcon | string | no | Badge icon URL |
| badgeColor | string | no | Badge color |
| isActive | boolean | yes | Whether designation is active |
| maxHolders | number | no | Max people who can hold this (null = unlimited) |

**Indexes:** slug (unique), level, category, departmentId

---

## 7. user_designations

User-designation assignments.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| designationId | string | yes | FK → designations |
| assignedBy | string | yes | FK → Appwrite auth user |
| assignedAt | string | yes | ISO timestamp |
| revokedAt | string | no | ISO timestamp |
| revokedBy | string | no | FK → Appwrite auth user |
| isActive | boolean | yes | Whether assignment is active |

**Indexes:** userId + designationId (compound, unique), designationId, isActive

---

## 8. powers

Scoped power definitions.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | e.g., "membership_approver" |
| displayName | string | yes | Human-readable name |
| description | string | no | What this power allows |
| category | string | yes | "membership", "events", "tickets", "content", "resources", "admin" |
| scope | string | yes | "global", "department", "own" |

**Indexes:** name (unique), category

---

## 9. user_powers

User-power assignments.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| powerId | string | yes | FK → powers |
| grantedBy | string | yes | FK → Appwrite auth user |
| grantedAt | string | yes | ISO timestamp |
| departmentId | string | no | FK → departments (for scoped powers) |
| expiresAt | string | no | ISO timestamp (null = permanent) |
| isActive | boolean | yes | Whether power is active |

**Indexes:** userId + powerId (compound, unique), userId, departmentId

---

## 10. events

Event records (base schema). All event types share these common fields.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Event title |
| slug | string | yes | URL-friendly identifier |
| description | string | yes | Event description |
| image | string | no | Event poster URL |
| eventTypeId | string | yes | FK → event_types |
| status | string | yes | "draft", "review", "approved", "published", "active", "completed", "cancelled" |
| audience | string | yes | "public", "member_only", "exclusive" |
| date | string | yes | Event date (ISO) |
| time | string | yes | Event time |
| endDate | string | no | End date for multi-day events |
| venue | string | yes | Venue name |
| location | string | yes | Location/address |
| capacity | number | yes | Max participants |
| registered | number | yes | Current registration count |
| price | number | yes | Ticket price (0 = free) |
| discountPrice | number | no | Discounted price |
| organizerName | string | yes | Organizer name |
| organizerAvatar | string | no | Organizer avatar URL |
| ownerId | string | yes | FK → Appwrite auth user (creator) |
| approvedBy | string | no | FK → Appwrite auth user (approver) |
| approvedAt | string | no | ISO timestamp |
| publishedAt | string | no | ISO timestamp |
| tags | string[] | no | Event tags |
| isFeatured | boolean | yes | Featured on homepage |
| isPremium | boolean | yes | Premium event flag |
| eventDocs | json | no | Array of {name, url/fileId} — event documentation, rules |
| externalLinks | json | no | Array of {label, url} — external resources |
| materials | json | no | Array of {name, type: 'link'\|'file', url/fileId} — materials for attendees |
| registrationUrl | string | no | External registration link (for hackathons, etc.) |
| eventWebsite | string | no | Dedicated event website URL |
| contactEmail | string | no | Event-specific contact email |

**Indexes:** slug (unique), eventTypeId, status, audience, date, ownerId

---

## 11. event_types

Event type definitions (extensible).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| name | string | yes | e.g., "workshop", "hackathon" |
| displayName | string | yes | e.g., "Workshop", "Hackathon" |
| description | string | no | What this event type is |
| icon | string | no | Icon/emoji |
| fields | json | yes | Array of field definitions (see spec) |
| registrationConfig | json | yes | Registration rules |
| ticketConfig | json | yes | Ticket behavior rules |
| workflowConfig | json | yes | Approval workflow rules |
| isActive | boolean | yes | Whether type is available |
| displayOrder | number | no | Sort order |

**Indexes:** name (unique), isActive

---

## 12. event_type_data

Event-type-specific field values. Links to events.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string | yes | FK → events |
| eventTypeId | string | yes | FK → event_types |
| fieldData | json | yes | Key-value pairs for event-type-specific fields |

**Indexes:** eventId (unique)

---

## 13. registrations

Event registration records.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string | yes | FK → events |
| userId | string | yes | FK → Appwrite auth user |
| status | string | yes | "pending", "approved", "rejected", "cancelled", "waitlisted" |
| registeredAt | string | yes | ISO timestamp |
| approvedBy | string | no | FK → Appwrite auth user |
| approvedAt | string | no | ISO timestamp |
| rejectionReason | string | no | Why registration was rejected |
| metadata | json | no | Event-type-specific registration data |

**Indexes:** eventId + userId (compound, unique), userId, status

---

## 14. tickets

Ticket records with full lifecycle.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| eventId | string | yes | FK → events |
| userId | string | yes | FK → Appwrite auth user |
| registrationId | string | yes | FK → registrations |
| ticketCode | string | yes | Human-readable code (e.g., "MM-EVT-001-042") |
| qrData | string | yes | QR code data (unique) |
| status | string | yes | "pending", "issued", "active", "checked_in", "completed", "invalidated", "transferred", "waitlisted" |
| issuedAt | string | no | ISO timestamp |
| checkedInAt | string | no | ISO timestamp |
| checkedInBy | string | no | FK → Appwrite auth user (verifier) |
| invalidatedAt | string | no | ISO timestamp |
| invalidatedReason | string | no | Why ticket was invalidated |
| transferredTo | string | no | FK → Appwrite auth user |
| transferHistory | json | no | Array of transfer records |
| entryCount | number | yes | Current entry count |
| maxEntries | number | yes | Max allowed entries (1 = single entry) |
| metadata | json | no | Event-type-specific ticket data |

**Indexes:** eventId + userId (compound), ticketCode (unique), qrData (unique), status

---

## 15. ticket_verifications

Verification logs for audit trail.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| ticketId | string | yes | FK → tickets |
| eventId | string | yes | FK → events |
| verifiedBy | string | yes | FK → Appwrite auth user |
| method | string | yes | "qr_scan", "manual_search", "manual_entry" |
| result | string | yes | "success", "already_checked_in", "invalid_ticket", "event_not_active" |
| verifiedAt | string | yes | ISO timestamp |
| metadata | json | no | Additional verification context |

**Indexes:** ticketId, eventId, verifiedBy

---

## 16. resources

Resource records.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Resource title |
| description | string | no | Resource description |
| type | string | yes | "document", "link", "video", "file", "announcement" |
| url | string | no | External URL |
| fileId | string | no | FK → Appwrite storage file |
| layer | string | yes | "common", "department", "role" |
| departmentId | string | no | FK → departments (for department-layer resources) |
| designationId | string | no | FK → designations (for role-layer resources) |
| tags | string[] | no | Resource tags |
| uploadedBy | string | yes | FK → Appwrite auth user |
| isActive | boolean | yes | Whether resource is visible |
| displayOrder | number | no | Sort order |

**Indexes:** layer, departmentId, designationId, isActive

---

## 17. notifications

In-app notifications with optional letter data.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| userId | string | yes | FK → Appwrite auth user |
| type | string | yes | Notification type (see spec) |
| title | string | yes | Notification title |
| body | string | yes | Notification body |
| letter | json | no | Letter data (welcome, promotion, designation) |
| data | json | no | Related entity IDs |
| read | boolean | yes | Whether notification is read |
| readAt | string | no | ISO timestamp |
| createdAt | string | yes | ISO timestamp |

**Letter data structure:**
```json
{
  "template": "welcome|promotion|designation|custom",
  "subject": "Welcome to Mind Mesh Club!",
  "body": "Dear Rahul, congratulations!...",
  "metadata": {
    "membershipId": "MM-2025-0189",
    "designation": "AI/ML Lead",
    "approvedBy": "Admin Name"
  }
}
```

**Indexes:** userId + read (compound), createdAt

---

## 18. audit_logs

**Comprehensive system-wide audit trail.** Every action in the system is logged.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| actorId | string | yes | FK → Appwrite auth user (who did it) |
| actorName | string | yes | Actor's display name |
| actorRole | string | yes | Actor's status/role at time of action |
| action | string | yes | Action identifier (e.g., "membership.approve", "event.publish") |
| entityType | string | yes | "user", "event", "ticket", "resource", "blog", "gallery", etc. |
| entityId | string | yes | FK → the entity affected |
| details | json | no | Action-specific data (before/after values, reasons, etc.) |
| ipAddress | string | no | Actor's IP address |
| userAgent | string | no | Actor's browser/client |
| timestamp | string | yes | ISO timestamp |

**Action categories:**
- `membership.*` — approve, reject, ban, deactivate
- `profile.*` — update, revert
- `designation.*` — assign, revoke
- `power.*` — grant, revoke
- `event.*` — create, update, approve, reject, publish, cancel
- `registration.*` — register, approve, reject, cancel
- `ticket.*` — issue, verify, invalidate, transfer
- `resource.*` — upload, update, delete
- `blog.*` — create, approve, reject, publish
- `gallery.*` — upload, approve, reject, delete
- `notification.*` — send
- `department.*` — assign, remove
- `system.*` — config change, backup, etc.

**Indexes:** actorId, entityType, entityId, action, timestamp

---

## 19. approval_workflows

Multi-step approval records.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| entityType | string | yes | "membership", "event", "registration", "promotion", "department_assignment" |
| entityId | string | yes | FK → the entity being approved |
| currentStep | number | yes | Current step in the workflow |
| totalSteps | number | yes | Total steps required |
| steps | json | yes | Array of step definitions |
| status | string | yes | "pending", "in_progress", "approved", "rejected" |
| initiatedBy | string | yes | FK → Appwrite auth user |
| initiatedAt | string | yes | ISO timestamp |
| completedAt | string | no | ISO timestamp |

**Indexes:** entityType + entityId (compound), status

---

## 20. gallery

Gallery images for the club.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| title | string | yes | Image title |
| description | string | no | Image description |
| imageUrl | string | yes | Image URL (storage file ID) |
| thumbnailUrl | string | no | Thumbnail URL |
| category | string | yes | "events", "workshops", "hackathons", "team", "projects", "other" |
| uploadedBy | string | yes | FK → Appwrite auth user |
| eventId | string | no | FK → events (if event-specific) |
| departmentId | string | no | FK → departments (if department-specific) |
| status | string | yes | "pending", "approved", "rejected" |
| approvedBy | string | no | FK → Appwrite auth user |
| approvedAt | string | no | ISO timestamp |
| rejectionReason | string | no | Why image was rejected |
| tags | string[] | no | Image tags |
| isActive | boolean | yes | Whether image is visible |
| displayOrder | number | no | Sort order |

**Indexes:** category, status, uploadedBy, eventId, isActive

---

## Collection Relationships

```
users (Appwrite Auth)
  ├── profiles (1:1)
  ├── applications (1:many)
  ├── memberships (1:1)
  ├── user_departments (1:many)
  ├── user_designations (1:many)
  ├── user_powers (1:many)
  ├── events (1:many, as owner)
  ├── registrations (1:many)
  ├── tickets (1:many)
  ├── notifications (1:many)
  ├── audit_logs (1:many, as actor)
  └── gallery (1:many, as uploader)

departments
  ├── user_departments (1:many)
  ├── designations (1:many)
  ├── resources (1:many)
  ├── gallery (1:many)
  └── events (via department scope)

events
  ├── event_type_data (1:1)
  ├── registrations (1:many)
  ├── tickets (1:many)
  ├── ticket_verifications (1:many)
  └── gallery (1:many)

event_types
  ├── events (1:many)
  └── event_type_data (1:many)

designations
  ├── user_designations (1:many)
  └── resources (1:many)

powers
  └── user_powers (1:many)

tickets
  └── ticket_verifications (1:many)

resources
  └── resource_access (1:many)
```
users (Appwrite Auth)
  ├── profiles (1:1)
  ├── applications (1:many)
  ├── memberships (1:1)
  ├── user_departments (1:many)
  ├── user_designations (1:many)
  ├── user_powers (1:many)
  ├── events (1:many, as owner)
  ├── registrations (1:many)
  ├── tickets (1:many)
  ├── notifications (1:many)
  └── audit_logs (1:many, as subject)

departments
  ├── user_departments (1:many)
  ├── designations (1:many)
  ├── resources (1:many)
  └── events (via department scope)

events
  ├── event_type_data (1:1)
  ├── registrations (1:many)
  ├── tickets (1:many)
  └── ticket_verifications (1:many)

event_types
  ├── events (1:many)
  └── event_type_data (1:many)

designations
  ├── user_designations (1:many)
  └── resources (1:many)

powers
  └── user_powers (1:many)

tickets
  └── ticket_verifications (1:many)
```

---

## Appwrite Permissions Strategy

| Collection | Read | Write | Delete |
|------------|------|-------|--------|
| profiles | authenticated | owner + admin | admin |
| applications | owner + admin + reviewer | owner (own) + admin | admin |
| memberships | owner + admin | admin | admin |
| departments | authenticated | admin + operations_head | admin |
| user_departments | authenticated | admin + department_head | admin |
| designations | authenticated | admin | admin |
| user_designations | authenticated | admin | admin |
| powers | authenticated | admin | admin |
| user_powers | authenticated | admin | admin |
| events | authenticated | owner + admin + event_manager | admin |
| event_types | authenticated | admin | admin |
| event_type_data | authenticated | owner + admin | admin |
| registrations | owner + admin | owner (cancel) + admin | admin |
| tickets | owner + admin + ticket_verifier | admin + ticket_verifier | admin |
| ticket_verifications | admin + ticket_verifier | admin + ticket_verifier | admin |
| resources | authenticated (layer-gated) | admin + resource_manager | admin |
| notifications | owner | system (API) | owner |
| audit_logs | admin + profile_moderator | system (API) | admin |
| approval_workflows | involved parties + admin | admin | admin |

**Note:** Appwrite collection permissions handle basic access control. Business logic (department scoping, power checking) is enforced in API routes and server components.
