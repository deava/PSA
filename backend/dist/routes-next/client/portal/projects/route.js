"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const client_portal_service_1 = require("@/lib/client-portal-service");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/client/portal/projects - Get all projects for client's account
async function GET(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get user profile
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Verify user is a client (hardcoded check - client permissions are implicit)
        if (!userProfile.is_client) {
            return server_1.NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
        }
        if (!userProfile.client_account_id) {
            return server_1.NextResponse.json({ error: 'Client user is not associated with an account' }, { status: 400 });
        }
        // Get client projects
        const projects = await (0, client_portal_service_1.getClientProjects)(user.id);
        return server_1.NextResponse.json({ success: true, projects }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/client/portal/projects', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
