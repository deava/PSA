"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/workflows/instances/[id]/history - Get complete workflow history
async function GET(request, { params }) {
    const { id } = await params;
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
        // Check EXECUTE_WORKFLOWS permission (users viewing their assigned workflow history)
        const canView = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canView) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
        }
        // Verify user has access to the workflow instance's project (superadmins bypass)
        if (!userProfile.is_superadmin) {
            const accessCheck = await (0, access_control_server_1.verifyWorkflowInstanceAccess)(supabase, user.id, id);
            if (!accessCheck.hasAccess) {
                return server_1.NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
            }
        }
        // Get workflow history
        const history = await (0, workflow_service_1.getWorkflowHistory)(id);
        return server_1.NextResponse.json({ success: true, history }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/workflows/instances/[id]/history', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
