"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
// Type definitions
// GET /api/admin/workflows/templates/[id] - Get workflow template with nodes and connections
async function GET(request, { params }) {
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
          role_id,
          roles!role_id(
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Check VIEW_WORKFLOWS permission (pass supabase client for server context)
        const canView = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canView) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view workflows' }, { status: 403 });
        }
        // Get template with nodes and connections
        const template = await (0, workflow_service_1.getWorkflowTemplateById)(id);
        if (!template) {
            return server_1.NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
        }
        return server_1.NextResponse.json({ success: true, template }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/admin/workflows/templates/[id]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// PATCH /api/admin/workflows/templates/[id] - Update workflow template
async function PATCH(request, { params }) {
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
          role_id,
          roles!role_id(
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Check MANAGE_WORKFLOWS permission (pass supabase client for server context)
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Validate request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.updateWorkflowTemplateSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // If activating the workflow, validate that all roles have users assigned
        if (validation.data.is_active === true) {
            // Get workflow nodes
            const { data: nodes } = await admin
                .from('workflow_nodes')
                .select('id, node_type, entity_id, label')
                .eq('workflow_template_id', id);
            if (nodes && nodes.length > 0) {
                // Get role IDs from role and approval nodes
                const roleIds = nodes
                    .filter((n) => (n.node_type === 'role' || n.node_type === 'approval') && n.entity_id)
                    .map((n) => n.entity_id);
                if (roleIds.length > 0) {
                    // Get roles with user counts
                    const { data: roles } = await admin
                        .from('roles')
                        .select(`
              id,
              name,
              user_roles!user_id(count)
            `)
                        .in('id', roleIds);
                    // Check for roles with no users
                    const emptyRoles = (roles || []).filter((r) => {
                        const count = r.user_roles?.[0]?.count || 0;
                        return count === 0;
                    });
                    if (emptyRoles.length > 0) {
                        const nodeLabels = nodes
                            .filter((n) => emptyRoles.some((r) => r.id === n.entity_id))
                            .map((n) => `"${n.label}"`)
                            .join(', ');
                        const roleNames = emptyRoles.map((r) => `"${r.name}"`).join(', ');
                        return server_1.NextResponse.json({
                            error: `Cannot activate workflow: ${emptyRoles.length === 1 ? 'Role' : 'Roles'} ${roleNames} ${emptyRoles.length === 1 ? 'has' : 'have'} no users assigned. Affected nodes: ${nodeLabels}. Please assign users to these roles first.`
                        }, { status: 400 });
                    }
                }
            }
            else {
                // No nodes - cannot activate
                return server_1.NextResponse.json({
                    error: 'Cannot activate workflow: No nodes configured. Please add at least a Start and End node.'
                }, { status: 400 });
            }
        }
        // Update template
        const updates = {
            ...validation.data,
            description: validation.data.description === null ? undefined : validation.data.description
        };
        const template = await (0, workflow_service_1.updateWorkflowTemplate)(id, updates, admin);
        if (!template) {
            return server_1.NextResponse.json({ error: 'Workflow template not found' }, { status: 404 });
        }
        return server_1.NextResponse.json({ success: true, template }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PATCH /api/admin/workflows/templates/[id]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// DELETE /api/admin/workflows/templates/[id] - Permanently delete workflow template
async function DELETE(request, { params }) {
    const { id } = await params;
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_workflow');
        if (blocked)
            return blocked;
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
          role_id,
          roles!role_id(
            id,
            name,
            permissions,
            department_id,
            is_system_role
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Check MANAGE_WORKFLOWS permission (pass supabase client for server context)
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Permanently delete template and all associated nodes/connections
        // NOTE: In-progress workflows will continue to work - they have their own snapshots
        await (0, workflow_service_1.deleteWorkflowTemplate)(id, admin);
        return server_1.NextResponse.json({
            success: true,
            message: 'Workflow template deleted successfully. Existing projects will continue using their workflow snapshots.'
        }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/admin/workflows/templates/[id]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
