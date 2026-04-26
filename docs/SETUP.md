# Setup Guide

## Requirements

- Node.js 18+
- A [Supabase](https://supabase.com) cloud project

---

## 1. Install dependencies

```bash
# Frontend
npm install

# Backend
cd backend && npm install && cd ..
```

---

## 2. Configure environment

```bash
cp .env.local.template .env.local
```

Edit `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY=sb_publishable_...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:4000
SETUP_SECRET=generate-with-openssl-rand-hex-32
```

Copy the same `SUPABASE_*` values to `backend/.env` (see `backend/.env.example`).

---

## 3. Set up the database

1. Open your [Supabase dashboard](https://supabase.com/dashboard) → SQL Editor
2. Paste the contents of `supabase/schema.sql`
3. Click **Run**

This creates all 35 tables, RLS policies, triggers, and seeds the two system roles (Superadmin, No Assigned Role).

---

## 4. Run in development

```bash
# Terminal 1 — Express backend (port 4000)
cd backend && npm run dev

# Terminal 2 — Next.js frontend (port 3000)
npm run dev
```

---

## 5. First-time setup (onboarding)

On first visit, the app redirects to `/onboarding`:

1. Click **Begin Setup** — a one-time token is printed in the **backend terminal**
2. Copy the token and paste it into the setup wizard
3. Create your superadmin account
4. Log in with your new credentials

> If you need to manually promote a user to superadmin, run this in the Supabase SQL Editor:
> ```sql
> update user_profiles set is_superadmin = true where email = 'you@example.com';
> insert into user_roles (user_id, role_id, assigned_by)
> select id, 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', id
> from user_profiles where email = 'you@example.com'
> on conflict do nothing;
> ```

---

## 6. Invite your team

From **Admin → Invite Users**, send email invitations. Recipients receive a link to create their account and are assigned the role you specify.

---

## Production deployment

```bash
# Backend (port 4000)
cd backend && npm run build && npm start

# Frontend (port 3000)
npm run build && npm start
```

Set all environment variables in your hosting provider. For Vercel, add them under **Settings → Environment Variables**.

---

## Email (optional)

Configure SMTP in `.env.local` to enable invitation emails:

```env
SMTP_HOST=smtp.your-domain.com
SMTP_PORT=587
SMTP_USER=your-user
SMTP_PASS=your-password
SMTP_FROM=Worklo <noreply@your-domain.com>
```

---

## Demo mode

```bash
npm run dev:demo
```

Enables quick-login buttons for pre-seeded demo users. Requires running `scripts/create-seed-users.ts` first.
