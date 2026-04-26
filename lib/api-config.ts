/**
 * API configuration — points to the standalone Express backend.
 */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Build a full API URL from a path like '/api/projects'
 */
export function apiUrl(path: string): string {
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Fetch wrapper that automatically points to the backend
 * and forwards the Supabase auth token from the browser session.
 */
export async function apiFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  // Get the current session token from Supabase client
  let token: string | null = null;
  try {
    const { createClientSupabase } = await import('./supabase');
    const supabase = createClientSupabase();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token ?? null;
    }
  } catch {
    // ignore — proceed without token
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(init.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = apiUrl(path);
  return fetch(url, { ...init, headers, credentials: 'include' });
}
