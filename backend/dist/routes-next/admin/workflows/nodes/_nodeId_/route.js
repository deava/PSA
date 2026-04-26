"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
// PATCH /api/admin/workflows/nodes/[nodeId] - Update workflow node
async function PATCH(request, { params }) {
    const { nodeId } = await params;
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
        // Check MANAGE_WORKFLOWS permission
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Validate request body
        const body = await request.json();
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.updateWorkflowNodeSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Update node
        const node = await (0, workflow_service_1.updateWorkflowNode)(nodeId, validation.data);
        if (!node) {
            return server_1.NextResponse.json({ error: 'Workflow node not found' }, { status: 404 });
        }
        return server_1.NextResponse.json({ success: true, node }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PATCH /api/admin/workflows/nodes/[nodeId]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// DELETE /api/admin/workflows/nodes/[nodeId] - Delete workflow node
async function DELETE(request, { params }) {
    const { nodeId } = await params;
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
        // Check MANAGE_WORKFLOWS permission
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Delete node
        await (0, workflow_service_1.deleteWorkflowNode)(nodeId);
        return server_1.NextResponse.json({ success: true, message: 'Workflow node deleted successfully' }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/admin/workflows/nodes/[nodeId]', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
