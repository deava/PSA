# API Reference

All routes are served by the Express backend at `http://localhost:4000`.

## Authentication

All protected routes require:
```
Authorization: Bearer <supabase_access_token>
```

The frontend handles this automatically via `apiFetch()` in `lib/api-config.ts`.

## Base URL

```
http://localhost:4000/api
```

---

## Accounts

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/accounts` | List accessible accounts |
| POST | `/api/accounts` | Create account |
| GET | `/api/accounts/members` | List all account members |
| GET | `/api/accounts/:id` | Get account |
| PATCH | `/api/accounts/:id` | Update account |
| DELETE | `/api/accounts/:id` | Delete account |
| GET | `/api/accounts/:id/members` | List account members |
| POST | `/api/accounts/:id/members` | Add member |
| DELETE | `/api/accounts/:id/members/:userId` | Remove member |
| GET | `/api/accounts/:id/client-feedback` | View client feedback |
| GET | `/api/accounts/:id/client-invites` | List client invitations |
| POST | `/api/accounts/:id/invite-client` | Send client invitation |
| GET | `/api/accounts/:id/kanban-config` | Get kanban config |
| PATCH | `/api/accounts/:id/kanban-config` | Update kanban config |

---

## Projects

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/projects` | List projects |
| POST | `/api/projects` | Create project |
| GET | `/api/projects/:id` | Get project |
| PATCH | `/api/projects/:id` | Update project |
| DELETE | `/api/projects/:id` | Delete project |
| POST | `/api/projects/:id/complete` | Mark complete |
| POST | `/api/projects/:id/reopen` | Reopen project |
| GET | `/api/projects/:id/assignments` | List team members |
| POST | `/api/projects/:id/assignments` | Add team member |
| GET | `/api/projects/:id/stakeholders` | List stakeholders |
| POST | `/api/projects/:id/stakeholders` | Add stakeholder |
| GET | `/api/projects/:id/updates` | List updates |
| POST | `/api/projects/:id/updates` | Post update |
| PATCH | `/api/projects/:id/updates/:updateId` | Edit update |
| DELETE | `/api/projects/:id/updates/:updateId` | Delete update |
| GET | `/api/projects/:id/issues` | List issues |
| POST | `/api/projects/:id/issues` | Create issue |
| PATCH | `/api/projects/:id/issues/:issueId` | Update issue |
| GET | `/api/project-updates` | All project updates feed |

---

## Tasks

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/tasks` | Create task |
| GET | `/api/tasks/:id` | Get task |
| PATCH | `/api/tasks/:id` | Update task |
| DELETE | `/api/tasks/:id` | Delete task |

---

## Time Tracking

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/time-entries` | List time entries |
| POST | `/api/time-entries` | Log time |
| PATCH | `/api/time-entries` | Update time entry |
| DELETE | `/api/time-entries` | Delete time entry |
| GET | `/api/clock` | Get clock status |
| POST | `/api/clock` | Clock in |
| POST | `/api/clock/out` | Clock out |
| POST | `/api/clock/discard` | Discard active session |
| GET | `/api/availability` | Get availability |
| POST | `/api/availability` | Set availability |

---

## Capacity

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/capacity/organization` | Org-wide capacity |
| GET | `/api/capacity/department` | Department capacity |
| GET | `/api/capacity/account` | Account capacity |
| GET | `/api/capacity/history` | Capacity history |

---

## Users & Roles

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users` | List users |
| POST | `/api/users/approve` | Approve pending user |
| GET | `/api/users/pending` | List pending approvals |
| GET | `/api/profile` | Get own profile |
| PATCH | `/api/profile` | Update own profile |
| GET | `/api/roles` | List roles |
| POST | `/api/roles` | Create role |
| PATCH | `/api/roles/reorder` | Reorder roles |
| GET | `/api/roles/:id` | Get role |
| PATCH | `/api/roles/:id` | Update role |
| DELETE | `/api/roles/:id` | Delete role |
| GET | `/api/roles/:id/users` | List role members |
| POST | `/api/roles/:id/assign-user` | Assign user to role |
| POST | `/api/roles/:id/unassign-user` | Unassign user |
| DELETE | `/api/roles/:id/remove-user/:userId` | Remove user from role |

---

## Departments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/departments` | List departments |
| POST | `/api/departments` | Create department |
| GET | `/api/org-structure/departments` | Org structure departments |
| GET | `/api/org-structure/roles` | Org structure roles |

---

## Invitations

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/invitations` | List invitations |
| POST | `/api/invitations` | Send invitation |
| DELETE | `/api/invitations/:id` | Revoke invitation |
| POST | `/api/invitations/:id/resend` | Resend invitation |
| GET | `/api/invitations/accept/:token` | Get invite details |
| POST | `/api/invitations/accept/:token` | Accept invitation |

---

## Workflows

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/workflows/templates` | List templates |
| POST | `/api/admin/workflows/templates` | Create template |
| GET | `/api/admin/workflows/templates/:id` | Get template |
| PATCH | `/api/admin/workflows/templates/:id` | Update template |
| DELETE | `/api/admin/workflows/templates/:id` | Delete template |
| GET | `/api/admin/workflows/templates/:id/nodes` | List nodes |
| POST | `/api/admin/workflows/nodes` | Create node |
| PATCH | `/api/admin/workflows/nodes/:id` | Update node |
| DELETE | `/api/admin/workflows/nodes/:id` | Delete node |
| POST | `/api/admin/workflows/connections` | Create connection |
| DELETE | `/api/admin/workflows/connections/:id` | Delete connection |
| POST | `/api/workflows/instances/start` | Start workflow instance |
| GET | `/api/workflows/instances/:id` | Get instance |
| GET | `/api/workflows/instances/:id/active-steps` | Active steps |
| GET | `/api/workflows/instances/:id/history` | Instance history |
| GET | `/api/workflows/instances/:id/next-nodes` | Available next nodes |
| POST | `/api/workflows/instances/:id/handoff` | Hand off to next node |
| GET | `/api/workflows/my-projects` | My active workflow projects |
| GET | `/api/workflows/my-approvals` | My pending approvals |
| GET | `/api/workflows/my-pipeline` | My pipeline |
| GET | `/api/workflows/my-past-projects` | My completed projects |
| GET | `/api/workflows/history` | Workflow history |
| GET | `/api/workflows/progress` | Workflow progress |
| GET | `/api/workflows/steps` | Workflow steps |
| GET | `/api/workflows/forms` | Workflow forms |
| GET | `/api/workflows/forms/responses` | Form responses |

---

## Analytics

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/analytics/overview` | Org overview |
| GET | `/api/analytics/projects` | Project analytics |
| GET | `/api/analytics/team` | Team analytics |
| GET | `/api/analytics/time` | Time analytics |
| GET | `/api/analytics/accounts` | Account analytics |
| GET | `/api/analytics/workflows` | Workflow analytics |
| GET | `/api/analytics/network` | Network analytics |

---

## Dashboard

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/dashboard/preferences` | Get widget preferences |
| PUT | `/api/dashboard/preferences` | Save widget preferences |
| GET | `/api/dashboard/my-accounts` | My accounts |
| GET | `/api/dashboard/my-workflows` | My active workflows |
| GET | `/api/dashboard/my-collaborators` | My collaborators |
| GET | `/api/dashboard/my-analytics` | My analytics |
| GET | `/api/dashboard/recent-activity` | Recent activity |
| GET | `/api/dashboard/upcoming-deadlines` | Upcoming deadlines |
| GET | `/api/dashboard/task-completion-trend` | Task completion trend |
| GET | `/api/dashboard/time-by-project` | Time by project |

---

## Client Portal

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/client/portal/projects` | Client's projects |
| GET | `/api/client/portal/projects/:id` | Project detail |
| POST | `/api/client/portal/projects/:id/approve` | Approve project |
| POST | `/api/client/portal/projects/:id/reject` | Reject project |
| POST | `/api/client/portal/projects/:id/feedback` | Submit feedback |
| GET | `/api/client/accept-invite/:token` | Get invite details |
| POST | `/api/client/accept-invite/:token` | Accept client invite |

---

## Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/client-feedback` | All client feedback |
| GET | `/api/admin/time-entries` | All time entries |
| PATCH | `/api/admin/time-entries/:id` | Edit any time entry |
| DELETE | `/api/admin/time-entries/:id` | Delete any time entry |
| GET | `/api/admin/rbac-diagnostics` | RBAC diagnostics |
| POST | `/api/admin/rbac-diagnostics/test` | Test permissions |
| POST | `/api/admin/move-system-roles` | Move system roles |
| GET | `/api/auth/permissions` | Current user permissions |

---

## Onboarding

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/onboarding/check-first-run` | Check if first run |
| GET | `/api/onboarding/setup-token` | Generate setup token (prints to backend terminal) |
| POST | `/api/onboarding/setup-token` | Verify token |
| POST | `/api/onboarding/complete-setup` | Create superadmin account |
| GET | `/api/onboarding/tutorial-progress` | Get tutorial state |
| PATCH | `/api/onboarding/tutorial-progress` | Update tutorial progress |
| POST | `/api/onboarding/tutorial-progress/check-action` | Check tutorial action |

---

## Misc

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/bug-reports` | Submit bug report |
| POST | `/api/setup` | Superadmin setup (legacy) |
| POST | `/api/cron/reset-demo-data` | Reset demo data (demo mode only) |
