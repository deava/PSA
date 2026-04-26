"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const workflow_execution_service_1 = require("@/lib/workflow-execution-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const rbac_1 = require("@/lib/rbac");
const debug_logger_1 = require("@/lib/debug-logger");
async function POST(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get current user
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { projectId, workflowTemplateId } = body;
        if (!projectId || !workflowTemplateId) {
            return server_1.NextResponse.json({ error: 'Missing required fields: projectId and workflowTemplateId' }, { status: 400 });
        }
        // Permission check: user needs EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to start workflows' }, { status: 403 });
        }
        // Access check: user must have access to the project
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
        }
        // Start the workflow
        const result = await (0, workflow_execution_service_1.startWorkflowForProject)(supabase, projectId, workflowTemplateId, userProfile.id);
        if (!result.success) {
            const notFoundErrors = ['Workflow template not found', 'Project not found'];
            const conflictErrors = ['already has an active workflow', 'already has a workflow'];
            const errorMsg = result.error || 'Failed to start workflow';
            if (notFoundErrors.some(e => errorMsg.includes(e))) {
                return server_1.NextResponse.json({ error: errorMsg }, { status: 404 });
            }
            if (conflictErrors.some(e => errorMsg.includes(e))) {
                return server_1.NextResponse.json({ error: errorMsg }, { status: 409 });
            }
            return server_1.NextResponse.json({ error: errorMsg }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            workflowInstanceId: result.workflowInstanceId,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/start', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
