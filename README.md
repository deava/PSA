# Worklo PSA

**Professional Services Automation Platform** v1.0.0

A unified platform for managing agency operations: projects, tasks, time tracking, capacity planning, workflow automation, and client portals.

---

## Architecture

```
Browser
  +-- Next.js 15 Frontend  (port 3000)
      +-- React 19, TypeScript, Tailwind CSS 4, shadcn/ui
  +-- Express Backend      (port 4000)
        +-- REST API ? Supabase (PostgreSQL + RLS)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, TypeScript |
| Styling | Tailwind CSS 4, shadcn/ui, Radix UI |
| Backend | Express.js (Node.js), TypeScript |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (JWT) |
| State | Jotai, SWR |
| Charts | Recharts, D3 |
| Workflows | @xyflow/react |
| Drag & Drop | @dnd-kit |
| Validation | Zod |

---

## Quick Start

### Prerequisites
- Node.js 18+
- A [Supabase](https://supabase.com) cloud project

### 1. Install

```bash
npm install
cd backend && npm install && cd ..
```

### 2. Configure

```bash
cp .env.local.template .env.local
```

Edit `.env.local` with your Supabase credentials:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
SETUP_SECRET=your-secret-key
```

Copy the same `SUPABASE_*` values to `backend/.env`.

### 3. Set up the database

Run `supabase/schema.sql` in the Supabase SQL Editor to create all tables, RLS policies, and seed system roles.

### 4. Run

```bash
# Terminal 1 Backend (port 4000)
cd backend && npm run dev

# Terminal 2 Frontend (port 3000)
npm run dev
```

### 5. First-time setup

On first visit you'll be redirected to `/onboarding`:
1. Click **Begin Setup** a token is printed in the backend terminal
2. Paste the token to verify server ownership
3. Create your superadmin account

---

## Project Structure

```
worklo/
+-- app/                        # Next.js pages & layouts
  +-- dashboard/
  +-- projects/
  +-- accounts/
  +-- departments/
  +-- analytics/
  +-- capacity/
  +-- time-entries/
  +-- admin/                  # Admin tools (roles, users, DB)
  +-- (main)/admin/           # Admin hub (workflows, client portal)
  +-- (client-portal)/        # Client-facing portal
  +-- onboarding/
+-- components/                 # React components
  +-- ui/                     # Base UI (shadcn/ui)
  +-- dashboard/
  +-- sidebar/
  +-- onboarding/
  +-- workflow-editor/
+-- lib/                        # Shared utilities
  +-- services/               # Business logic services
  +-- hooks/                  # React hooks
  +-- contexts/               # React contexts (Auth)
  +-- email/                  # Email sending
  +-- onboarding/             # Setup token logic
  +-- permissions.ts          # Permission enum (~40 permissions)
  +-- permission-checker.ts   # Core RBAC engine
  +-- rbac.ts                 # RBAC helpers
  +-- api-config.ts           # apiFetch() routes calls to backend
+-- backend/                    # Express API server
  +-- src/
      +-- index.ts            # Entry point, middleware (port 4000)
      +-- router.ts           # 100+ route mounts
      +-- adapter.ts          # NextRequest/NextResponse ? Express shim
      +-- lib/                # Supabase client, auth helpers
      +-- routes-next/        # All API route handlers
+-- supabase/
  +-- schema.sql              # Full database schema (run once)
+-- docs/                       # Documentation
  +-- SETUP.md
  +-- BACKEND.md
  +-- ARCHITECTURE.md
  +-- API.md
  +-- PERMISSIONS.md
+-- scripts/                    # Dev utilities
+-- public/                     # Static assets
```

---

## Features

- **Project Management** Kanban, table views, assignments, updates, issues
- **Task Tracking** Status, priority, time estimates, assignments
- **Time Tracking** Clock in/out, manual entries, weekly summaries
- **Capacity Planning** Per-user, department, and org-wide utilization
- **Workflow Automation** Visual drag-and-drop builder, role-based handoffs, approvals
- **Client Portal** Project visibility, feedback, approval flows
- **Analytics** Org, department, account, project, and time metrics
- **RBAC** ~40 permissions, dynamic roles, superadmin bypass, RLS enforcement
- **Invitations** Email-based team and client onboarding

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ? | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY` | ? | Supabase publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | ? | Service role key (server only) |
| `NEXT_PUBLIC_APP_URL` | ? | Frontend URL |
| `NEXT_PUBLIC_API_URL` | ? | Backend URL (default: `http://localhost:4000`) |
| `SETUP_SECRET` | ? | One-time superadmin setup key |
| `SMTP_HOST` | ? | Email server host |
| `SMTP_PORT` | ? | Email server port |
| `SMTP_USER` | ? | Email username |
| `SMTP_PASS` | ? | Email password |
| `SMTP_FROM` | ? | From address |
| `NEXT_PUBLIC_DEMO_MODE` | ? | Enable demo quick-login buttons |

---

## Production

```bash
# Backend
cd backend && npm run build && npm start   # port 4000

# Frontend
npm run build && npm start                  # port 3000
```

---

## License

Proprietary 2025 Worklo. All rights reserved. See [LICENSE](LICENSE).
