"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * POST /api/projects/[projectId]/reopen
 * Reopen a completed project - removes workflow and sets status back to in_progress
 */
async function POST(request, { params }) {
    try {
        const { projectId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: { user } } = await admin.auth.getUser();
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
        // Check if project exists and is completed
        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('id, status, account_id, created_by')
            .eq('id', projectId)
            .single();
        if (projectError || !project) {
            return server_1.NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        if (project.status !== 'complete') {
            return server_1.NextResponse.json({ error: 'Project is not completed' }, { status: 400 });
        }
        // Check permissions - must be superadmin, have EDIT_ALL_PROJECTS, or be the project creator
        const userIsSuperadmin = (0, rbac_1.isSuperadmin)(userProfile);
        const hasEditAllProjects = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_ALL_PROJECTS, undefined, admin);
        const isProjectCreator = project.created_by === user.id;
        if (!userIsSuperadmin && !hasEditAllProjects && !isProjectCreator) {
            return server_1.NextResponse.json({
                error: 'Only project creators or administrators can reopen completed projects'
            }, { status: 403 });
        }
        // Reopen the project: set status back to in_progress
        const { error: updateError } = await admin
            .from('projects')
            .update({
            status: 'in_progress',
            updated_at: new Date().toISOString()
        })
            .eq('id', projectId);
        if (updateError) {
            debug_logger_1.logger.error('Error reopening project', {}, updateError);
            return server_1.NextResponse.json({ error: 'Failed to reopen project' }, { status: 500 });
        }
        // Reactivate ALL previously assigned team members (from before our fix)
        const { error: reactivateError } = await admin
            .from('project_assignments')
            .update({ removed_at: null })
            .eq('project_id', projectId)
            .not('removed_at', 'is', null);
        if (reactivateError) {
            debug_logger_1.logger.error('Error reactivating team assignments', {}, reactivateError);
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Project reopened successfully. The project now operates without a workflow.'
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/projects/[projectId]/reopen', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
