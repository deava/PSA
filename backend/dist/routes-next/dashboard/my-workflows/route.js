"use strict";
/**
 * API Route: My Workflows Dashboard
 * Returns summarized workflow data for the current user
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const debug_logger_1 = require("@/lib/debug-logger");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = userProfile.id;
        // Get user's roles for permission-based workflow matching
        const { data: userRoles } = await supabase
            .from('user_roles')
            .select('role_id, roles(id, name, department_id)')
            .eq('user_id', userId);
        const roleIds = userRoles?.map((ur) => Array.isArray(ur.roles) ? ur.roles[0]?.id : ur.roles?.id).filter(Boolean) || [];
        const departmentIds = userRoles?.map((ur) => {
            const roles = Array.isArray(ur.roles) ? ur.roles[0] : ur.roles;
            return roles?.department_id;
        }).filter(Boolean) || [];
        // 1. Get pending approvals (workflows awaiting user's action)
        // Optimized: Limit to 50 most recent active steps to reduce load
        const { data: pendingApprovals } = await supabase
            .from('workflow_active_steps')
            .select(`
        id,
        node_id,
        status,
        workflow_instance_id,
        activated_at,
        workflow_instances:workflow_active_steps_workflow_instance_id_fkey!inner(
          id,
          status,
          project_id,
          started_snapshot,
          projects:workflow_instances_project_id_fkey!inner(
            id,
            name,
            accounts(id, name)
          )
        )
      `)
            .eq('status', 'active')
            .order('activated_at', { ascending: false })
            .limit(50);
        // Filter to approval nodes that match user's role/department
        const awaitingAction = (pendingApprovals || []).filter((step) => {
            const instance = step.workflow_instances;
            if (!instance || instance.status !== 'active')
                return false;
            const snapshot = instance.started_snapshot;
            const nodes = snapshot?.nodes || [];
            const node = nodes.find((n) => n.id === step.node_id);
            if (!node || node.node_type !== 'approval')
                return false;
            // Check if this approval is for user's role or department
            if (node.entity_id) {
                if (roleIds.includes(node.entity_id) || departmentIds.includes(node.entity_id)) {
                    return true;
                }
            }
            return false;
        });
        // 2. Get active workflows user is part of
        const { data: nodeAssignments } = await supabase
            .from('workflow_node_assignments')
            .select(`
        id,
        node_id,
        workflow_instance_id,
        workflow_instances:workflow_node_assignments_workflow_instance_id_fkey!inner(
          id,
          status,
          project_id,
          projects:workflow_instances_project_id_fkey!inner(
            id,
            name,
            accounts(id, name)
          )
        ),
        workflow_nodes:workflow_node_assignments_node_id_fkey(
          id,
          label,
          node_type
        )
      `)
            .eq('user_id', userId);
        // Count active workflows (user is assigned to a node in an active workflow)
        const activeWorkflowIds = new Set();
        const pipelineWorkflows = [];
        if (nodeAssignments) {
            // Get current active steps for these instances
            const instanceIds = [...new Set(nodeAssignments.map((na) => na.workflow_instance_id))];
            const { data: activeSteps } = await supabase
                .from('workflow_active_steps')
                .select('workflow_instance_id, node_id')
                .in('workflow_instance_id', instanceIds)
                .eq('status', 'active');
            const activeStepsMap = {};
            if (activeSteps) {
                for (const step of activeSteps) {
                    if (!activeStepsMap[step.workflow_instance_id]) {
                        activeStepsMap[step.workflow_instance_id] = [];
                    }
                    activeStepsMap[step.workflow_instance_id].push(step.node_id);
                }
            }
            for (const assignment of nodeAssignments) {
                const instance = assignment.workflow_instances;
                if (instance?.status === 'active') {
                    activeWorkflowIds.add(assignment.workflow_instance_id);
                    // Check if this is a pipeline workflow (not yet at user's step)
                    const activeNodeIds = activeStepsMap[assignment.workflow_instance_id] || [];
                    const isCurrentlyActive = activeNodeIds.includes(assignment.node_id);
                    if (!isCurrentlyActive) {
                        const project = instance.projects;
                        const nodeData = assignment.workflow_nodes;
                        const nodeLabel = Array.isArray(nodeData) ? nodeData[0]?.label : nodeData?.label;
                        pipelineWorkflows.push({
                            instanceId: assignment.workflow_instance_id,
                            projectId: project?.id,
                            projectName: project?.name,
                            accountName: project?.accounts?.name,
                            stepName: nodeLabel || 'Unknown Step',
                        });
                    }
                }
            }
        }
        // 3. Get recently completed workflows (last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        // Optimized: Limit to 100 history entries to reduce load
        const { data: completedWorkflows } = await supabase
            .from('workflow_history')
            .select(`
        id,
        workflow_instance_id,
        created_at,
        workflow_instances:workflow_history_workflow_instance_id_fkey!inner(
          id,
          status,
          completed_at
        )
      `)
            .eq('transitioned_by', userId)
            .gte('created_at', thirtyDaysAgo.toISOString())
            .order('created_at', { ascending: false })
            .limit(100);
        const completedInstanceIds = new Set();
        if (completedWorkflows) {
            for (const wh of completedWorkflows) {
                const instance = wh.workflow_instances;
                if (instance?.status === 'completed') {
                    completedInstanceIds.add(wh.workflow_instance_id);
                }
            }
        }
        // Format response
        const response = {
            success: true,
            data: {
                awaitingAction: awaitingAction.length,
                activeWorkflows: activeWorkflowIds.size,
                inPipeline: pipelineWorkflows.length,
                completedRecently: completedInstanceIds.size,
                awaitingDetails: awaitingAction.slice(0, 3).map((step) => {
                    const instance = step.workflow_instances;
                    const project = instance?.projects;
                    return {
                        instanceId: step.workflow_instance_id,
                        projectId: project?.id,
                        projectName: project?.name,
                        accountName: project?.accounts?.name,
                        activatedAt: step.activated_at,
                    };
                }),
                pipelineDetails: pipelineWorkflows.slice(0, 3),
            },
        };
        return server_1.NextResponse.json(response);
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/dashboard/my-workflows', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
