"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const workflow_service_1 = require("@/lib/workflow-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/admin/workflows/templates - List all workflow templates
async function GET(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select(`*, user_roles!user_id(role_id, roles!role_id(id,name,permissions,department_id,is_system_role))`)
            .eq('id', user.id).single();
        if (!userProfile)
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        const canView = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canView)
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';
        const templates = includeInactive ? await (0, workflow_service_1.getAllWorkflowTemplates)() : await (0, workflow_service_1.getWorkflowTemplates)();
        return server_1.NextResponse.json({ success: true, templates }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/admin/workflows/templates', {}, error);
        const err = error;
        console.error('[GET /api/admin/workflows/templates] ERROR:', err?.message, err?.code, err?.details);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// POST /api/admin/workflows/templates - Create new workflow template
async function POST(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        const { data: userProfile, error: profileError } = await admin
            .from('user_profiles')
            .select(`*, user_roles!user_id(role_id, roles!role_id(id,name,permissions,department_id,is_system_role))`)
            .eq('id', user.id).single();
        console.log('[POST templates] userProfile:', JSON.stringify({ id: userProfile?.id, is_superadmin: userProfile?.is_superadmin, profileError: profileError?.message }));
        if (!userProfile)
            return server_1.NextResponse.json({ error: 'User profile not found', details: profileError?.message }, { status: 404 });
        const canManage = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        console.log('[POST templates] canManage:', canManage);
        if (!canManage)
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        // Validate request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.createWorkflowTemplateSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Create template
        console.log('[POST /api/admin/workflows/templates] Creating template:', { name: validation.data.name, userId: user.id });
        const template = await (0, workflow_service_1.createWorkflowTemplate)(validation.data.name, validation.data.description || null, user.id);
        return server_1.NextResponse.json({ success: true, template }, { status: 201 });
    }
    catch (error) {
        const err = error;
        console.error('[POST /api/admin/workflows/templates] ERROR:', {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
            stack: err?.stack,
        });
        debug_logger_1.logger.error('Error in POST /api/admin/workflows/templates', {
            message: err?.message,
            code: err?.code,
            details: err?.details,
            hint: err?.hint,
        }, error);
        return server_1.NextResponse.json({ error: err?.message || 'Internal server error', details: err?.details || err?.hint }, { status: 500 });
    }
}
