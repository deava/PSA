"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const client_portal_service_1 = require("@/lib/client-portal-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
// POST /api/client/portal/projects/[id]/feedback - Submit client feedback
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
        // Phase 9: Client permissions are hardcoded - verify user is a client with account access
        if (!userProfile.is_client || !userProfile.client_account_id) {
            return server_1.NextResponse.json({ error: 'Client access required' }, { status: 403 });
        }
        // Validate request body
        const body = await request.json();
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.submitClientFeedbackSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Submit feedback
        const feedback = await (0, client_portal_service_1.submitClientFeedback)({
            projectId: id,
            clientUserId: user.id,
            satisfactionScore: validation.data.satisfaction_score || undefined,
            whatWentWell: validation.data.what_went_well || undefined,
            whatNeedsImprovement: validation.data.what_needs_improvement || undefined,
            workflowHistoryId: validation.data.workflow_history_id || undefined
        });
        return server_1.NextResponse.json({
            success: true,
            message: 'Thank you for your feedback!',
            feedback
        }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/client/portal/projects/[id]/feedback', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
