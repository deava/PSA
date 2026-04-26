"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/workflows/steps/assignments
 * List all workflow nodes with their assignments for a workflow instance
 * Query params:
 *   - workflowInstanceId (required)
 *   - userId (optional) - if provided, includes eligibility info for this user
 */
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get user profile with roles for permission checking
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
        const { searchParams } = new URL(request.url);
        const workflowInstanceId = searchParams.get('workflowInstanceId');
        const targetUserId = searchParams.get('userId'); // User we're checking eligibility for
        if (!workflowInstanceId) {
            return server_1.NextResponse.json({ error: 'workflowInstanceId is required' }, { status: 400 });
        }
        // Access check: verify user has access to this workflow's project (superadmins bypass)
        if (!isSuperadmin) {
            const accessCheck = await (0, access_control_server_1.verifyWorkflowInstanceAccess)(supabase, user.id, workflowInstanceId);
            if (!accessCheck.hasAccess) {
                return server_1.NextResponse.json({ error: 'You do not have access to this workflow instance' }, { status: 403 });
            }
        }
        // Get the workflow instance to get its template_id
        const { data: instance, error: instanceError } = await supabase
            .from('workflow_instances')
            .select('workflow_template_id')
            .eq('id', workflowInstanceId)
            .single();
        if (instanceError || !instance) {
            return server_1.NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
        }
        // Get all nodes for this workflow template (excluding start/end nodes)
        const { data: nodes, error: nodesError } = await supabase
            .from('workflow_nodes')
            .select('id, label, node_type, entity_id, position_y')
            .eq('workflow_template_id', instance.workflow_template_id)
            .not('node_type', 'in', '("start","end")')
            .order('position_y', { ascending: true });
        if (nodesError) {
            debug_logger_1.logger.error('Error fetching workflow nodes', {}, nodesError);
            return server_1.NextResponse.json({ error: 'Failed to fetch workflow nodes' }, { status: 500 });
        }
        // Get role names for entity_ids (for role/approval/department nodes)
        const entityIds = (nodes || [])
            .map((n) => n.entity_id)
            .filter((id) => id !== null);
        const roleNamesMap = {};
        const departmentNamesMap = {};
        if (entityIds.length > 0) {
            // Get role names
            const { data: roles } = await supabase
                .from('roles')
                .select('id, name')
                .in('id', entityIds);
            if (roles) {
                for (const role of roles) {
                    roleNamesMap[role.id] = role.name;
                }
            }
            // Get department names (for department nodes)
            const { data: departments } = await supabase
                .from('departments')
                .select('id, name')
                .in('id', entityIds);
            if (departments) {
                for (const dept of departments) {
                    departmentNamesMap[dept.id] = dept.name;
                }
            }
        }
        // If targetUserId is provided, get their roles for eligibility checking
        let targetUserRoleIds = [];
        let targetUserDepartmentIds = [];
        if (targetUserId) {
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('role_id, roles(department_id)')
                .eq('user_id', targetUserId);
            if (userRoles) {
                targetUserRoleIds = userRoles.map((ur) => ur.role_id);
                targetUserDepartmentIds = userRoles
                    .map((ur) => {
                    const roles = ur.roles;
                    const role = Array.isArray(roles) ? roles[0] : roles;
                    return role?.department_id;
                })
                    .filter((id) => id !== null);
            }
        }
        // Get all assignments for this workflow instance
        const { data: assignments, error: assignmentsError } = await supabase
            .from('workflow_node_assignments')
            .select(`
        id,
        node_id,
        user_id,
        assigned_at,
        assigned_by,
        user_profiles(
          id,
          name,
          email
        )
      `)
            .eq('workflow_instance_id', workflowInstanceId);
        if (assignmentsError) {
            debug_logger_1.logger.error('Error fetching node assignments', {}, assignmentsError);
            return server_1.NextResponse.json({ error: 'Failed to fetch assignments' }, { status: 500 });
        }
        // Build a map of node_id -> assignments
        const assignmentsByNode = {};
        for (const assignment of assignments || []) {
            if (!assignmentsByNode[assignment.node_id]) {
                assignmentsByNode[assignment.node_id] = [];
            }
            assignmentsByNode[assignment.node_id].push(assignment);
        }
        // Enrich nodes with their assignments and eligibility info
        const nodesWithAssignments = (nodes || []).map((node) => {
            // Determine required entity name based on node type
            let requiredEntityName = null;
            let userEligible = true; // Default to eligible if no entity_id
            if (node.entity_id) {
                if (node.node_type === 'role' || node.node_type === 'approval') {
                    requiredEntityName = roleNamesMap[node.entity_id] || null;
                    // Check if target user has this role
                    if (targetUserId) {
                        userEligible = targetUserRoleIds.includes(node.entity_id);
                    }
                }
                else if (node.node_type === 'department') {
                    requiredEntityName = departmentNamesMap[node.entity_id] || null;
                    // Check if target user is in this department
                    if (targetUserId) {
                        userEligible = targetUserDepartmentIds.includes(node.entity_id);
                    }
                }
            }
            // Check if user is already assigned to this node
            const existingAssignments = assignmentsByNode[node.id] || [];
            const userAlreadyAssigned = targetUserId
                ? existingAssignments.some((a) => a.user_id === targetUserId)
                : false;
            return {
                ...node,
                assignments: existingAssignments,
                required_entity_name: requiredEntityName,
                user_eligible: userEligible,
                user_already_assigned: userAlreadyAssigned,
            };
        });
        return server_1.NextResponse.json({
            success: true,
            nodes: nodesWithAssignments,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/workflows/steps/assignments', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/workflows/steps/assignments
 * Assign a user to a workflow node
 * Body: { workflowInstanceId, nodeId, userId }
 */
async function POST(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get user profile with roles for permission checking
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = { id: userProfile.id };
        // Permission check: user needs EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { workflowInstanceId, nodeId, userId } = body;
        if (!workflowInstanceId || !nodeId || !userId) {
            return server_1.NextResponse.json({ error: 'workflowInstanceId, nodeId, and userId are required' }, { status: 400 });
        }
        const isSuperadmin = userProfile.is_superadmin === true;
        if (!isSuperadmin) {
            // Get the workflow instance and check if user is project creator
            const { data: instance } = await supabase
                .from('workflow_instances')
                .select(`
          project_id,
          projects!inner(created_by)
        `)
                .eq('id', workflowInstanceId)
                .single();
            if (!instance) {
                return server_1.NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
            }
            const projects = instance.projects;
            const project = Array.isArray(projects) ? projects[0] : projects;
            const projectCreatedBy = project?.created_by;
            if (projectCreatedBy !== user.id) {
                return server_1.NextResponse.json({ error: 'Only the project creator or superadmins can assign users to workflow nodes' }, { status: 403 });
            }
        }
        // Check if assignment already exists
        const { data: existingAssignment } = await supabase
            .from('workflow_node_assignments')
            .select('id')
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nodeId)
            .eq('user_id', userId)
            .single();
        if (existingAssignment) {
            return server_1.NextResponse.json({ error: 'User is already assigned to this node' }, { status: 409 });
        }
        // Create the assignment
        const { data: assignment, error } = await supabase
            .from('workflow_node_assignments')
            .insert({
            workflow_instance_id: workflowInstanceId,
            node_id: nodeId,
            user_id: userId,
            assigned_by: user.id,
        })
            .select(`
        id,
        node_id,
        user_id,
        assigned_at,
        user_profiles(
          id,
          name,
          email
        )
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error creating node assignment', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to create assignment' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            assignment,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/steps/assignments', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/workflows/steps/assignments
 * Remove a user from a workflow node
 * Query params: workflowInstanceId, nodeId, userId
 */
async function DELETE(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get user profile with roles for permission checking
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const user = { id: userProfile.id };
        // Permission check: user needs EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const workflowInstanceId = searchParams.get('workflowInstanceId');
        const nodeId = searchParams.get('nodeId');
        const userId = searchParams.get('userId');
        if (!workflowInstanceId || !nodeId || !userId) {
            return server_1.NextResponse.json({ error: 'workflowInstanceId, nodeId, and userId are required' }, { status: 400 });
        }
        const isSuperadmin = userProfile.is_superadmin === true;
        if (!isSuperadmin) {
            // Get the workflow instance and check if user is project creator
            const { data: instance } = await supabase
                .from('workflow_instances')
                .select(`
          project_id,
          projects!inner(created_by)
        `)
                .eq('id', workflowInstanceId)
                .single();
            if (!instance) {
                return server_1.NextResponse.json({ error: 'Workflow instance not found' }, { status: 404 });
            }
            const projects = instance.projects;
            const project = Array.isArray(projects) ? projects[0] : projects;
            const projectCreatedBy = project?.created_by;
            if (projectCreatedBy !== user.id) {
                return server_1.NextResponse.json({ error: 'Only the project creator or superadmins can remove users from workflow nodes' }, { status: 403 });
            }
        }
        // Delete the assignment
        const { error } = await supabase
            .from('workflow_node_assignments')
            .delete()
            .eq('workflow_instance_id', workflowInstanceId)
            .eq('node_id', nodeId)
            .eq('user_id', userId);
        if (error) {
            debug_logger_1.logger.error('Error deleting node assignment', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to delete assignment' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/workflows/steps/assignments', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
