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
// POST /api/workflows/instances/[id]/handoff - Hand off work to next node
async function POST(request, { params }) {
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
        // Check EXECUTE_WORKFLOWS permission with workflow instance context
        // This checks both base permission AND workflow node assignment
        // Users with EXECUTE_ANY_WORKFLOW override can bypass node assignment check
        const canExecute = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, { workflowInstanceId: id }, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({
                error: 'Insufficient permissions to execute this workflow. You must be assigned to the current workflow node.'
            }, { status: 403 });
        }
        // Validate request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.workflowHandoffSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Verify user has access to the workflow instance's project
        const accessCheck = await (0, access_control_server_1.verifyWorkflowInstanceAccess)(supabase, user.id, id);
        if (!accessCheck.hasAccess) {
            return server_1.NextResponse.json({
                error: accessCheck.error || 'You do not have access to this workflow instance'
            }, { status: 403 });
        }
        // Check if out-of-order handoff requires special permission
        if (validation.data.out_of_order) {
            const canSkip = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.SKIP_WORKFLOW_NODES, undefined, admin);
            if (!canSkip) {
                return server_1.NextResponse.json({
                    error: 'Insufficient permissions for out-of-order handoffs.'
                }, { status: 403 });
            }
        }
        // Execute handoff
        const historyEntry = await (0, workflow_service_1.handoffWorkflow)(supabase, {
            instanceId: id,
            toNodeId: validation.data.to_node_id,
            handedOffBy: user.id,
            handedOffTo: validation.data.handed_off_to || null,
            formResponseId: validation.data.form_response_id || null,
            notes: validation.data.notes || null,
            outOfOrder: validation.data.out_of_order || false
        });
        return server_1.NextResponse.json({ success: true, history_entry: historyEntry }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/instances/[id]/handoff', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
