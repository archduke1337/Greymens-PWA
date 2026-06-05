# Mind Mesh — Event Type Schemas

## Architecture

Each event type defines:
1. **Fields** — what data it collects (beyond the base event schema)
2. **Registration Config** — who can register, what rules apply
3. **Ticket Config** — ticket behavior, verification rules
4. **Workflow Config** — approval chain, publish rules

---

## 1. Workshop

**Purpose:** Hands-on learning sessions with tools, prerequisites, and practical exercises.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| prerequisites | string[] | no | What attendees should know beforehand |
| toolsNeeded | string[] | no | Software/tools to install before |
| difficultyLevel | "beginner" \| "intermediate" \| "advanced" | yes | Skill level required |
| maxParticipants | number | no | Cap on attendees (may differ from capacity) |
| durationHours | number | yes | Workshop duration in hours |
| handsOn | boolean | yes | Whether it includes hands-on exercises |
| certificatesProvided | boolean | yes | Whether certificates are given |
| materialsUrl | string | no | Link to pre-workshop materials |
| recordingAllowed | boolean | yes | Whether recording is permitted |

### Registration Config

```json
{
  "defaultAudience": "member_only",
  "allowGuestRegistration": false,
  "requiresApproval": false,
  "maxTeamSize": 1,
  "waitlistEnabled": true,
  "cancellationAllowed": true,
  "cancellationDeadline": "24h_before_event"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": false,
  "verificationMethods": ["qr_scan", "manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": true
}
```

---

## 2. Hackathon

**Purpose:** Multi-hour coding competitions with teams, tracks, judging, and submissions.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| teamSizeMin | number | yes | Minimum team size |
| teamSizeMax | number | yes | Maximum team size |
| tracks | string[] | yes | Competition tracks/themes |
| judgingCriteria | json | yes | Array of {criterion, weight, description} |
| submissionRules | string | yes | Rules for submissions |
| submissionDeadline | string | no | When submissions close (may be after event ends) |
| prizes | json | no | Array of {place, prize, description} |
| sponsors | string[] | no | Event sponsors |
| codeOfConduct | string | no | Code of conduct URL |
| mentorsAvailable | boolean | yes | Whether mentors are available |
| durationHours | number | yes | Total duration |
| teamFormationAllowed | boolean | yes | Whether solo participants can be matched |

### Registration Config

```json
{
  "defaultAudience": "member_only",
  "allowGuestRegistration": false,
  "requiresApproval": false,
  "maxTeamSize": "dynamic",
  "teamFormationEnabled": true,
  "waitlistEnabled": true,
  "cancellationAllowed": true,
  "cancellationDeadline": "48h_before_event"
}
```

### Ticket Config

```json
{
  "ticketType": "team",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": false,
  "verificationMethods": ["qr_scan", "manual_search"],
  "teamTicket": true
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": false
}
```

---

## 3. Seminar

**Purpose:** Educational sessions with speakers, topic-focused presentations, and knowledge sharing.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| speakers | json | yes | Array of {name, bio, company, avatar, topic} |
| topicArea | string | yes | Main topic area |
| certificateEligible | boolean | yes | Whether attendance certificates are given |
| recordingAllowed | boolean | yes | Whether recording is permitted |
| presentationSlidesUrl | string | no | Link to slides |
| handoutUrl | string | no | Additional materials |
| targetAudience | string | no | Who should attend |
| qnaAllowed | boolean | yes | Whether Q&A session is included |

### Registration Config

```json
{
  "defaultAudience": "public",
  "allowGuestRegistration": true,
  "requiresApproval": false,
  "maxTeamSize": 1,
  "waitlistEnabled": true,
  "cancellationAllowed": true,
  "cancellationDeadline": "12h_before_event"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": true,
  "verificationMethods": ["qr_scan", "manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": true
}
```

---

## 4. Competition

**Purpose:** Competitive events with scoring, rounds, submissions, and prizes.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| scoringRubric | json | yes | Array of {criterion, maxScore, description} |
| submissionFormat | string | yes | Required submission format |
| rounds | json | yes | Array of {name, description, deadline, type} |
| prizes | json | no | Array of {place, prize, description} |
| rulesUrl | string | no | Competition rules URL |
| allowLateSubmission | boolean | yes | Whether late submissions are accepted |
| penaltyPerDay | number | no | Points deducted per day late |
| teamCompetition | boolean | yes | Whether this is team-based |
| teamSizeLimit | number | no | Max team size if team-based |

### Registration Config

```json
{
  "defaultAudience": "member_only",
  "allowGuestRegistration": false,
  "requiresApproval": false,
  "maxTeamSize": "dynamic",
  "waitlistEnabled": false,
  "cancellationAllowed": true,
  "cancellationDeadline": "before_first_round"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": false,
  "verificationMethods": ["qr_scan", "manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": false
}
```

---

## 5. Bootcamp

**Purpose:** Multi-day intensive training programs with curriculum, homework, and certification.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| durationWeeks | number | yes | Duration in weeks |
| curriculum | json | yes | Array of {week, topic, description, materials} |
| homeworkRequired | boolean | yes | Whether homework is assigned |
| certificationProvided | boolean | yes | Whether certification is given |
| passingCriteria | string | no | What's required to pass |
| mentorAssigned | string | no | Mentor name/ID |
| projectRequired | boolean | yes | Whether a final project is required |
| attendanceRequired | boolean | yes | Whether attendance is tracked |
| minAttendancePercent | number | no | Minimum attendance to pass |
| toolsNeeded | string[] | no | Software/tools to install |
| difficultyLevel | "beginner" \| "intermediate" \| "advanced" | yes | Skill level |

### Registration Config

```json
{
  "defaultAudience": "member_only",
  "allowGuestRegistration": false,
  "requiresApproval": true,
  "maxTeamSize": 1,
  "waitlistEnabled": true,
  "cancellationAllowed": true,
  "cancellationDeadline": "48h_before_start"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": false,
  "verificationMethods": ["qr_scan", "manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": false
}
```

---

## 6. Meetup

**Purpose:** Casual networking and discussion events.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| agenda | json | no | Array of {time, activity, description} |
| refreshments | boolean | yes | Whether refreshments are provided |
| dressCode | string | no | Dress code if any |
| networkingFocused | boolean | yes | Whether it's primarily for networking |
| informalFormat | boolean | yes | Whether format is informal |

### Registration Config

```json
{
  "defaultAudience": "public",
  "allowGuestRegistration": true,
  "requiresApproval": false,
  "maxTeamSize": 1,
  "waitlistEnabled": false,
  "cancellationAllowed": true,
  "cancellationDeadline": "6h_before_event"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": false,
  "transferAllowed": false,
  "verificationMethods": ["manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager", "member"],
  "approvalRequired": false,
  "approverRoles": ["head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": true
}
```

---

## 7. Guest Lecture

**Purpose:** External expert presentations and industry talks.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| speakerBio | string | yes | Speaker biography |
| speakerCompany | string | yes | Speaker's company/organization |
| speakerAvatar | string | no | Speaker photo URL |
| speakerLinkedIn | string | no | Speaker LinkedIn URL |
| topicArea | string | yes | Lecture topic area |
| recordingAllowed | boolean | yes | Whether recording is permitted |
| certificateEligible | boolean | yes | Whether certificates are given |
| targetAudience | string | no | Who should attend |
| followUpSession | boolean | yes | Whether there's a follow-up session |
| qnaAllowed | boolean | yes | Whether Q&A is included |

### Registration Config

```json
{
  "defaultAudience": "public",
  "allowGuestRegistration": true,
  "requiresApproval": false,
  "maxTeamSize": 1,
  "waitlistEnabled": true,
  "cancellationAllowed": true,
  "cancellationDeadline": "12h_before_event"
}
```

### Ticket Config

```json
{
  "ticketType": "standard",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": true,
  "verificationMethods": ["qr_scan", "manual_search"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": true
}
```

---

## 8. Certification Exam

**Purpose:** Formal certification examinations with scoring and validity tracking.

### Extra Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| examBody | string | yes | Certifying organization |
| validityPeriod | string | yes | How long the certification is valid |
| retakePolicy | string | yes | When retakes are allowed |
| passingScore | number | yes | Minimum score to pass |
| maxScore | number | yes | Maximum possible score |
| examDuration | number | yes | Exam duration in minutes |
| examFormat | string | yes | "online", "offline", "hybrid" |
| studyMaterialsUrl | string | no | Link to study materials |
| practiceExamUrl | string | no | Link to practice exam |
| certificateTemplate | string | no | Certificate template URL |

### Registration Config

```json
{
  "defaultAudience": "member_only",
  "allowGuestRegistration": false,
  "requiresApproval": true,
  "maxTeamSize": 1,
  "waitlistEnabled": false,
  "cancellationAllowed": true,
  "cancellationDeadline": "48h_before_exam"
}
```

### Ticket Config

```json
{
  "ticketType": "exam_seat",
  "maxEntries": 1,
  "qrEnabled": true,
  "transferAllowed": false,
  "verificationMethods": ["qr_scan", "manual_search", "id_verification"]
}
```

### Workflow Config

```json
{
  "draftPermission": ["lead", "event_manager"],
  "approvalRequired": true,
  "approverRoles": ["head", "operations_head", "admin"],
  "publishAfterApproval": true,
  "autoActivateAtEventTime": false
}
```

---

## Field Type Reference

| Type | Description | Example |
|------|-------------|---------|
| `text` | Single-line text | "React Basics" |
| `textarea` | Multi-line text | "Detailed description..." |
| `number` | Numeric value | 50 |
| `boolean` | True/false | true |
| `select` | Single choice from options | "beginner" |
| `multi-select` | Multiple choices | ["React", "Node.js"] |
| `date` | ISO date string | "2025-03-15" |
| `url` | URL string | "https://..." |
| `file` | File upload | File reference |
| `json` | Structured data | { ... } |
| `array` | List of items | ["item1", "item2"] |

---

## Event Type Registration

To add a new event type:

1. Add a document to the `event_types` collection with the schema definition
2. The admin UI automatically renders the form based on `fields`
3. Registration and ticket behavior are governed by `registrationConfig` and `ticketConfig`
4. The workflow follows `workflowConfig`

No code changes needed — the system is schema-driven.
