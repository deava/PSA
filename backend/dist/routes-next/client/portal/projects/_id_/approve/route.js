"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const client_portal_service_1 = require("@/lib/client-portal-service");
const zod_1 = require("zod");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
const approveProjectSchema = zod_1.z.object({
    workflow_instance_id: zod_1.z.string().uuid('Invalid workflow instance ID'),
    notes: zod_1.z.string().max(2000, 'Notes too long').optional()
});
// POST /api/client/portal/projects/[id]/approve - Approve project at workflow approval node
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
        // Get user profile
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select('*')
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Verify user is a client (hardcoded check - client approval permissions are implicit)
        if (!userProfile.is_client) {
            return server_1.NextResponse.json({ error: 'Access denied. This endpoint is for client users only.' }, { status: 403 });
        }
        // Validate request body
        const body = await request.json();
        const validation = (0, validation_schemas_1.validateRequestBody)(approveProjectSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Approve project
        const result = await (0, client_portal_service_1.clientApproveProject)({
            projectId: id,
            workflowInstanceId: validation.data.workflow_instance_id,
            clientUserId: user.id,
            notes: validation.data.notes || null,
            supabaseClient: supabase,
        });
        return server_1.NextResponse.json({
            ...result,
            message: 'Project approved successfully'
        }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/client/portal/projects/[id]/approve', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
