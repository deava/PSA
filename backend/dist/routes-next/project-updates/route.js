"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        // Check authentication - return empty array if not authenticated instead of throwing
        let userProfile;
        try {
            userProfile = await (0, server_guards_1.requireAuthentication)(request);
        }
        catch (_error) {
            debug_logger_1.logger.debug('User not authenticated, returning empty project updates', { action: 'getProjectUpdates' });
            return server_1.NextResponse.json([]);
        }
        if (!userProfile) {
            debug_logger_1.logger.debug('User profile is null, returning empty project updates', { action: 'getProjectUpdates' });
            return server_1.NextResponse.json([]);
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'getProjectUpdates' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        const userId = userProfile.id;
        // Phase 10: Use project access pattern instead of deprecated VIEW_UPDATES/VIEW_ALL_UPDATES
        // Superadmins and users with VIEW_ALL_PROJECTS see all updates; others see updates for accessible projects
        const isSuperadmin = userProfile.is_superadmin;
        const hasViewAll = !isSuperadmin && await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_PROJECTS, undefined, admin);
        // Build query
        let query = supabase
            .from('project_updates')
            .select(`
        id,
        project_id,
        content,
        created_by,
        workflow_history_id,
        created_at,
        updated_at,
        user_profiles:created_by(id, name, email, image),
        projects:project_id(
          id,
          name,
          status,
          priority,
          accounts:account_id(id, name)
        )
      `);
        // Superadmins and VIEW_ALL_PROJECTS users see all updates
        if (isSuperadmin || hasViewAll) {
            debug_logger_1.logger.debug('User has global project access, returning all updates', { userId });
        }
        else {
            // Filter to projects user has access to (same logic as userHasProjectAccess)
            debug_logger_1.logger.debug('Filtering project updates to accessible projects', { userId });
            const [{ data: assignedProjects }, { data: directProjects }, { data: accountProjects }] = await Promise.all([
                supabase
                    .from('project_assignments')
                    .select('project_id')
                    .eq('user_id', userId)
                    .is('removed_at', null),
                supabase
                    .from('projects')
                    .select('id')
                    .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`),
                supabase
                    .from('account_members')
                    .select('account:accounts!inner(projects(id))')
                    .eq('user_id', userId)
            ]);
            const projectIds = new Set();
            assignedProjects?.forEach((ap) => projectIds.add(ap.project_id));
            directProjects?.forEach((p) => projectIds.add(p.id));
            accountProjects?.forEach((am) => {
                am.account?.projects?.forEach((p) => projectIds.add(p.id));
            });
            if (projectIds.size > 0) {
                query = query.in('project_id', Array.from(projectIds));
            }
            else {
                query = query.eq('project_id', '00000000-0000-0000-0000-000000000000');
            }
        }
        // Execute query
        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(50);
        if (error) {
            debug_logger_1.logger.error('Error fetching project updates', {
                action: 'getProjectUpdates',
                userId,
                errorMessage: error.message,
                errorCode: error.code,
                errorDetails: error.details
            }, error);
            return server_1.NextResponse.json({
                error: 'Failed to fetch project updates'
            }, { status: 500 });
        }
        return server_1.NextResponse.json(data || []);
    }
    catch (error) {
        debug_logger_1.logger.error('Unexpected error in project-updates API', {
            action: 'getProjectUpdates',
            errorMessage: error instanceof Error ? error.message : String(error)
        }, error instanceof Error ? error : new Error(String(error)));
        return (0, server_guards_1.handleGuardError)(error);
    }
}
