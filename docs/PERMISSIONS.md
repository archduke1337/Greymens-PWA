# Mind Mesh — Permission Resolution System

## Overview

Permissions in Mind Mesh are resolved from three layers:

```
effective_permissions = base_permissions(status) ∪ scoped_powers ∪ department_permissions
admin bypass = true (always has all permissions)
```

---

## 1. Status → Base Permissions

| Status | Base Permissions |
|--------|-----------------|
| `applicant` | `view_public_content`, `view_resources`, `view_roadmaps`, `submit_application`, `edit_own_application` |
| `member` | + `register_events`, `view_member_resources`, `manage_own_profile`, `view_members`, `request_department_assignment` |
| `core_member` | + `manage_department_resources`, `view_department_members`, `participate_in_department_events` |
| `lead` | + `draft_events`, `manage_department_team`, `view_department_stats` |
| `head` | + `approve_events_in_scope`, `manage_multiple_departments`, `view_operations_stats` |
| `officer` | + `manage_organization`, `view_reports`, `manage_announcements` |
| `admin` | `ALL_PERMISSIONS` (bypass) |

---

## 2. Scoped Powers

Each power grants specific capabilities:

| Power | Grants | Scope |
|-------|--------|-------|
| `membership_approver` | `approve_applications`, `reject_applications`, `view_application_details` | global or department |
| `event_manager` | `create_events`, `edit_events`, `publish_events`, `manage_registrations` | global or department |
| `ticket_verifier` | `verify_tickets`, `manual_checkin`, `view_attendee_list` | per-event |
| `blog_reviewer` | `approve_blogs`, `reject_blogs`, `edit_blogs` | global |
| `resource_manager` | `upload_resources`, `edit_resources`, `delete_resources` | global or department |
| `department_head` | `manage_department_team`, `assign_department_roles`, `view_department_data` | own department |
| `operations_head` | `manage_multiple_departments`, `approve_department_events`, `view_operations_data` | multiple departments |
| `profile_moderator` | `view_audit_logs`, `revert_profile_changes`, `view_sensitive_data` | global or department |
| `notification_admin` | `send_notifications`, `manage_notification_templates` | global |

---

## 3. Permission Resolution Algorithm

```typescript
function resolvePermissions(user: User): PermissionSet {
  // 1. Admin bypass
  if (user.status === 'admin') {
    return ALL_PERMISSIONS;
  }

  // 2. Base permissions from status
  const base = STATUS_PERMISSIONS[user.status] || [];

  // 3. Scoped powers
  const powers = user.powers
    .filter(p => p.isActive && (!p.expiresAt || new Date(p.expiresAt) > new Date()))
    .flatMap(p => POWER_GRANTS[p.powerId]);

  // 4. Department permissions
  const deptPerms = user.departments
    .filter(ud => ud.isActive)
    .flatMap(ud => {
      const dept = getDepartment(ud.departmentId);
      const rolePerms = DEPARTMENT_ROLE_PERMISSIONS[ud.role] || [];
      return rolePerms.map(p => ({
        ...p,
        scope: `department:${ud.departmentId}`
      }));
    });

  // 5. Designation permissions (from designation level)
  const designations = user.designations
    .filter(ud => ud.isActive)
    .map(ud => getDesignation(ud.designationId));
  
  const desigPerms = designations.flatMap(d => 
    DESIGNATION_PERMISSIONS[d.level] || []
  );

  // 6. Merge all permissions
  return mergePermissions([...base, ...powers, ...deptPerms, ...desigPerms]);
}

function hasPermission(user: User, permission: string, scope?: string): boolean {
  const perms = resolvePermissions(user);
  
  // Admin always has everything
  if (perms.has('ALL')) return true;
  
  // Check exact permission
  if (perms.has(permission)) return true;
  
  // Check scoped permission
  if (scope && perms.has(`${permission}:${scope}`)) return true;
  
  // Check wildcard
  if (perms.has(`${permission}:*`)) return true;
  
  return false;
}
```

---

## 4. Permission Checking in Practice

### 4.1 API Route Protection

```typescript
// app/api/members/approve/route.ts
import { requirePermission } from '@/lib/permissions';

export async function POST(request: Request) {
  const user = await requirePermission(request, 'membership_approver');
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  
  // Proceed with approval logic
}
```

### 4.2 Component-Level Gating

```tsx
// components/EventActions.tsx
import { usePermissions } from '@/context/PermissionContext';

export function EventActions({ event }) {
  const { hasPermission } = usePermissions();
  
  return (
    <>
      {hasPermission('edit_events', `department:${event.departmentId}`) && (
        <Button onPress={() => editEvent(event)}>Edit</Button>
      )}
      {hasPermission('publish_events') && event.status === 'approved' && (
        <Button onPress={() => publishEvent(event)}>Publish</Button>
      )}
    </>
  );
}
```

### 4.3 Data Filtering

```typescript
// lib/services/events.ts
async function getEventsForUser(user: User) {
  if (hasPermission(user, 'view_all_events')) {
    return getAllEvents();
  }
  
  const userDepts = user.departments.map(d => d.departmentId);
  
  return databases.listDocuments(
    DATABASE_ID,
    EVENTS_COLLECTION,
    [
      Query.or([
        Query.equal('audience', 'public'),
        Query.and([
          Query.equal('audience', 'member_only'),
          Query.equal('status', 'published'),
        ]),
        // Department-scoped events
        Query.and([
          Query.equal('audience', 'exclusive'),
          Query.in('departmentId', userDepts),
        ]),
      ]),
      Query.equal('status', 'published'),
    ]
  );
}
```

---

## 5. Power Granting Rules

### 5.1 Who Can Grant What

| Power | Can Be Granted By |
|-------|-------------------|
| `membership_approver` | admin only |
| `event_manager` | admin, operations_head |
| `ticket_verifier` | admin, operations_head, department_head (own dept) |
| `blog_reviewer` | admin |
| `resource_manager` | admin, operations_head |
| `department_head` | admin only |
| `operations_head` | admin only |
| `profile_moderator` | admin only |
| `notification_admin` | admin only |

### 5.2 Power Scoping

Powers can be scoped to:
- **Global:** applies to all departments
- **Department:** applies to specific department(s)
- **Event:** applies to specific event(s)

```typescript
interface PowerGrant {
  powerId: string;
  userId: string;
  grantedBy: string;
  scope: 'global' | 'department' | 'event';
  scopeId?: string; // departmentId or eventId
  expiresAt?: string;
}
```

---

## 6. Department Permission Matrix

| Role | own dept members | own dept events | own dept resources | cross-dept |
|------|-----------------|-----------------|-------------------|------------|
| member | view | register | view | - |
| core_member | view | register | view, upload | - |
| lead | view, manage | draft, manage | view, upload, edit | - |
| head | view, manage | approve, manage | view, upload, edit | view (read) |

---

## 7. Implementation Checklist

- [ ] Create `lib/permissions.ts` with permission resolution logic
- [ ] Create `context/PermissionContext.tsx` for client-side permission checking
- [ ] Create `lib/hooks/usePermissions.ts` for component-level gating
- [ ] Create `lib/middleware/requirePermission.ts` for API route protection
- [ ] Seed `powers` collection with all 9 powers
- [ ] Seed `departments` collection with initial departments
- [ ] Update `profiles` collection to include status field
- [ ] Create permission checking utility for Appwrite queries
