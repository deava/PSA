"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const client_portal_service_1 = require("@/lib/client-portal-service");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/admin/client-feedback - Admin view of all client feedback
async function GET(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get user profile with roles
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select(`
        *,
        user_roles!user_id(
          roles!role_id(
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Phase 9: VIEW_CLIENT_FEEDBACK → MANAGE_CLIENT_INVITES (consolidated admin permission)
        const canView = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_CLIENT_INVITES, undefined, admin);
        if (!canView) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view client feedback' }, { status: 403 });
        }
        // Get all feedback
        const feedback = await (0, client_portal_service_1.getAllClientFeedback)();
        return server_1.NextResponse.json({ success: true, feedback }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/admin/client-feedback', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
