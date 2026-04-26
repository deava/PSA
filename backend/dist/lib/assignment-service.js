"use strict";
/**
 * Assignment Service
 *
 * Manages user assignments to projects, accounts, and other resources.
 * This service handles the many-to-many relationships between users and projects
 * and provides context-aware access control checks.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentService = void 0;
const supabase_1 = require("./supabase");
const debug_logger_1 = require("./debug-logger");
// ================================================================================
// ASSIGNMENT SERVICE CLASS
// ================================================================================
class AssignmentService {
    async getSupabase() {
        return (0, supabase_1.createClientSupabase)();
    }
    // ============================================================================
    // PROJECT ASSIGNMENT OPERATIONS
    // ============================================================================
    /**
     * Assign a user to a project
     * Automatically grants view access to the project's account
     */
    async assignUserToProject(data) {
        const startTime = Date.now();
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'assignUserToProject' });
                return null;
            }
            debug_logger_1.logger.info('Assigning user to project', {
                action: 'assignUserToProject',
                userId: data.user_id,
                projectId: data.project_id,
                roleInProject: data.role_in_project
            });
            (0, debug_logger_1.databaseQuery)('INSERT', 'project_assignments', {
                action: 'assignUserToProject',
                userId: data.user_id,
                projectId: data.project_id
            });
            const { data: assignment, error } = await supabase
                .from('project_assignments')
                .insert({
                project_id: data.project_id,
                user_id: data.user_id,
                role_in_project: data.role_in_project || null,
                assigned_by: data.assigned_by,
                assigned_at: new Date().toISOString(),
            })
                .select()
                .single();
            if (error) {
                (0, debug_logger_1.databaseError)('INSERT', 'project_assignments', error, {
                    action: 'assignUserToProject',
                    userId: data.user_id,
                    projectId: data.project_id
                });
                debug_logger_1.logger.error('Error assigning user to project', {
                    action: 'assignUserToProject',
                    userId: data.user_id,
                    projectId: data.project_id,
                    error: error.message
                }, error);
                return null;
            }
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('assignUserToProject', duration, {
                userId: data.user_id,
                projectId: data.project_id
            });
            debug_logger_1.logger.info('User assigned to project successfully', {
                action: 'assignUserToProject',
                assignmentId: assignment.id,
                userId: data.user_id,
                projectId: data.project_id,
                duration
            });
            return assignment;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in assignUserToProject', {
                action: 'assignUserToProject',
                userId: data.user_id,
                projectId: data.project_id,
                duration
            }, error);
            return null;
        }
    }
    /**
     * Remove a user from a project (soft delete - sets removed_at)
     */
    async removeUserFromProject(userId, projectId, _removedBy) {
        const startTime = Date.now();
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'removeUserFromProject' });
                return false;
            }
            debug_logger_1.logger.info('Removing user from project', {
                action: 'removeUserFromProject',
                userId,
                projectId
            });
            const { error } = await supabase
                .from('project_assignments')
                .update({
                removed_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .is('removed_at', null);
            if (error) {
                (0, debug_logger_1.databaseError)('UPDATE', 'project_assignments', error, {
                    action: 'removeUserFromProject',
                    userId,
                    projectId
                });
                debug_logger_1.logger.error('Error removing user from project', {
                    action: 'removeUserFromProject',
                    userId,
                    projectId,
                    error: error.message
                }, error);
                return false;
            }
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('removeUserFromProject', duration, { userId, projectId });
            debug_logger_1.logger.info('User removed from project successfully', {
                action: 'removeUserFromProject',
                userId,
                projectId,
                duration
            });
            return true;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in removeUserFromProject', {
                action: 'removeUserFromProject',
                userId,
                projectId,
                duration
            }, error);
            return false;
        }
    }
    /**
     * Get all projects a user is assigned to
     */
    async getUserProjects(userId) {
        const startTime = Date.now();
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getUserProjects' });
                return [];
            }
            debug_logger_1.logger.debug('Fetching user projects', { action: 'getUserProjects', userId });
            (0, debug_logger_1.databaseQuery)('SELECT', 'project_assignments', { action: 'getUserProjects', userId });
            const { data: assignments, error } = await supabase
                .from('project_assignments')
                .select(`
          *,
          project:projects(id, name, account_id, status),
          user:user_profiles(id, name, email, image),
          assigned_by_user:user_profiles(id, name)
        `)
                .eq('user_id', userId)
                .is('removed_at', null)
                .order('assigned_at', { ascending: false });
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'project_assignments', error, {
                    action: 'getUserProjects',
                    userId
                });
                debug_logger_1.logger.error('Error fetching user projects', {
                    action: 'getUserProjects',
                    userId
                }, error);
                return [];
            }
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('getUserProjects', duration, { userId, count: assignments?.length || 0 });
            debug_logger_1.logger.debug('User projects fetched successfully', {
                action: 'getUserProjects',
                userId,
                projectCount: assignments?.length || 0,
                duration
            });
            return assignments || [];
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in getUserProjects', {
                action: 'getUserProjects',
                userId,
                duration
            }, error);
            return [];
        }
    }
    /**
     * Get all users assigned to a project
     */
    async getProjectUsers(projectId) {
        const startTime = Date.now();
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getProjectUsers' });
                return [];
            }
            debug_logger_1.logger.debug('Fetching project users', { action: 'getProjectUsers', projectId });
            (0, debug_logger_1.databaseQuery)('SELECT', 'project_assignments', { action: 'getProjectUsers', projectId });
            const { data: assignments, error } = await supabase
                .from('project_assignments')
                .select(`
          *,
          project:projects(id, name, account_id, status),
          user:user_profiles(id, name, email, image),
          assigned_by_user:user_profiles(id, name)
        `)
                .eq('project_id', projectId)
                .is('removed_at', null)
                .order('assigned_at', { ascending: false });
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'project_assignments', error, {
                    action: 'getProjectUsers',
                    projectId
                });
                debug_logger_1.logger.error('Error fetching project users', {
                    action: 'getProjectUsers',
                    projectId
                }, error);
                return [];
            }
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('getProjectUsers', duration, { projectId, count: assignments?.length || 0 });
            debug_logger_1.logger.debug('Project users fetched successfully', {
                action: 'getProjectUsers',
                projectId,
                userCount: assignments?.length || 0,
                duration
            });
            return assignments || [];
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in getProjectUsers', {
                action: 'getProjectUsers',
                projectId,
                duration
            }, error);
            return [];
        }
    }
    /**
     * Check if a user is assigned to a specific project
     */
    async isUserAssignedToProject(userId, projectId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase)
                return false;
            const { data, error } = await supabase
                .from('project_assignments')
                .select('id')
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .is('removed_at', null)
                .single();
            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                debug_logger_1.logger.error('Error checking project assignment', { userId, projectId }, error);
                return false;
            }
            return !!data;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in isUserAssignedToProject', { userId, projectId }, error);
            return false;
        }
    }
    /**
     * Update user's role in a project
     */
    async updateProjectRole(userId, projectId, newRole) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase)
                return false;
            const { error } = await supabase
                .from('project_assignments')
                .update({
                role_in_project: newRole,
                updated_at: new Date().toISOString(),
            })
                .eq('user_id', userId)
                .eq('project_id', projectId)
                .is('removed_at', null);
            if (error) {
                debug_logger_1.logger.error('Error updating project role', { userId, projectId, newRole }, error);
                return false;
            }
            debug_logger_1.logger.info('Project role updated successfully', { userId, projectId, newRole });
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in updateProjectRole', { userId, projectId, newRole }, error);
            return false;
        }
    }
    // ============================================================================
    // ACCOUNT ACCESS OPERATIONS
    // ============================================================================
    /**
     * Get all accounts a user has access to (via project assignments)
     */
    async getUserAccessibleAccounts(userId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase)
                return [];
            const { data: assignments, error } = await supabase
                .from('project_assignments')
                .select('projects!inner(account_id)')
                .eq('user_id', userId)
                .is('removed_at', null);
            if (error) {
                debug_logger_1.logger.error('Error fetching user accessible accounts', { userId }, error);
                return [];
            }
            // Extract unique account IDs
            const accountIds = new Set();
            assignments?.forEach((assignment) => {
                if (assignment.projects?.account_id) {
                    accountIds.add(assignment.projects.account_id);
                }
            });
            return Array.from(accountIds);
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in getUserAccessibleAccounts', { userId }, error);
            return [];
        }
    }
    /**
     * Check if user has access to an account (assigned to any project in that account)
     */
    async hasAccountAccess(userId, accountId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase)
                return false;
            // Get all projects in this account
            const { data: projects, error: projectsError } = await supabase
                .from('projects')
                .select('id')
                .eq('account_id', accountId);
            if (projectsError || !projects || projects.length === 0) {
                return false;
            }
            const projectIds = projects.map((p) => p.id);
            // Check if user is assigned to any of these projects
            const { data, error } = await supabase
                .from('project_assignments')
                .select('id')
                .eq('user_id', userId)
                .in('project_id', projectIds)
                .is('removed_at', null)
                .limit(1);
            if (error) {
                debug_logger_1.logger.error('Error checking account access', { userId, accountId }, error);
                return false;
            }
            return (data?.length || 0) > 0;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in hasAccountAccess', { userId, accountId }, error);
            return false;
        }
    }
    // ============================================================================
    // BULK OPERATIONS
    // ============================================================================
    /**
     * Assign multiple users to a project at once
     */
    async bulkAssignUsersToProject(projectId, userIds, assignedBy, roleInProject) {
        const success = [];
        const failed = [];
        for (const userId of userIds) {
            const result = await this.assignUserToProject({
                project_id: projectId,
                user_id: userId,
                role_in_project: roleInProject,
                assigned_by: assignedBy,
            });
            if (result) {
                success.push(userId);
            }
            else {
                failed.push(userId);
            }
        }
        debug_logger_1.logger.info('Bulk assignment completed', {
            action: 'bulkAssignUsersToProject',
            projectId,
            totalUsers: userIds.length,
            successCount: success.length,
            failedCount: failed.length
        });
        return { success, failed };
    }
    /**
     * Get summary of all users and their project assignments
     */
    async getAllUserProjectSummaries() {
        try {
            const supabase = await this.getSupabase();
            if (!supabase)
                return [];
            const { data: assignments, error } = await supabase
                .from('project_assignments')
                .select(`
          user_id,
          user:user_profiles(id, name, email),
          project:projects(id, name, account_id, accounts(name)),
          role_in_project,
          assigned_at
        `)
                .is('removed_at', null)
                .order('user_id', { ascending: true })
                .order('assigned_at', { ascending: false });
            if (error) {
                debug_logger_1.logger.error('Error fetching all user project summaries', {}, error);
                return [];
            }
            // Group by user
            const userMap = new Map();
            assignments?.forEach((assignment) => {
                const userId = assignment.user_id;
                const user = assignment.user;
                const project = assignment.project;
                if (!userMap.has(userId)) {
                    userMap.set(userId, {
                        user_id: userId,
                        user_name: user.name,
                        user_email: user.email,
                        projects: [],
                        accounts_accessible: new Set(),
                    });
                }
                const summary = userMap.get(userId);
                summary.projects.push({
                    project_id: project.id,
                    project_name: project.name,
                    account_id: project.account_id,
                    account_name: project.accounts?.name || 'Unknown',
                    role_in_project: assignment.role_in_project,
                    assigned_at: assignment.assigned_at,
                });
                summary.accounts_accessible.add(project.account_id);
            });
            return Array.from(userMap.values());
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in getAllUserProjectSummaries', {}, error);
            return [];
        }
    }
}
// Export singleton instance
exports.assignmentService = new AssignmentService();
