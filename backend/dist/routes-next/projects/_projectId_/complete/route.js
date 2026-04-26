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
 * POST /api/projects/[projectId]/complete
 * Manually complete a project that doesn't have an active workflow
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
        // Check permissions FIRST before fetching project (to avoid RLS blocking legitimate access checks)
        const userIsSuperadmin = (0, rbac_1.isSuperadmin)(userProfile);
        const hasManageAllProjects = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_ALL_PROJECTS, undefined, admin);
        // Check if user has project access via assignment (before RLS-protected project query)
        const { data: userAssignment } = await admin
            .from('project_assignments')
            .select('id')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .is('removed_at', null)
            .maybeSingle();
        const hasProjectAssignment = !!userAssignment;
        // Fetch project first to check creator status (RLS allows access for creators)
        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('id, status, account_id, created_by')
            .eq('id', projectId)
            .single();
        if (projectError || !project) {
            return server_1.NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        const isProjectCreator = project.created_by === user.id;
        // If user has no access at all (not superadmin, no MANAGE_ALL_PROJECTS, not assigned, not creator), deny
        if (!userIsSuperadmin && !hasManageAllProjects && !hasProjectAssignment && !isProjectCreator) {
            return server_1.NextResponse.json({ error: 'Access denied to this project' }, { status: 403 });
        }
        // Verify project is not already complete
        if (project.status === 'complete') {
            return server_1.NextResponse.json({ error: 'Project is already completed' }, { status: 400 });
        }
        // Check if project has an active workflow - only allow manual completion for non-workflow projects
        const { data: activeWorkflow } = await admin
            .from('workflow_instances')
            .select('id, status')
            .eq('project_id', projectId)
            .eq('status', 'active')
            .maybeSingle();
        if (activeWorkflow) {
            return server_1.NextResponse.json({
                error: 'Cannot manually complete a project with an active workflow. Use the workflow progression instead.'
            }, { status: 400 });
        }
        // Final permission check - must be superadmin, have MANAGE_ALL_PROJECTS, project creator,
        // or be assigned to the project with manage_projects permission
        const hasManageProjects = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_PROJECTS, undefined, admin);
        const canCompleteAsAssignedPM = hasProjectAssignment && hasManageProjects;
        if (!userIsSuperadmin && !hasManageAllProjects && !isProjectCreator && !canCompleteAsAssignedPM) {
            return server_1.NextResponse.json({
                error: 'Only project creators, assigned project managers, or administrators can complete projects'
            }, { status: 403 });
        }
        // Complete the project:
        // 1. Set status to 'complete'
        // 2. Update timestamp
        const { error: updateError } = await admin
            .from('projects')
            .update({
            status: 'complete',
            updated_at: new Date().toISOString()
        })
            .eq('id', projectId);
        if (updateError) {
            debug_logger_1.logger.error('Error completing project', {}, updateError);
            return server_1.NextResponse.json({ error: 'Failed to complete project' }, { status: 500 });
        }
        // NOTE: Do NOT remove project assignments on completion.
        // Assignments are historical records showing who worked on the project.
        // The project's status='complete' handles removing it from active views.
        return server_1.NextResponse.json({
            success: true,
            message: 'Project completed successfully'
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/projects/[projectId]/complete', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
