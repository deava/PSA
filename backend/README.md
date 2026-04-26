# Worklo Backend Template

This directory is a **template** for extracting the Worklo backend into a standalone server.

Currently, all backend logic lives inside the Next.js app as API Route Handlers (`app/api/`).
This template shows how to migrate to a dedicated Express/Node.js backend if needed.

## Structure

```
backend/
├── src/
│   ├── routes/          # Express route handlers (mirrors app/api/)
│   │   ├── accounts.ts
│   │   ├── analytics.ts
│   │   ├── auth.ts
│   │   ├── capacity.ts
│   │   ├── clock.ts
│   │   ├── departments.ts
│   │   ├── invitations.ts
│   │   ├── projects.ts
│   │   ├── roles.ts
│   │   ├── tasks.ts
│   │   ├── time-entries.ts
│   │   ├── users.ts
│   │   └── workflows.ts
│   ├── middleware/
│   │   ├── auth.ts       # Supabase JWT verification
│   │   ├── rateLimit.ts  # Upstash Redis rate limiting
│   │   └── validate.ts   # Zod request validation
│   ├── services/         # Business logic (copy from lib/)
│   └── index.ts          # Express app entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## When to use this

Use the standalone backend when you need:
- Independent scaling of API vs frontend
- Non-Next.js frontend (mobile app, third-party)
- Microservices architecture
- Custom WebSocket support

## Current architecture (default)

```
Browser → Next.js (frontend + API routes) → Supabase
```

## Standalone backend architecture

```
Browser → Next.js (frontend only) → Express Backend → Supabase
Mobile  ──────────────────────────────────────────────────────^
```
