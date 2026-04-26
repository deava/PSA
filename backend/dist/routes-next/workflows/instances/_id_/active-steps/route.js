"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const workflow_execution_service_1 = require("@/lib/workflow-execution-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * GET /api/workflows/instances/[id]/active-steps
 * Returns all active and waiting steps for a workflow instance
 */
async function GET(request, { params }) {
    try {
        const resolvedParams = await params;
        const workflowInstanceId = resolvedParams.id;
        if (!(0, validation_helpers_1.isValidUUID)(workflowInstanceId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Auth check - require authenticated user with profile
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = { id: userProfile.id };
        const isSuperadmin = userProfile.is_superadmin === true;
        // Permission check: user needs EXECUTE_WORKFLOWS permission
        const canView = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canView) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        // Access check: verify user has access to this workflow's project (superadmins bypass)
        if (!isSuperadmin) {
            const accessCheck = await (0, access_control_server_1.verifyWorkflowInstanceAccess)(supabase, user.id, workflowInstanceId);
            if (!accessCheck.hasAccess) {
                return server_1.NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
            }
        }
        // Get active steps
        const activeSteps = await (0, workflow_execution_service_1.getActiveSteps)(supabase, workflowInstanceId);
        // Get all steps including waiting
        const allSteps = await (0, workflow_execution_service_1.getAllActiveAndWaitingSteps)(supabase, workflowInstanceId);
        // Check completion status
        const complete = await (0, workflow_execution_service_1.isWorkflowComplete)(supabase, workflowInstanceId);
        // Count unique completed branches
        const { data: completedSteps } = await supabase
            .from('workflow_active_steps')
            .select('branch_id')
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('status', 'completed');
        const completedBranches = new Set(completedSteps?.map((s) => s.branch_id) || []).size;
        // Count waiting branches
        const waitingBranches = allSteps.filter((s) => s.status === 'waiting').length;
        // Derive hasParallelPaths from unique branch_ids in active steps
        const allBranchIds = new Set(allSteps.map((s) => s.branch_id).filter(Boolean));
        const hasParallelPaths = allBranchIds.size > 1;
        // Enrich active steps with node information (bulk fetch to avoid N+1 queries)
        const allNodeIds = [...new Set(allSteps.map((s) => s.node_id).filter(Boolean))];
        const allUserIds = [...new Set(allSteps.map((s) => s.assigned_user_id).filter(Boolean))];
        const [nodesResult, usersResult] = await Promise.all([
            allNodeIds.length > 0
                ? admin.from('workflow_nodes').select('id, label, node_type, entity_id, settings, form_template_id, position_x, position_y').in('id', allNodeIds)
                : { data: [] },
            allUserIds.length > 0
                ? admin.from('user_profiles').select('id, name, email').in('id', allUserIds)
                : { data: [] },
        ]);
        const nodesMap = new Map((nodesResult.data || []).map((n) => [n.id, n]));
        const usersMap = new Map((usersResult.data || []).map((u) => [u.id, u]));
        const enrichedSteps = allSteps.map((step) => ({
            ...step,
            node: nodesMap.get(step.node_id) || null,
            assignedUser: step.assigned_user_id ? usersMap.get(step.assigned_user_id) || null : null,
        }));
        return server_1.NextResponse.json({
            activeSteps: enrichedSteps.filter((s) => s.status === 'active'),
            waitingSteps: enrichedSteps.filter((s) => s.status === 'waiting'),
            allSteps: enrichedSteps,
            isComplete: complete,
            hasParallelPaths,
            completedBranches,
            waitingBranches,
            activeBranches: activeSteps.length
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error fetching active steps', {}, error);
        return server_1.NextResponse.json({ error: 'Failed to fetch active steps' }, { status: 500 });
    }
}
