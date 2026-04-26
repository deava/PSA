# Permission System

## Overview

~40 permissions across 8 categories. No hardcoded role names — all checks are permission-based and dynamic. Roles are created and configured by admins at runtime.

## Evaluation Flow

```
1. Superadmin? (is_superadmin = true on profile)  → ALLOW (bypass all)
2. Override permission? (VIEW_ALL_*, MANAGE_ALL_*) → ALLOW (global access)
3. Base permission + context check                 → ALLOW (scoped access)
4. Otherwise                                       → DENY
```

Implemented in `lib/permission-checker.ts`.

---

## Permissions by Category

### Role Management
| Permission | Description |
|-----------|-------------|
| `MANAGE_USER_ROLES` | Create/edit/delete roles, assign/remove users, approve registrations |
| `MANAGE_USERS` | View, edit, and delete users |

### Department Management
| Permission | Description |
|-----------|-------------|
| `MANAGE_DEPARTMENTS` | Create, edit, and delete departments |
| `VIEW_DEPARTMENTS` | View departments user belongs to |
| `VIEW_ALL_DEPARTMENTS` | View all departments org-wide (override) |

### Account Management
| Permission | Description |
|-----------|-------------|
| `MANAGE_ACCOUNTS` | Create, edit, and delete client accounts |
| `MANAGE_USERS_IN_ACCOUNTS` | Assign/remove users from accounts |
| `VIEW_ACCOUNTS` | View accounts user has access to |
| `VIEW_ALL_ACCOUNTS` | View all accounts org-wide (override) |

### Project Management
| Permission | Description |
|-----------|-------------|
| `MANAGE_PROJECTS` | Create/edit/delete projects in assigned accounts |
| `VIEW_PROJECTS` | View projects user is assigned to |
| `VIEW_ALL_PROJECTS` | View all projects org-wide (override) |
| `MANAGE_ALL_PROJECTS` | Manage any project regardless of assignment (override) |

### Analytics
| Permission | Description |
|-----------|-------------|
| `VIEW_ALL_ANALYTICS` | Org-wide analytics (override) |
| `VIEW_ALL_DEPARTMENT_ANALYTICS` | Department analytics (override) |
| `VIEW_ALL_ACCOUNT_ANALYTICS` | Account analytics (override) |

### Capacity & Time
| Permission | Description |
|-----------|-------------|
| `MANAGE_TIME` | Log and edit own time entries |
| `VIEW_ALL_TIME_ENTRIES` | View all time entries org-wide (override) |
| `EDIT_OWN_AVAILABILITY` | Set personal weekly work availability |
| `VIEW_TEAM_CAPACITY` | View capacity metrics for team/department |
| `VIEW_ALL_CAPACITY` | View org-wide capacity metrics (override) |

### Workflows
| Permission | Description |
|-----------|-------------|
| `MANAGE_WORKFLOWS` | Create, edit, and delete workflow templates |
| `EXECUTE_WORKFLOWS` | Hand off work in workflows (context-aware: checks node assignment) |
| `SKIP_WORKFLOW_NODES` | Hand off out-of-order (admin only) |

### Client Portal
| Permission | Description |
|-----------|-------------|
| `MANAGE_CLIENT_INVITES` | Send client invitations and view client feedback |

---

## Project Access Model

Project sub-resources (tasks, updates, issues) use `userHasProjectAccess()` rather than individual permissions. A user has project access if they:

1. Are a superadmin
2. Have `VIEW_ALL_PROJECTS` or `MANAGE_ALL_PROJECTS`
3. Are in `project_assignments` for the project
4. Have a task assigned to them in the project
5. Are the account manager for the project's account

---

## Implementation Files

| File | Purpose |
|------|---------|
| `lib/permissions.ts` | Permission enum and definitions |
| `lib/permission-checker.ts` | Core evaluation engine, `isSuperadmin()` |
| `lib/permission-utils.ts` | Sync permission utilities for UI |
| `lib/rbac.ts` | Helper functions (`hasPermission`, `isSuperadmin`, etc.) |
| `lib/rbac-types.ts` | TypeScript types (`UserWithRoles`, `PermissionContext`) |

---

## Superadmin

A user is superadmin if:
- `user_profiles.is_superadmin = true`, **OR**
- They have a role with `is_system_role = true` and `name = 'superadmin'`

Superadmins bypass all permission checks and see all sidebar items.

To manually promote a user:
```sql
update user_profiles set is_superadmin = true where email = 'user@example.com';
```
