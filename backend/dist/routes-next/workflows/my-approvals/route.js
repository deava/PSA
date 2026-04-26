"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const workflow_execution_service_1 = require("@/lib/workflow-execution-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get current user with profile
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const isSuperadmin = userProfile.is_superadmin === true;
        const user = { id: userProfile.id };
        let approvals = [];
        if (isSuperadmin) {
            // Superadmins see ALL pending approvals across all users
            // Query workflow_active_steps to support parallel workflows
            // IMPORTANT: Use left join for workflow_nodes so deleted templates don't break the query
            // Query without workflow_nodes FK join - use snapshot data instead
            // The FK workflow_active_steps_node_id_fkey may not exist if node was deleted after workflow started
            // Use explicit FK names to avoid "multiple relationships" errors
            const { data: activeSteps, error } = await supabase
                .from('workflow_active_steps')
                .select(`
          id,
          workflow_instance_id,
          node_id,
          status,
          activated_at,
          assigned_user_id,
          workflow_instances:workflow_active_steps_workflow_instance_id_fkey!inner(
            id,
            status,
            project_id,
            workflow_template_id,
            current_node_id,
            started_snapshot,
            projects:workflow_instances_project_id_fkey!inner(
              id,
              name,
              description,
              status,
              priority,
              account_id,
              accounts(id, name)
            )
          ),
          assigned_user:user_profiles(
            id,
            name,
            email
          )
        `)
                .eq('status', 'active');
            if (error) {
                debug_logger_1.logger.error('[my-approvals] Error querying active steps', {}, error);
            }
            if (!error && activeSteps) {
                // Filter to only approval nodes in active workflow instances
                const filteredSteps = activeSteps.filter((step) => {
                    const instance = step.workflow_instances;
                    if (!instance)
                        return false;
                    if (instance.status !== 'active')
                        return false;
                    // Get node data from snapshot (we removed the FK join because it may not exist)
                    const snapshot = instance.started_snapshot;
                    const nodes = snapshot?.nodes;
                    const node = nodes?.find((n) => n.id === step.node_id);
                    if (!node) {
                        debug_logger_1.logger.warn('[my-approvals] Node not found in snapshot', { stepId: step.id, nodeId: step.node_id });
                        return false;
                    }
                    return node.node_type === 'approval';
                });
                // Transform to match expected format
                approvals = filteredSteps.map((step) => {
                    // Get node data from snapshot
                    const instance = step.workflow_instances;
                    const snapshot = instance.started_snapshot;
                    const nodes = snapshot?.nodes;
                    const nodeData = nodes?.find((n) => n.id === step.node_id);
                    return {
                        ...instance,
                        workflow_nodes: nodeData,
                        projects: instance.projects,
                        active_step_id: step.id,
                        current_node_id: step.node_id,
                        assigned_user: step.assigned_user || null
                    };
                });
            }
        }
        else {
            // Regular users see only their pending approvals based on role
            approvals = await (0, workflow_execution_service_1.getUserPendingApprovals)(supabase, user.id);
        }
        return server_1.NextResponse.json({
            success: true,
            approvals,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/workflows/my-approvals', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
