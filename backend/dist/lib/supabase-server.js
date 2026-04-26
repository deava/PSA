"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createServerSupabase = exports.createServerSupabaseClient = exports.createApiSupabaseClient = exports.createAdminSupabaseClient = exports.isSupabaseConfigured = void 0;
exports.extractToken = extractToken;
exports.getUserFromRequest = getUserFromRequest;
exports.getUserProfileFromRequest = getUserProfileFromRequest;
const supabase_js_1 = require("@supabase/supabase-js");
const FETCH_TIMEOUT = 30000;
const getUrl = () => process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const getAnonKey = () => process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';
const getServiceKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const isSupabaseConfigured = () => !!(getUrl() && getAnonKey());
exports.isSupabaseConfigured = isSupabaseConfigured;
const fetchWithTimeout = (input, init = {}) => fetch(input, { ...init, signal: init.signal || AbortSignal.timeout(FETCH_TIMEOUT) });
// ── Admin client (service role — bypasses RLS) ────────────────────────────────
const createAdminSupabaseClient = () => {
    const url = getUrl();
    const key = getServiceKey();
    if (!url || !key)
        return null;
    return (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { fetch: fetchWithTimeout },
    });
};
exports.createAdminSupabaseClient = createAdminSupabaseClient;
// ── Extract Bearer token from any request object ──────────────────────────────
function extractToken(req) {
    try {
        const h = req?.headers?.get
            ? req.headers.get('authorization') // Next.js Headers / fetch Request
            : req?.headers?.authorization; // Express req
        return h?.startsWith('Bearer ') ? h.slice(7) : null;
    }
    catch {
        return null;
    }
}
// ── User-scoped client (respects RLS via user JWT) ────────────────────────────
const createApiSupabaseClient = (req) => {
    if (!(0, exports.isSupabaseConfigured)())
        return null;
    const token = extractToken(req);
    const url = getUrl();
    const key = getAnonKey();
    // Always use the anon key + user JWT in Authorization header.
    // Supabase JS v2 respects Authorization header for auth.getUser() when
    // the client is created with global.headers.
    return (0, supabase_js_1.createClient)(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
            fetch: fetchWithTimeout,
        },
    });
};
exports.createApiSupabaseClient = createApiSupabaseClient;
// Alias for backwards compat
exports.createServerSupabaseClient = exports.createApiSupabaseClient;
const createServerSupabase = async () => (0, exports.createAdminSupabaseClient)();
exports.createServerSupabase = createServerSupabase;
// ── Get user from request (uses admin client to verify JWT) ───────────────────
async function getUserFromRequest(req) {
    const token = extractToken(req);
    if (!token)
        return null;
    // Use admin client's getUser(token) — this is the correct way to verify a JWT
    const admin = (0, exports.createAdminSupabaseClient)();
    if (!admin)
        return null;
    const { data: { user }, error } = await admin.auth.getUser(token);
    if (error || !user)
        return null;
    return user;
}
// ── Get full user profile from request ───────────────────────────────────────
async function getUserProfileFromRequest(supabase, req) {
    // If req is provided, use admin.auth.getUser(token) for reliable auth
    let userId = null;
    if (req) {
        const user = await getUserFromRequest(req);
        if (!user)
            return null;
        userId = user.id;
    }
    else if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user)
            return null;
        userId = user.id;
    }
    if (!userId)
        return null;
    const admin = (0, exports.createAdminSupabaseClient)();
    if (!admin)
        return null;
    const { data: profile } = await admin
        .from('user_profiles').select('*').eq('id', userId).single();
    if (!profile)
        return null;
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
