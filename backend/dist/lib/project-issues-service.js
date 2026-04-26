"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.projectIssuesService = void 0;
const supabase_1 = require("@/lib/supabase");
const debug_logger_1 = require("@/lib/debug-logger");
exports.projectIssuesService = {
    /**
     * Get all issues for a project
     */
    async getProjectIssues(projectId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data, error } = await supabase
            .from('project_issues')
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching project issues', {}, error);
            throw error;
        }
        return data || [];
    },
    /**
     * Get all active (open or in_progress) issues for a department
     */
    async getDepartmentActiveIssues(departmentId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        // Get all roles for this department
        const { data: departmentRoles, error: rolesError } = await supabase
            .from('roles')
            .select('id')
            .eq('department_id', departmentId);
        if (rolesError) {
            debug_logger_1.logger.error('Error fetching department roles', {}, rolesError);
            throw rolesError;
        }
        const roleIds = departmentRoles?.map((role) => role.id) || [];
        if (roleIds.length === 0) {
            return [];
        }
        // Get user IDs who have roles in this department
        const { data: usersInDept, error: userRolesError } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role_id', roleIds);
        if (userRolesError) {
            debug_logger_1.logger.error('Error fetching users for department', {}, userRolesError);
            throw userRolesError;
        }
        const userIds = Array.from(new Set(usersInDept?.map((ur) => ur.user_id) || []));
        if (userIds.length === 0) {
            return [];
        }
        // Get project IDs where users from this department are assigned
        const { data: projectAssignments, error: assignmentsError } = await supabase
            .from('project_assignments')
            .select(`
        project_id,
        projects (
          id,
          name
        )
      `)
            .in('user_id', userIds)
            .is('removed_at', null);
        if (assignmentsError) {
            debug_logger_1.logger.error('Error fetching project assignments', {}, assignmentsError);
            throw assignmentsError;
        }
        if (!projectAssignments || projectAssignments.length === 0) {
            return [];
        }
        // Extract unique projects
        const projectsMap = new Map();
        projectAssignments.forEach((assignment) => {
            if (assignment.projects && !projectsMap.has(assignment.projects.id)) {
                projectsMap.set(assignment.projects.id, assignment.projects);
            }
        });
        const projects = Array.from(projectsMap.values());
        const projectIds = projects.map((p) => p.id);
        if (projectIds.length === 0) {
            return [];
        }
        // Get all active issues for these projects
        const { data: issues, error: issuesError } = await supabase
            .from('project_issues')
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .in('project_id', projectIds)
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false });
        if (issuesError) {
            debug_logger_1.logger.error('Error fetching department issues', {}, issuesError);
            throw issuesError;
        }
        // Add project information to each issue
        const issuesWithProjects = (issues || []).map((issue) => {
            const project = projects.find((p) => p.id === issue.project_id);
            return {
                ...issue,
                project: project ? { id: project.id, name: project.name } : undefined
            };
        });
        return issuesWithProjects;
    },
    /**
     * Get all active (open or in_progress) issues for an account
     */
    async getAccountActiveIssues(accountId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        // First, get all project IDs for this account
        const { data: projects, error: projectsError } = await supabase
            .from('projects')
            .select('id, name')
            .eq('account_id', accountId);
        if (projectsError) {
            debug_logger_1.logger.error('Error fetching projects', {}, projectsError);
            throw projectsError;
        }
        if (!projects || projects.length === 0) {
            return [];
        }
        const projectIds = projects.map((p) => p.id);
        // Get all active issues for these projects
        const { data, error } = await supabase
            .from('project_issues')
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .in('project_id', projectIds)
            .in('status', ['open', 'in_progress'])
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching account issues', {}, error);
            throw error;
        }
        // Add project info to each issue
        const issuesWithProjects = (data || []).map((issue) => ({
            ...issue,
            project: projects.find((p) => p.id === issue.project_id)
        }));
        return issuesWithProjects;
    },
    /**
     * Create a new project issue
     */
    async createProjectIssue(input) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to create an issue');
        }
        const { data, error } = await supabase
            .from('project_issues')
            .insert({
            project_id: input.project_id,
            content: input.content,
            created_by: session.user.id,
            status: 'open',
        })
            .select(`
        *,
        user_profiles:created_by(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error creating project issue', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Update issue status
     */
    async updateIssueStatus(issueId, status) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            throw new Error('You must be logged in to update an issue');
        }
        const updateData = {
            status,
            updated_at: new Date().toISOString(),
        };
        // If marking as resolved, set resolved metadata
        if (status === 'resolved') {
            updateData.resolved_at = new Date().toISOString();
            updateData.resolved_by = session.user.id;
        }
        else {
            // If changing from resolved to another status, clear resolved metadata
            updateData.resolved_at = null;
            updateData.resolved_by = null;
        }
        const { data, error } = await supabase
            .from('project_issues')
            .update(updateData)
            .eq('id', issueId)
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating issue status', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Update issue content
     */
    async updateIssueContent(issueId, content) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { data, error } = await supabase
            .from('project_issues')
            .update({
            content,
            updated_at: new Date().toISOString(),
        })
            .eq('id', issueId)
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating issue content', {}, error);
            throw error;
        }
        return data;
    },
    /**
     * Delete a project issue
     */
    async deleteProjectIssue(issueId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        const { error } = await supabase
            .from('project_issues')
            .delete()
            .eq('id', issueId);
        if (error) {
            debug_logger_1.logger.error('Error deleting project issue', {}, error);
            throw error;
        }
    },
};
