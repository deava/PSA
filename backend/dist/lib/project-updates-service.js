"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectUpdatesService = void 0;
const supabase_1 = require("@/lib/supabase");
const debug_logger_1 = require("@/lib/debug-logger");
exports.projectUpdatesService = {
    /**
     * Get all updates for a project
     */
    async getProjectUpdates(projectId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data, error } = await supabase
            .from('project_updates')
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching project updates', {}, error);
            throw error;
        }
        return data || [];
    },
    /**
     * Create a new project update
     */
    async createProjectUpdate(input) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to create an update');
        }
        const { data, error } = await supabase
            .from('project_updates')
            .insert({
            project_id: input.project_id,
            content: input.content,
            created_by: session.user.id,
        })
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error creating project update', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Update an existing project update
     */
    async updateProjectUpdate(updateId, content) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data, error } = await supabase
            .from('project_updates')
            .update({
            content,
            updated_at: new Date().toISOString(),
        })
            .eq('id', updateId)
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating project update', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Delete a project update
     */
    async deleteProjectUpdate(updateId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { error } = await supabase
            .from('project_updates')
            .delete()
            .eq('id', updateId);
        if (error) {
            debug_logger_1.logger.error('Error deleting project update', {}, error);
            throw error;
        }
    },
};
