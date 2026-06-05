# Mind Mesh — Auth & Membership Flow

## Flow Overview

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Signup     │────▶│  Application │────▶│  Applicant   │────▶│   Member    │
│  (account)   │     │    Form      │     │  (pending)   │     │  (approved) │
└─────────────┘     └─────────────┘     └──────┬──────┘     └─────────────┘
                                               │
                                          ┌────▼────┐
                                          │ Rejected │──▶ can re-apply
                                          └─────────┘
```

---

## 1. Account Signup

### 1.1 Flow

1. User visits `/register`
2. Fills: name, email, password, confirm password
3. Submits → Appwrite `account.create()`
4. Auto-login after signup
5. Redirect to `/onboarding` (application form)

### 1.2 Implementation

```typescript
// app/register/page.tsx
const handleRegister = async (email, password, name) => {
  await authService.createAccount(email, password, name);
  await authService.login(email, password);
  router.push('/onboarding');
};
```

### 1.3 Auth Methods

- **v1:** email/password only
- **Future:** Google OAuth, GitHub OAuth (architecture ready)

---

## 2. Club Application Form

### 2.1 Form Sections

#### Section 1: Personal Information
| Field | Type | Required |
|-------|------|----------|
| avatar | file upload | no |
| phone | text | yes |
| urn | text | yes |
| dateOfBirth | date | yes |
| gender | select | yes |
| address | textarea | no |

#### Section 2: Academic Details
| Field | Type | Required |
|-------|------|----------|
| program | select | yes |
| branch | select | yes |
| year | select | yes |
| semester | select | yes |

#### Section 3: Club Interests
| Field | Type | Required |
|-------|------|----------|
| preferredDepartments | multi-select | yes |
| skills | multi-select | no |
| interests | multi-select | no |
| experience | textarea | no |
| whyJoin | textarea | yes |
| availability | select | yes |

#### Section 4: Social Profiles
| Field | Type | Required |
|-------|------|----------|
| githubUrl | url | no |
| linkedinUrl | url | no |
| portfolioUrl | url | no |
| bio | textarea | no |

#### Section 5: Legal & Oath
| Field | Type | Required |
|-------|------|----------|
| oathAccepted | checkbox | yes |
| termsAccepted | checkbox | yes |
| constitutionAccepted | checkbox | yes |

### 2.2 Submission Flow

1. Validate all required fields
2. Create `profiles` document
3. Create `applications` document (status: "pending")
4. Link profile to application
5. Send notification to admins
6. Redirect to applicant dashboard

### 2.3 Post-Submission

- User sees application status on dashboard
- Status shows: "Your application is under review"
- Can edit application while status is "pending"
- Cannot access member-only features

---

## 3. Application Review

### 3.1 Review Queue

Admins/authorized reviewers see:
- List of pending applications
- Quick stats: total pending, approved today, rejected today
- Filter by: department preference, submission date

### 3.2 Review Process

1. Admin opens application details
2. Sees all profile data (full access for admin)
3. Can view applicant's profile
4. Makes decision: approve / reject

### 3.3 Approval Flow

1. Admin clicks "Approve"
2. System creates `memberships` document
3. System assigns `member` status to user
4. System sends in-app notification to user
5. System sends email notification to user
6. User's status changes from `applicant` to `member`
7. User can now access member-only features

### 3.4 Rejection Flow

1. Admin clicks "Reject"
2. Admin provides rejection reason (required)
3. System updates `applications` status to "rejected"
4. System sends in-app notification to user
5. System sends email notification to user
6. User can re-apply after addressing feedback

---

## 4. Department Assignment

### 4.1 Request Flow

1. Member visits `/departments`
2. Browses available departments
3. Clicks "Request to Join" on a department
4. Selects preference order (1st, 2nd, 3rd choice)
5. Submits request

### 4.2 Assignment Flow

1. Department lead/head sees pending requests
2. Reviews applicant's profile and interests
3. Approves or rejects
4. If approved:
   - Creates `user_departments` document
   - Sends notification to member
   - Member gets department-specific resources
5. If rejected:
   - Sends notification with reason
   - Member can request another department

---

## 5. Profile Management

### 5.1 Self-Service Edits

**Immediate (no review):**
- Name, avatar, bio, social links
- Phone, email (audited)
- Availability, interests

**Audited (admin can view diff):**
- URN, address, academic details
- Changes logged in `audit_logs`

**Restricted (requires approval):**
- Department preference changes
- Status/designation changes (admin only)

### 5.2 Admin Moderation

Admins can:
- View any profile (full access)
- View audit trail of any profile
- Revert any profile change
- Edit any profile directly
- Ban/deactivate users

---

## 6. Role Promotion

### 6.1 Promotion Flow

1. Admin/operations head selects member
2. Chooses new designation from list
3. Optionally assigns scoped powers
4. Confirms promotion
5. System:
   - Creates `user_designations` document
   - Creates `user_powers` documents (if any)
   - Updates user's effective permissions
   - Sends in-app notification
   - Sends email with promotion letter
   - Logs in audit trail

### 6.2 Demotion/Revocation

1. Admin selects member with designation
2. Clicks "Revoke Designation"
3. System:
   - Updates `user_designations` isActive to false
   - Revokes associated powers
   - Sends notification
   - Logs in audit trail

---

## 7. Session Management

### 7.1 Token Strategy

- Appwrite handles session tokens
- Sessions stored in httpOnly cookies
- Auto-refresh every 5 minutes
- Session expiry handled gracefully

### 7.2 Logout

1. Clear Appwrite session
2. Clear local state
3. Redirect to `/login`

---

## 8. Protected Routes

| Route | Access | Redirect |
|-------|--------|----------|
| `/onboarding` | authenticated (no application yet) | → `/dashboard` if has application |
| `/dashboard` | authenticated | → `/login` |
| `/admin/*` | admin only | → `/unauthorized` |
| `/events/*` (member) | member+ | → `/login` or `/onboarding` |
| `/resources/*` (member) | member+ | → `/login` or `/onboarding` |
| `/events/*` (public) | authenticated | → `/login` |

---

## 9. Email Notifications

| Event | Email Template |
|-------|---------------|
| Application approved | `membership_approved` |
| Application rejected | `membership_rejected` |
| Role assigned | `role_assigned` |
| Role revoked | `role_revoked` |
| Event approved | `event_approved` |
| Event rejected | `event_rejected` |
| Ticket issued | `ticket_issued` |
| Exclusive registration approved | `registration_approved` |
| Exclusive registration rejected | `registration_rejected` |
| Department assigned | `department_assigned` |

---

## 10. Implementation Checklist

- [ ] Create `/onboarding` page with multi-step form
- [ ] Create `applications` service in `lib/applications.ts`
- [ ] Create `memberships` service in `lib/memberships.ts`
- [ ] Create `profiles` service in `lib/profiles.ts`
- [ ] Update auth flow to redirect to onboarding
- [ ] Create admin review queue UI
- [ ] Create approval/rejection API routes
- [ ] Create department request/assignment flow
- [ ] Create notification service
- [ ] Create email service integration
- [ ] Add audit logging to profile changes
- [ ] Add permission checking to all protected routes
