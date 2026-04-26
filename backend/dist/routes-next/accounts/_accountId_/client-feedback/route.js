"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
// GET /api/accounts/[id]/client-feedback - View feedback for specific account
async function GET(request, { params }) {
    try {
        const { accountId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
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
        const canViewFeedback = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_CLIENT_INVITES, undefined, admin);
        if (!canViewFeedback) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view client feedback' }, { status: 403 });
        }
        // Verify user has access to this account
        const hasAccess = await (0, access_control_server_1.hasAccountAccessServer)(supabase, user.id, accountId);
        if (!hasAccess) {
            return server_1.NextResponse.json({
                error: 'You do not have access to this account'
            }, { status: 403 });
        }
        // Get feedback for account with enriched data
        const { data: feedback, error: feedbackError } = await admin
            .from('client_feedback')
            .select(`
        *,
        projects!inner (
          id,
          name,
          account_id
        ),
        user_profiles (
          id,
          name,
          email
        )
      `)
            .eq('projects.account_id', accountId)
            .order('submitted_at', { ascending: false });
        if (feedbackError) {
            debug_logger_1.logger.error('Error fetching feedback', {}, feedbackError);
            return server_1.NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true, feedback: feedback || [] }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/accounts/[id]/client-feedback', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
