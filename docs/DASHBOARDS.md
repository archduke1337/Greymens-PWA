# Mind Mesh — Dashboard Modules

## Architecture: Progressive Dashboards

```
┌─────────────────────────────────────────────────────────┐
│                    Shared App Shell                      │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐   │
│  │  Navbar  │  │ Sidebar │  │ Content │  │ Footer  │   │
│  └─────────┘  └─────────┘  └─────────┘  └─────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │           Role-Specific Landing Page             │   │
│  │                                                  │   │
│  │  Applicant → Application Status Dashboard        │   │
│  │  Member     → Member Dashboard                   │   │
│  │  Lead       → Lead Dashboard                     │   │
│  │  Head       → Head Dashboard                     │   │
│  │  Admin      → Admin Dashboard                    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Applicant Dashboard

**Access:** users with `applicant` status
**Route:** `/dashboard`

### Modules

| Module | Priority | Content |
|--------|----------|---------|
| Application Status | High | Current status, progress bar, next steps |
| Club Overview | High | About the club, mission, values |
| Roadmaps | Medium | Public learning roadmaps |
| Resources | Medium | Common library (constitution, onboarding docs) |
| Events | Low | Public events only |

### Module Details

#### Application Status Card
```
┌─────────────────────────────────────────┐
│  Application Status                     │
│  ┌─────────────────────────────────┐   │
│  │  ████████░░░░  Under Review     │   │
│  └─────────────────────────────────┘   │
│                                         │
│  Submitted: Mar 15, 2025                │
│  Last Updated: Mar 16, 2025             │
│                                         │
│  [View Application] [Edit Application]  │
└─────────────────────────────────────────┘
```

#### Quick Actions
- View Club Constitution
- Browse Roadmaps
- View Public Events
- Complete Profile (if incomplete)

#### Status States
- **Pending:** "Your application is under review"
- **Rejected:** "Application rejected. [Reason]. [Re-apply]"
- **Approved:** Redirect to member dashboard

---

## 2. Member Dashboard

**Access:** users with `member` status or higher
**Route:** `/dashboard`

### Modules

| Module | Priority | Content |
|--------|----------|---------|
| Quick Stats | High | Events attended, tickets, departments |
| My Events | High | Registered events, upcoming, past |
| Upcoming Events | High | Next events to register for |
| Resources | Medium | Common + department resources |
| Announcements | Medium | Latest club announcements |
| Profile | Medium | Profile with designation badges |
| Community | Low | Team directory |

### Module Details

#### Quick Stats Row
```
┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐
│ Events  │  │ Tickets │  │ Depts   │  │ Badges  │
│   12    │  │    3    │  │  AI/ML  │  │    2    │
│ Attended│  │ Active  │  │ Member  │  │ earned  │
└─────────┘  └─────────┘  └─────────┘  └─────────┘
```

#### My Events Section
- Tabs: Upcoming | Past | Saved
- Event cards with date, venue, status
- Quick actions: View Ticket, Cancel Registration

#### Upcoming Events Feed
- Next 5 events user can register for
- "Register" button for each
- Shows audience type (public/member/exclusive)

#### Resources Quick Access
- Recently added resources
- Department-specific resources
- "View All Resources" link

#### Announcements
- Latest 3 announcements
- Read/unread status
- "View All" link

---

## 3. Lead Dashboard

**Access:** users with `lead` status or designations with lead level
**Route:** `/dashboard`

### Modules

| Module | Priority | Content |
|--------|----------|---------|
| Department Overview | High | Team members, stats |
| Event Pipeline | High | Drafts pending approval |
| Team Management | High | Core team members |
| Pending Approvals | High | Registration approvals needed |
| Resources | Medium | Department resources |
| Activity Feed | Medium | Recent department activity |

### Module Details

#### Department Overview Card
```
┌─────────────────────────────────────────┐
│  AI/ML Department                       │
│                                         │
│  Members: 24  │  Events: 8  │  Active: 6│
│                                         │
│  Recent Activity:                       │
│  • 3 new members this week              │
│  • 2 events planned                     │
│  • 5 resources uploaded                 │
└─────────────────────────────────────────┘
```

#### Event Pipeline
- Events in draft status (created by team)
- Events pending approval
- Quick actions: Edit, Submit for Approval, Delete

#### Team Management
- List of core team members
- Add/remove core members
- Assign roles within department

#### Pending Approvals
- Member registrations for exclusive events
- Department resource uploads
- Quick approve/reject actions

#### Quick Actions
- Create New Event
- Upload Resource
- View Department Stats
- Manage Team

---

## 4. Head Dashboard

**Access:** users with `head` status or operations_head powers
**Route:** `/dashboard`

### Modules

| Module | Priority | Content |
|--------|----------|---------|
| Operations Overview | High | Multi-department stats |
| Event Approvals | High | Events needing approval |
| Department Health | High | Activity per department |
| Membership Queue | High | Pending applications |
| Promotions | Medium | Pending promotions |
| Reports | Medium | Aggregated reports |

### Module Details

#### Operations Overview
```
┌─────────────────────────────────────────┐
│  Operations Overview                    │
│                                         │
│  Departments: 6  │  Members: 156        │
│  Events This Month: 12                  │
│  Pending Approvals: 8                   │
│                                         │
│  Department Breakdown:                  │
│  ┌───────┐  ┌───────┐  ┌───────┐      │
│  │ AI/ML │  │ Cyber │  │ DevOps│      │
│  │  24   │  │  18   │  │  12   │      │
│  └───────┘  └───────┘  └───────┘      │
└─────────────────────────────────────────┘
```

#### Event Approvals Queue
- Events from all managed departments
- Status: pending approval
- Quick actions: Approve, Reject, Request Changes
- Shows: event type, creator, department

#### Department Health Cards
- Each department as a card
- Shows: member count, event count, recent activity
- Drill-down to department details

#### Membership Queue
- Pending applications from managed departments
- Quick review: View Profile, Approve, Reject

#### Promotions
- Pending designation assignments
- Power grant requests

#### Reports
- Event attendance trends
- Membership growth
- Department performance

---

## 5. Admin Dashboard

**Access:** users with `admin` status
**Route:** `/admin`

### Modules

| Module | Priority | Content |
|--------|----------|---------|
| System Overview | High | Total users, members, events |
| Membership Queue | High | All pending applications |
| Event Management | High | All events, approval pipeline |
| User Management | High | Search, view, edit users |
| Designations | High | Create/manage designations |
| Powers | High | Grant/revoke powers |
| Audit Log | High | All system changes |
| Department Management | Medium | Manage departments |
| Resources | Medium | Full resource management |
| Notifications | Medium | System notifications |
| Reports | Low | Analytics and reports |

### Module Details

#### System Overview
```
┌─────────────────────────────────────────┐
│  System Overview                        │
│                                         │
│  Total Users: 234                       │
│  Members: 189  │  Applicants: 45        │
│  Events: 28    │  Active: 6             │
│  Tickets: 456  │  Resources: 89         │
│                                         │
│  Recent Activity:                       │
│  • 12 new applications today            │
│  • 3 events approved                    │
│  • 8 members promoted                   │
└─────────────────────────────────────────┘
```

#### Membership Queue (Full)
- All pending applications across all departments
- Filter by: department, date, status
- Bulk actions: approve, reject
- Quick view: full profile, application details

#### Event Management (Full)
- All events with status filter
- Approval pipeline: draft → review → approved → published
- Quick actions: edit, approve, reject, publish, cancel

#### User Management
- Search by name, email, URN, department
- View full profile (all data)
- Edit any profile
- Moderate: ban, deactivate, revert changes
- View audit trail

#### Designation Management
- Create new designations
- Edit existing designations
- Assign designations to members
- Revoke designations
- View designation holders

#### Power Management
- Grant powers to users
- Revoke powers
- View all power holders
- Filter by power type

#### Audit Log
- All profile changes
- All approval/rejection actions
- All power grants/revocations
- Filter by: user, action type, date
- Export capability

#### Department Management
- Create/edit departments
- Assign department heads
- View department stats
- Manage department resources

---

## 6. Navigation Structure

### Applicant Nav
```
Dashboard
├── Application Status
├── Club Overview
├── Roadmaps
├── Resources (Common)
├── Events (Public)
└── Profile
```

### Member Nav
```
Dashboard
├── My Events
├── Events
├── Resources
├── Departments
├── Announcements
├── Community
└── Profile
```

### Lead Nav
```
Dashboard
├── Department
│   ├── Overview
│   ├── Team
│   └── Resources
├── Events
│   ├── My Events
│   ├── Create Event
│   └── Event Pipeline
├── Approvals
├── Resources
└── Profile
```

### Head Nav
```
Dashboard
├── Operations
│   ├── Overview
│   ├── Departments
│   └── Reports
├── Approvals
│   ├── Events
│   ├── Memberships
│   └── Promotions
├── Events (All)
├── Members
├── Resources
└── Profile
```

### Admin Nav
```
Admin
├── Dashboard
├── Membership
│   ├── Queue
│   ├── Approved
│   └── Rejected
├── Events
│   ├── All Events
│   ├── Create Event
│   └── Approval Pipeline
├── Users
│   ├── All Users
│   ├── Search
│   └── Audit Log
├── Organization
│   ├── Departments
│   ├── Designations
│   ├── Powers
│   └── Promotions
├── Content
│   ├── Resources
│   ├── Blogs
│   └── Announcements
├── Reports
└── Settings
```

---

## 7. Shared Components

| Component | Description |
|-----------|-------------|
| `StatsCard` | Reusable stat display card |
| `ActivityFeed` | Timeline of recent activities |
| `QuickActions` | Grid of action buttons |
| `ApprovalQueue` | List of items needing approval |
| `UserCard` | User info card with avatar |
| `EventCard` | Event info card |
| `DepartmentCard` | Department summary card |
| `DesignationBadge` | Badge with icon and label |
| `PermissionGate` | Component-level permission check |

---

## 8. Implementation Checklist

- [ ] Create shared dashboard layout component
- [ ] Create role-based dashboard router
- [ ] Build Applicant Dashboard page
- [ ] Build Member Dashboard page
- [ ] Build Lead Dashboard page
- [ ] Build Head Dashboard page
- [ ] Build Admin Dashboard page
- [ ] Create shared components (StatsCard, ActivityFeed, etc.)
- [ ] Create role-based navigation
- [ ] Add permission gating to all dashboard modules
- [ ] Create responsive layouts for all screen sizes
