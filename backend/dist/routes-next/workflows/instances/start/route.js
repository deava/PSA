"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
// POST /api/workflows/instances/start - Start a workflow instance
async function POST(request) {
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
        // Check EXECUTE_WORKFLOWS permission
        const canExecute = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to execute workflows' }, { status: 403 });
        }
        // Validate request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.startWorkflowInstanceSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Verify user has access to the project if project_id is provided
        if (validation.data.project_id) {
            const hasAccess = await (0, access_control_server_1.isAssignedToProjectServer)(supabase, user.id, validation.data.project_id);
            if (!hasAccess) {
                return server_1.NextResponse.json({
                    error: 'You do not have access to this project'
                }, { status: 403 });
            }
        }
        // Start workflow instance
        const instance = await (0, workflow_service_1.startWorkflowInstance)({
            workflowTemplateId: validation.data.workflow_template_id,
            projectId: validation.data.project_id || null,
            taskId: validation.data.task_id || null,
            startNodeId: validation.data.start_node_id
        });
        return server_1.NextResponse.json({ success: true, instance }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/instances/start', {}, error);
        // Return specific messages for known validation errors, generic for others
        const errorMessage = error instanceof Error ? error.message : '';
        const isValidationError = errorMessage.includes('not active') ||
            errorMessage.includes('no nodes') ||
            errorMessage.includes('not found') ||
            errorMessage.includes('Invalid start node');
        return server_1.NextResponse.json({
            error: isValidationError ? errorMessage : 'Internal server error',
            success: false
        }, { status: isValidationError ? 400 : 500 });
    }
}
