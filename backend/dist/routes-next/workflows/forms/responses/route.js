"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const form_service_1 = require("@/lib/form-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
// POST /api/workflows/forms/responses - Submit a form response
async function POST(request) {
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
        // Phase 9: Forms are inline-only in workflows - check EXECUTE_WORKFLOWS permission
        const canSubmit = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canSubmit) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to submit forms (requires workflow execution permission)' }, { status: 403 });
        }
        // Validate request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.submitFormResponseSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // If workflow_history_id is provided, verify user has access to that workflow
        if (validation.data.workflow_history_id) {
            const accessCheck = await (0, access_control_server_1.verifyWorkflowHistoryAccess)(supabase, user.id, validation.data.workflow_history_id);
            if (!accessCheck.hasAccess) {
                return server_1.NextResponse.json({
                    error: accessCheck.error || 'You do not have access to this workflow'
                }, { status: 403 });
            }
        }
        // Submit form response
        const response = await (0, form_service_1.submitFormResponse)({
            formTemplateId: validation.data.form_template_id,
            responseData: validation.data.response_data,
            submittedBy: user.id,
            workflowHistoryId: validation.data.workflow_history_id || null
        });
        return server_1.NextResponse.json({ success: true, response }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/workflows/forms/responses', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
