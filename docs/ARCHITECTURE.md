# Architecture

## System Overview

```
Browser
  │
  ├── Next.js 15 Frontend (port 3000)
  │     ├── React Server Components (pages, layouts)
  │     ├── Client Components (interactive UI)
  │     └── lib/api-config.ts → apiFetch() routes all calls to backend
  │
  └── Express Backend (port 4000)
        ├── index.ts       — middleware, CORS, port binding
        ├── router.ts      — mounts 100+ routes
        ├── adapter.ts     — NextRequest/NextResponse → Express shim
        ├── lib/           — Supabase clients, auth helpers
        └── routes-next/   — all API route handlers
              └── Supabase (PostgreSQL + RLS)
```

---

## Authentication Flow

```
1. User logs in via Supabase Auth → receives JWT access_token
2. Frontend stores token in Supabase session (cookie/localStorage)
3. apiFetch() reads token via supabase.auth.getSession()
4. Sends: Authorization: Bearer <token>
5. Backend: getUserFromRequest(req) → admin.auth.getUser(token)
6. Returns authenticated user → fetch profile → check permissions
```

---

## Key Patterns

### API Client (`lib/api-config.ts`)
`apiFetch(path, init?)` is the single entry point for all frontend → backend calls. It:
- Reads the current Supabase session token
- Attaches `Authorization: Bearer <token>`
- Resolves the path against `NEXT_PUBLIC_API_URL` (default: `http://localhost:4000`)

### Service Layer
Business logic lives in `lib/services/` and `lib/*-service.ts`. Route handlers are thin — they authenticate, authorize, validate input, call a service, and return JSON.

### Hybrid Permission System
Three-layer evaluation (see `lib/permission-checker.ts`):
1. **Superadmin bypass** — `is_superadmin = true` on profile → full access
2. **Override permissions** — `VIEW_ALL_PROJECTS`, `MANAGE_ALL_PROJECTS`, etc. → global access
3. **Base permission + context** — `VIEW_PROJECTS` + project assignment → scoped access

### Row Level Security
Every table has RLS enabled. The backend uses the `service_role` key (bypasses RLS) for all writes. Authenticated users can read their own data via anon/user-scoped policies. Application bugs cannot leak cross-tenant data.

### Dynamic Department Membership
Users belong to departments through their role assignments, not static org chart entries. A user's department is derived from the `roles.department_id` of their assigned roles.

---

## Database Schema

35 tables across these categories:

| Category | Tables |
|----------|--------|
| Users | `user_profiles`, `user_roles` |
| Org | `roles`, `departments` |
| Accounts | `accounts`, `account_members`, `account_kanban_configs` |
| Projects | `projects`, `project_assignments`, `project_stakeholders`, `project_updates`, `project_issues`, `milestones` |
| Tasks | `tasks`, `task_week_allocations` |
| Time | `time_entries`, `clock_sessions`, `user_availability` |
| Workflows | `workflow_templates`, `workflow_nodes`, `workflow_connections`, `workflow_instances`, `workflow_history`, `workflow_active_steps`, `workflow_node_assignments`, `workflow_approvals` |
| Forms | `form_templates`, `form_responses` |
| Client Portal | `client_portal_invitations`, `client_feedback` |
| System | `setup_tokens`, `onboarding_state`, `user_invitations`, `pending_user_approvals`, `user_dashboard_preferences`, `newsletters` |

Full schema: `supabase/schema.sql`

---

## Backend Route Structure

All routes live in `backend/src/routes-next/` and are mounted in `backend/src/router.ts`.

The `adapter.ts` shim converts Next.js `NextRequest`/`NextResponse` to Express `req`/`res`, allowing route handlers to be written in Next.js style while running in Express.

### Adding a new route

1. Create `backend/src/routes-next/your-route/route.ts`
2. Export `GET`, `POST`, `PATCH`, or `DELETE` functions
3. Use `getUserFromRequest(request)` for authentication
4. Use `createAdminSupabaseClient()` for database operations
5. Mount in `backend/src/router.ts`: `mount(router, '/your-route', yourRoute)`

---

## Frontend Structure

```
app/
├── (main)/admin/       # Admin hub — workflows, client portal, invitations
├── admin/              # Admin tools — roles, users, DB diagnostics
├── (client-portal)/    # Client-facing portal (separate layout)
├── dashboard/          # Main dashboard with customizable widgets
├── projects/           # Project list + detail pages
├── accounts/           # Account management
├── departments/        # Department views
├── analytics/          # Analytics dashboards
├── capacity/           # Capacity planning
├── time-entries/       # Time tracking
└── onboarding/         # First-run setup wizard
```
