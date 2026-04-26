"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const form_service_1 = require("@/lib/form-service");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
// GET /api/workflows/history/[historyId]/form - Get form response for workflow history entry
async function GET(request, { params }) {
    const { historyId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(historyId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
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
        // Phase 9: Forms are inline-only in workflows, check workflow permissions instead
        const canViewWorkflow = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin) ||
            await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canViewWorkflow) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view workflow forms' }, { status: 403 });
        }
        // Verify user has access to the workflow history's project
        const accessCheck = await (0, access_control_server_1.verifyWorkflowHistoryAccess)(supabase, user.id, historyId);
        if (!accessCheck.hasAccess) {
            return server_1.NextResponse.json({
                error: accessCheck.error || 'You do not have access to this workflow history'
            }, { status: 403 });
        }
        // Get form response
        const response = await (0, form_service_1.getFormResponseByHistoryId)(historyId);
        if (!response) {
            return server_1.NextResponse.json({ error: 'Form response not found for this workflow history entry' }, { status: 404 });
        }
        return server_1.NextResponse.json({ success: true, response }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/workflows/history/[historyId]/form', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
