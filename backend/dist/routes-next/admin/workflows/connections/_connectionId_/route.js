"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const debug_logger_1 = require("@/lib/debug-logger");
// DELETE /api/admin/workflows/connections/[connectionId] - Delete workflow connection
async function DELETE(request, { params }) {
    const { connectionId } = await params;
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
        // Check MANAGE_WORKFLOWS permission
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Delete connection
        await (0, workflow_service_1.deleteWorkflowConnection)(connectionId);
        return server_1.NextResponse.json({ success: true, message: 'Workflow connection deleted successfully' }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/admin/workflows/connections/[connectionId]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
