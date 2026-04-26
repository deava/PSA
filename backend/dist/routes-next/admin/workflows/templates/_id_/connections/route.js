"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
// POST /api/admin/workflows/templates/[id]/connections - Create workflow connection
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
        // Check MANAGE_WORKFLOWS permission
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to manage workflows' }, { status: 403 });
        }
        // Validate request body
        const body = await request.json();
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.createWorkflowConnectionSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Create connection
        const connection = await (0, workflow_service_1.createWorkflowConnection)(id, validation.data.from_node_id, validation.data.to_node_id, validation.data.condition);
        return server_1.NextResponse.json({ success: true, connection }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/admin/workflows/templates/[id]/connections', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
