"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const workflow_execution_service_1 = require("@/lib/workflow-execution-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
async function POST(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get current user with roles for permission checking
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Permission check: user needs EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to progress workflows' }, { status: 403 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { workflowInstanceId, activeStepId, // NEW: for parallel workflow support
        decision, feedback, formResponseId, assignedUserId, assignedUsersPerNode, // NEW: map of nodeId -> userId for parallel branches
        formData } = body;
        if (!workflowInstanceId) {
            return server_1.NextResponse.json({ error: 'Missing required field: workflowInstanceId' }, { status: 400 });
        }
        // Verify user has access to this workflow's project (superadmins bypass)
        if (!userProfile.is_superadmin) {
            const accessCheck = await (0, access_control_server_1.verifyWorkflowInstanceAccess)(supabase, userProfile.id, workflowInstanceId);
            if (!accessCheck.hasAccess) {
                return server_1.NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
            }
        }
        // Use the new progressWorkflowStep function which supports parallel workflows
        // If activeStepId is provided, it progresses that specific step
        // If not provided, it falls back to legacy behavior using current_node_id
        const result = await (0, workflow_execution_service_1.progressWorkflowStep)(supabase, workflowInstanceId, activeStepId || null, // Pass null for legacy behavior
        userProfile.id, decision, feedback, formResponseId, assignedUserId, formData, assignedUsersPerNode // NEW: map of nodeId -> userId for parallel branches
        );
        if (!result.success) {
            return server_1.NextResponse.json({ error: result.error }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            nextNode: result.nextNode,
            newActiveSteps: result.newActiveSteps || [], // Include new active steps for parallel workflows
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/progress', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
