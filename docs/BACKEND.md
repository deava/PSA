# Backend

## Overview

The backend is a standalone Express.js server (`backend/`) that serves all API routes on port 4000. It uses a Next.js route handler style (exporting `GET`, `POST`, etc.) with an `adapter.ts` shim that converts `NextRequest`/`NextResponse` to Express `req`/`res`.

---

## Running

```bash
# Development (hot reload via tsx watch)
cd backend && npm run dev

# Production
cd backend && npm run build && npm start
```

---

## Structure

```
backend/
├── src/
│   ├── index.ts                  # Express app, middleware, port 4000
│   ├── router.ts                 # Mounts all 100+ routes
│   ├── adapter.ts                # NextRequest/NextResponse → Express shim
│   ├── lib/
│   │   ├── supabase-server.ts    # createAdminSupabaseClient(), getUserFromRequest()
│   │   ├── supabase.ts           # supabaseAdmin, createUserClient()
│   │   ├── server-guards.ts      # requireAuthentication(), requirePermission()
│   │   └── services/             # Capacity, availability, time entry services
│   └── routes-next/              # All API route handlers (100+ files)
│       ├── accounts/
│       ├── admin/
│       ├── analytics/
│       ├── availability/
│       ├── capacity/
│       ├── client/
│       ├── clock/
│       ├── dashboard/
│       ├── departments/
│       ├── invitations/
│       ├── onboarding/
│       ├── org-structure/
│       ├── profile/
│       ├── projects/
│       ├── roles/
│       ├── tasks/
│       ├── time-entries/
│       ├── users/
│       └── workflows/
├── .env                          # Environment variables (copy from .env.example)
├── .env.example                  # Template
├── package.json
└── tsconfig.json
```

---

## Authentication

All protected routes use `getUserFromRequest(req)`:

```typescript
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  // ... query DB with admin client
}
```

`getUserFromRequest` extracts `Authorization: Bearer <token>`, calls `admin.auth.getUser(token)`, and returns the authenticated user or null.

---

## Environment Variables

```env
PORT=4000
FRONTEND_URL=http://localhost:3000

# Supabase
SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
SETUP_SECRET=your-secret-key
NODE_ENV=development
LOG_LEVEL=debug

# Email (optional)
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=Worklo <noreply@your-domain.com>
```

---

## Adding a New Route

1. Create `backend/src/routes-next/your-route/route.ts`
2. Export HTTP method handlers:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';

export async function GET(request: NextRequest) {
  const user = await getUserFromRequest(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminSupabaseClient();
  if (!admin) return NextResponse.json({ error: 'DB error' }, { status: 500 });

  const { data, error } = await admin.from('your_table').select('*');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
```

3. Mount in `backend/src/router.ts`:

```typescript
import * as yourRoute from './routes-next/your-route/route';
// ...
mount(router, '/your-route', yourRoute);
```
