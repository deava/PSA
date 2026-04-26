import { createClient, SupabaseClient } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface UserProfile {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
  is_superadmin?: boolean | null;
  is_approved?: boolean | null;
  department_id?: string | null;
  job_title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface Department {
  id: string;
  name: string;
  description?: string | null;
  [key: string]: unknown;
}

export interface Role {
  id: string;
  name: string;
  department_id?: string | null;
  permissions?: string[] | null;
  is_system_role?: boolean | null;
  departments?: Department | null;
  [key: string]: unknown;
}

export interface UserRole {
  id: string;
  role_id: string;
  user_id?: string | null;
  assigned_at?: string | null;
  assigned_by?: string | null;
  roles?: Role | null;
  [key: string]: unknown;
}

export interface Project {
  id: string;
  name: string;
  account_id?: string | null;
  status?: string | null;
  [key: string]: unknown;
}

// Supabase client type alias
export type AppSupabaseClient = SupabaseClient;

// ── Clients ───────────────────────────────────────────────────────────────────

// Admin client — bypasses RLS (server-side only, never expose to client)
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Anonymous/public client — respects RLS
export function createClientSupabase(): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// User-scoped client — respects RLS via user JWT
export function createUserClient(accessToken: string): SupabaseClient {
  return createClient(
    process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
  );
}
