"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
/**
 * GET /api/onboarding/tutorial-progress/check-action?action=create_department
 * Checks if a required tutorial action has been completed.
 * Used by the tutorial provider to poll for action completion.
 */
async function GET(request) {
    const supabase = createApiSupabaseClient(request);
    if (!supabase) {
        return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    const { data: { user }, error: authError, } = await admin.auth.getUser();
    if (authError || !user) {
        return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const action = request.nextUrl.searchParams.get('action');
    if (!action) {
        return server_1.NextResponse.json({ error: 'Missing "action" query parameter' }, { status: 400 });
    }
    const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
    if (!adminSupabase) {
        return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const completed = await checkActionCompleted(adminSupabase, action);
    return server_1.NextResponse.json({ action, completed });
}
async function checkActionCompleted(adminSupabase, action) {
    switch (action) {
        case 'create_department': {
            const { count } = await adminSupabase
                .from('departments')
                .select('*', { count: 'exact', head: true });
            return (count ?? 0) > 0;
        }
        case 'create_role': {
            const { count } = await adminSupabase
                .from('roles')
                .select('*', { count: 'exact', head: true })
                .eq('is_system_role', false);
            return (count ?? 0) > 0;
        }
        case 'send_invitation': {
            const { count } = await adminSupabase
                .from('user_invitations')
                .select('*', { count: 'exact', head: true });
            return (count ?? 0) > 0;
        }
        default:
            return true;
    }
}
