"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const workflow_execution_service_1 = require("@/lib/workflow-execution-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/workflows/my-projects
 * Returns active projects for the user
 * Superadmins see ALL active projects across all users
 */
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get current user with profile
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check EXECUTE_WORKFLOWS permission
        const canExecute = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.EXECUTE_WORKFLOWS, undefined, admin);
        if (!canExecute) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
        }
        const isSuperadmin = userProfile.is_superadmin === true;
        const user = { id: userProfile.id };
        let projects = [];
        if (isSuperadmin) {
            // Superadmins see ALL active projects with their assigned users
            const { data: allAssignments } = await supabase
                .from('project_assignments')
                .select(`
          *,
          projects!inner(
            id,
            name,
            description,
            status,
            priority,
            created_at,
            account_id,
            estimated_hours,
            actual_hours,
            end_date,
            start_date,
            accounts(id, name)
          ),
          user_profiles(
            id,
            name,
            email
          )
        `)
                .is('removed_at', null);
            // Filter out completed projects and add assigned_user info
            projects = (allAssignments || [])
                .filter((p) => {
                const projects = p.projects;
                const project = Array.isArray(projects) ? projects[0] : projects;
                return project && project.status !== 'complete';
            })
                .map((p) => {
                const userProfiles = p.user_profiles;
                return {
                    ...p,
                    assigned_user: userProfiles ? {
                        id: userProfiles.id,
                        name: userProfiles.name,
                        email: userProfiles.email
                    } : undefined
                };
            });
        }
        else {
            // Regular users see only their assigned active projects
            projects = await (0, workflow_execution_service_1.getUserActiveProjects)(supabase, user.id);
        }
        return server_1.NextResponse.json({
            success: true,
            projects,
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/workflows/my-projects', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
