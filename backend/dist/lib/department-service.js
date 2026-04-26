"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.serverDepartmentService = void 0;
const supabase_server_1 = require("./supabase-server");
const constants_1 = require("./constants");
const debug_logger_1 = require("./debug-logger");
// Remove the client-side DepartmentService class since we now have a separate client service
// Server-side methods
class ServerDepartmentService {
    async getSupabase() {
        return (0, supabase_server_1.createAdminSupabaseClient)();
    }
    /**
     * Get all departments (server-side)
     */
    async getAllDepartments() {
        try {
            const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
            if (!supabase)
                return [];
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .order('name');
            if (error) {
                debug_logger_1.logger.error('Error fetching departments', {}, error);
                return [];
            }
            return data || [];
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getAllDepartments', {}, error);
            return [];
        }
    }
    /**
     * Get department by ID (server-side)
     */
    async getDepartmentById(id) {
        try {
            const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
            if (!supabase)
                return null;
            const { data, error } = await supabase
                .from('departments')
                .select('*')
                .eq('id', id)
                .single();
            if (error) {
                debug_logger_1.logger.error('Error fetching department', {}, error);
                return null;
            }
            return data;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getDepartmentById', {}, error);
            return null;
        }
    }
    /**
     * Get department projects with health status (server-side)
     */
    async getDepartmentProjects(departmentId) {
        try {
            const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
            if (!supabase)
                return [];
            // Get all roles for this department
            const { data: departmentRoles, error: rolesError } = await supabase
                .from('roles')
                .select('id')
                .eq('department_id', departmentId);
            if (rolesError) {
                debug_logger_1.logger.error('Error fetching department roles', {}, rolesError);
                return [];
            }
            const roleIds = departmentRoles?.map((role) => role.id) || [];
            if (roleIds.length === 0) {
                debug_logger_1.logger.debug('No roles found for department', { departmentId });
                return [];
            }
            // Get user IDs who have roles in this department
            const { data: usersInDept, error: userRolesError } = await supabase
                .from('user_roles')
                .select('user_id')
                .in('role_id', roleIds);
            if (userRolesError) {
                debug_logger_1.logger.error('Error fetching users for department', {}, userRolesError);
                return [];
            }
            const userIds = Array.from(new Set(usersInDept?.map((ur) => ur.user_id) || []));
            if (userIds.length === 0) {
                debug_logger_1.logger.debug('No users found for department', { departmentId });
                return [];
            }
            // Get project IDs where users from this department are assigned
            const { data: projectAssignments, error: projAssignError } = await supabase
                .from('project_assignments')
                .select('project_id')
                .in('user_id', userIds)
                .is('removed_at', null);
            if (projAssignError) {
                debug_logger_1.logger.error('Error fetching project assignments', {}, projAssignError);
                return [];
            }
            if (!projectAssignments || projectAssignments.length === 0) {
                debug_logger_1.logger.debug('No project assignments found for department', { departmentId });
                return [];
            }
            const projectIds = Array.from(new Set(projectAssignments.map((assignment) => assignment.project_id)));
            // Now fetch the actual projects
            const { data: projects, error } = await supabase
                .from('projects')
                .select(`
          *,
          accounts (
            id,
            name
          )
        `)
                .in('id', projectIds)
                .order('created_at', { ascending: false });
            if (error) {
                debug_logger_1.logger.error('Error fetching department projects', {}, error);
                return [];
            }
            // Fetch task assignees via the tasks table (tasks.assigned_to references user_profiles)
            const { data: taskAssignees, error: assignmentsError } = await supabase
                .from('tasks')
                .select(`
          id,
          project_id,
          assigned_to,
          user_profiles:assigned_to (
            id,
            name,
            image
          )
        `)
                .in('project_id', projectIds)
                .not('assigned_to', 'is', null);
            if (assignmentsError) {
                debug_logger_1.logger.error('Error fetching task assignees', {}, assignmentsError);
            }
            const typedProjects = projects || [];
            const typedAssignments = taskAssignees || [];
            const now = new Date();
            return typedProjects.map((project) => {
                let healthStatus = 'healthy';
                let daysUntilDeadline = null;
                if (project.end_date) {
                    const endDate = new Date(project.end_date);
                    daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilDeadline < 0) {
                        healthStatus = 'critical';
                    }
                    else if (daysUntilDeadline <= 7) {
                        healthStatus = 'at_risk';
                    }
                }
                const projectAssignments = typedAssignments.filter((a) => a.tasks?.project_id === project.id);
                const assignedUsers = projectAssignments.map((a) => ({
                    id: a.user_profiles?.id || '',
                    name: a.user_profiles?.name || 'Unknown',
                    image: a.user_profiles?.image || null
                }));
                return {
                    id: project.id,
                    name: project.name,
                    description: project.description,
                    status: project.status,
                    priority: project.priority,
                    startDate: project.start_date,
                    endDate: project.end_date,
                    estimatedHours: project.estimated_hours,
                    actualHours: project.actual_hours,
                    accountName: project.accounts?.name || 'Unknown Account',
                    assignedUsers,
                    healthStatus,
                    daysUntilDeadline
                };
            });
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getDepartmentProjects', {}, error);
            return [];
        }
    }
    /**
     * Get department metrics for a single department
     */
    async getDepartmentMetrics(departmentId) {
        const supabase = await this.getSupabase();
        if (!supabase)
            return null;
        const { data: department, error: departmentError } = await supabase
            .from('departments')
            .select('*')
            .eq('id', departmentId)
            .single();
        if (departmentError) {
            debug_logger_1.logger.error('Error fetching department for metrics', {}, departmentError);
            return null;
        }
        // Get all roles for this department first (we need role IDs to find assignments)
        const { data: departmentRoles, error: rolesQueryError } = await supabase
            .from('roles')
            .select('id')
            .eq('department_id', departmentId);
        if (rolesQueryError) {
            debug_logger_1.logger.error('Error fetching department roles for projects', {}, rolesQueryError);
            return null;
        }
        const roleIds = departmentRoles?.map((role) => role.id) || [];
        // If department has no roles, it has no projects
        if (roleIds.length === 0) {
            const _activeProjects = [];
            const _teamSize = 0;
            return {
                id: department.id,
                name: department.name,
                description: department.description,
                activeProjects: 0,
                teamSize: 0,
                capacityUtilization: 0,
                projectHealth: { healthy: 0, atRisk: 0, critical: 0 },
                workloadDistribution: [],
                recentProjects: []
            };
        }
        // Get user IDs who have roles in this department
        const { data: usersInDept, error: userRolesQueryError } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role_id', roleIds);
        if (userRolesQueryError) {
            debug_logger_1.logger.error('Error fetching users for department', {}, userRolesQueryError);
            return null;
        }
        const userIds = Array.from(new Set(usersInDept?.map((ur) => ur.user_id) || []));
        // Get projects where users from this department are assigned
        // Filter by department's user IDs directly instead of fetching all assignments
        const { data: projectAssignments, error: assignmentsError } = await supabase
            .from('project_assignments')
            .select('project_id, user_id')
            .in('user_id', userIds.length > 0 ? userIds : ['00000000-0000-0000-0000-000000000000'])
            .is('removed_at', null);
        if (assignmentsError) {
            debug_logger_1.logger.error('Error fetching project assignments for department metrics', {
                message: assignmentsError.message,
                code: assignmentsError.code,
                details: assignmentsError.details,
                hint: assignmentsError.hint,
                departmentId: departmentId
            });
            // Continue with empty data rather than failing completely
            return {
                id: department.id,
                name: department.name,
                description: department.description,
                activeProjects: 0,
                teamSize: 0,
                capacityUtilization: 0,
                projectHealth: { healthy: 0, atRisk: 0, critical: 0 },
                workloadDistribution: [],
                recentProjects: []
            };
        }
        // Extract unique project IDs
        const projectIds = Array.from(new Set(projectAssignments?.map((a) => a.project_id) || []));
        let projects = [];
        if (projectIds.length > 0) {
            // Fetch projects separately
            const { data: projectsData, error: projectsError } = await supabase
                .from('projects')
                .select(`
          id,
          name,
          description,
          status,
          priority,
          start_date,
          end_date,
          estimated_hours,
          actual_hours,
          accounts (name)
        `)
                .in('id', projectIds);
            if (projectsError) {
                debug_logger_1.logger.error('Error fetching projects for department metrics', {
                    message: projectsError.message,
                    code: projectsError.code,
                    details: projectsError.details,
                    hint: projectsError.hint,
                    projectIds: projectIds.length,
                    departmentId: departmentId
                });
                return null;
            }
            projects = projectsData || [];
        }
        // Get user roles for those specific roles (roleIds already fetched above)
        // Split into separate queries to avoid nested PostgREST issues
        const { data: userRolesData, error: userRolesError } = await supabase
            .from('user_roles')
            .select('user_id, role_id')
            .in('role_id', roleIds);
        if (userRolesError) {
            debug_logger_1.logger.error('Error fetching user roles for department metrics', {}, userRolesError);
        }
        // Get user profiles separately
        const userProfileIds = Array.from(new Set(userRolesData?.map((ur) => ur.user_id) || []));
        let teamMembers = [];
        if (userProfileIds.length > 0) {
            const { data: profilesData, error: profilesError } = await supabase
                .from('user_profiles')
                .select('id, name, image, workload_sentiment')
                .in('id', userProfileIds);
            if (profilesError) {
                debug_logger_1.logger.error('Error fetching user profiles for department metrics', {}, profilesError);
            }
            else {
                // Map user_roles to user_profiles
                teamMembers = (profilesData || []).map((profile) => ({
                    user_profiles: profile
                }));
            }
        }
        const activeProjects = projects?.filter((p) => p.status !== 'complete' && p.status !== 'on_hold') || [];
        // Deduplicate users by ID in case they have multiple roles in the same department
        const uniqueUsers = new Map();
        (teamMembers || []).forEach((member) => {
            const user = member.user_profiles;
            if (user && !uniqueUsers.has(user.id)) {
                uniqueUsers.set(user.id, user);
            }
        });
        const teamSize = uniqueUsers.size;
        const projectHealth = {
            healthy: 0,
            atRisk: 0,
            critical: 0
        };
        const now = new Date();
        activeProjects.forEach((project) => {
            if (!project.end_date) {
                projectHealth.healthy++;
                return;
            }
            const endDate = new Date(project.end_date);
            const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (daysUntilDeadline < 0) {
                projectHealth.critical++;
            }
            else if (daysUntilDeadline <= 7) {
                projectHealth.atRisk++;
            }
            else {
                projectHealth.healthy++;
            }
        });
        // Calculate workload distribution based on actual time entries and availability
        // Get current week start (Monday)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
        const weekStart = new Date(today.getFullYear(), today.getMonth(), diff);
        const weekStartStr = weekStart.toISOString().split('T')[0];
        // Get user IDs for querying (from team members)
        const teamUserIds = Array.from(uniqueUsers.keys());
        // Fetch actual hours logged this week for all users
        const timeEntriesMap = new Map();
        if (teamUserIds.length > 0) {
            const { data: timeEntries, error: timeError } = await supabase
                .from('time_entries')
                .select('user_id, hours_logged')
                .in('user_id', teamUserIds)
                .gte('entry_date', weekStartStr);
            if (!timeError && timeEntries) {
                timeEntries.forEach((entry) => {
                    const current = timeEntriesMap.get(entry.user_id) || 0;
                    timeEntriesMap.set(entry.user_id, current + (entry.hours_logged || 0));
                });
            }
        }
        // Fetch availability for all users this week
        const availabilityMap = new Map();
        if (teamUserIds.length > 0) {
            const { data: availability, error: availError } = await supabase
                .from('user_availability')
                .select('user_id, available_hours')
                .in('user_id', teamUserIds)
                .eq('week_start_date', weekStartStr);
            if (!availError && availability) {
                availability.forEach((avail) => {
                    availabilityMap.set(avail.user_id, avail.available_hours || 0);
                });
            }
        }
        // Calculate workload distribution with real data
        const workloadDistribution = Array.from(uniqueUsers.values()).map((user) => {
            const actualHours = timeEntriesMap.get(user.id) || 0;
            const availableHours = availabilityMap.get(user.id) || constants_1.DEFAULT_WEEKLY_HOURS; // Default 40 hours/week if not set
            // Calculate utilization percentage
            const workloadPercentage = availableHours > 0
                ? Math.min(Math.round((actualHours / availableHours) * 100), 100)
                : 0;
            // Determine workload sentiment based on percentage
            let workloadSentiment = null;
            if (workloadPercentage <= 40) {
                workloadSentiment = 'comfortable';
            }
            else if (workloadPercentage <= 70) {
                workloadSentiment = 'stretched';
            }
            else {
                workloadSentiment = 'overwhelmed';
            }
            return {
                userId: user.id,
                userName: user.name,
                userImage: user.image,
                workloadPercentage,
                workloadSentiment,
                actualHours,
                availableHours,
            };
        });
        // Calculate overall capacity utilization
        const totalAvailableHours = workloadDistribution.reduce((sum, member) => sum + (member?.availableHours || 0), 0);
        const totalActualHours = workloadDistribution.reduce((sum, member) => sum + (member?.actualHours || 0), 0);
        const capacityUtilization = totalAvailableHours > 0
            ? (totalActualHours / totalAvailableHours) * 100
            : 0;
        return {
            id: department.id,
            name: department.name,
            description: department.description,
            activeProjects: activeProjects.length,
            teamSize,
            capacityUtilization: parseFloat(capacityUtilization.toFixed(2)),
            projectHealth,
            workloadDistribution,
            recentProjects: activeProjects.slice(0, 5)
        };
    }
}
// Export singleton instance (server-side only)
exports.serverDepartmentService = new ServerDepartmentService();
