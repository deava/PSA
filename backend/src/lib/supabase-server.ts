import { createClient, SupabaseClient } from '@supabase/supabase-js';

const FETCH_TIMEOUT = 30000;

const getUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const getAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
const getServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const isSupabaseConfigured = () => !!(getUrl() && getAnonKey());

const fetchWithTimeout = (input: any, init: any = {}) =>
  fetch(input, { ...init, signal: init.signal || AbortSignal.timeout(FETCH_TIMEOUT) });

// ── Admin client (service role — bypasses RLS) ────────────────────────────────
export const createAdminSupabaseClient = (): SupabaseClient | null => {
  const url = getUrl(); const key = getServiceKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchWithTimeout },
  });
};

// ── Extract Bearer token from any request object ──────────────────────────────
export function extractToken(req: any): string | null {
  try {
    const h = req?.headers?.get
      ? req.headers.get('authorization')   // Next.js Headers / fetch Request
      : req?.headers?.authorization;        // Express req
    return h?.startsWith('Bearer ') ? h.slice(7) : null;
  } catch { return null; }
}

// ── User-scoped client (respects RLS via user JWT) ────────────────────────────
export const createApiSupabaseClient = (req: any): SupabaseClient | null => {
  if (!isSupabaseConfigured()) return null;
  const token = extractToken(req);
  const url = getUrl(); const key = getAnonKey();

  // Always use the anon key + user JWT in Authorization header.
  // Supabase JS v2 respects Authorization header for auth.getUser() when
  // the client is created with global.headers.
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      fetch: fetchWithTimeout,
    },
  });
};

// Alias for backwards compat
export const createServerSupabaseClient = createApiSupabaseClient;
export const createServerSupabase = async () => createAdminSupabaseClient();

// ── Get user from request (uses admin client to verify JWT) ───────────────────
export async function getUserFromRequest(req: any): Promise<{ id: string; email?: string } | null> {
  const token = extractToken(req);
  if (!token) return null;

  // Use admin client's getUser(token) — this is the correct way to verify a JWT
  const admin = createAdminSupabaseClient();
  if (!admin) return null;

  const { data: { user }, error } = await admin.auth.getUser(token);
  if (error || !user) return null;
  return user;
}

// ── Get full user profile from request ───────────────────────────────────────
export async function getUserProfileFromRequest(supabase: SupabaseClient | null, req?: any) {
  // If req is provided, use admin.auth.getUser(token) for reliable auth
  let userId: string | null = null;

  if (req) {
    const user = await getUserFromRequest(req);
    if (!user) return null;
    userId = user.id;
  } else if (supabase) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    userId = user.id;
  }

  if (!userId) return null;

  const admin = createAdminSupabaseClient();
  if (!admin) return null;

  const { data: profile } = await admin
    .from('user_profiles').select('*').eq('id', userId).single();
  if (!profile) return null;

  const { data: userRoles } = await admin
    .from('user_roles')
    .select(`id, role_id, assigned_at, assigned_by,
      roles (
        id, name, department_id, permissions, is_system_role,
        departments (id, name, description)
      )`)
    .eq('user_id', userId);

  return { ...profile, user_roles: userRoles || [] };
}
