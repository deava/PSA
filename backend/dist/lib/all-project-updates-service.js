"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allProjectUpdatesService = void 0;
const supabase_1 = require("@/lib/supabase");
const debug_logger_1 = require("@/lib/debug-logger");
exports.allProjectUpdatesService = {
    /**
     * Get all project updates across all projects (for welcome page)
     * Only shows updates from projects the user has access to
     */
    async getAllProjectUpdates() {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase) {
            throw new Error('Unable to connect to database');
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to view project updates');
        }
        // Get all project updates with project and account information
        const { data, error } = await supabase
            .from('project_updates')
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        projects:projects(
          id,
          name,
          status,
          priority,
          accounts:accounts(id, name)
        )
      `)
            .order('created_at', { ascending: false })
            .limit(50); // Limit to most recent 50 updates
        if (error) {
            debug_logger_1.logger.error('Error fetching all project updates', {}, error);
            throw error;
        }
        return data || [];
    },
    /**
     * Get project updates for a specific user's projects only
     */
    async getUserProjectUpdates() {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase) {
            throw new Error('Unable to connect to database');
        }
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to view project updates');
        }
        // First get projects the user has access to
        const { data: userProjects, error: projectsError } = await supabase
            .from('projects')
            .select('id')
            .or(`created_by.eq.${session.user.id},assigned_user_id.eq.${session.user.id}`);
        if (projectsError) {
            debug_logger_1.logger.error('Error fetching user projects', {}, projectsError);
            throw projectsError;
        }
        if (!userProjects || userProjects.length === 0) {
            return [];
        }
        const projectIds = userProjects.map((p) => p.id);
        // Get updates for user's projects
        const { data, error } = await supabase
            .from('project_updates')
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image),
        projects:projects(
          id,
          name,
          status,
          priority,
          accounts:accounts(id, name)
        )
      `)
            .in('project_id', projectIds)
            .order('created_at', { ascending: false })
            .limit(30); // Limit to most recent 30 updates
        if (error) {
            debug_logger_1.logger.error('Error fetching user project updates', {}, error);
            throw error;
        }
        return data || [];
    }
};
