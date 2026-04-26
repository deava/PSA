"use strict";
/**
 * Capacity Service
 * Calculates and provides capacity metrics across users, departments, and organization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.capacityService = void 0;
const supabase_1 = require("../supabase");
const availability_service_1 = require("./availability-service");
const constants_1 = require("../constants");
const debug_logger_1 = require("../debug-logger");
class CapacityService {
    /**
     * Get capacity metrics for a single user for a specific week
     */
    async getUserCapacityMetrics(userId, weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        // OPTIMIZATION: Calculate week end date once
        const weekEnd = new Date(weekStartDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        // OPTIMIZATION: Parallelize all independent queries (Phase 1)
        const [{ data: userProfile, error: userError }, { data: availability }, { data: allocations, error: allocError }, { data: projectAssignments }, { data: assignedTasks }, { data: timeEntries }] = await Promise.all([
            supabase
                .from('user_profiles')
                .select('id, name, email')
                .eq('id', userId)
                .single(),
            supabase
                .from('user_availability')
                .select('available_hours')
                .eq('user_id', userId)
                .eq('week_start_date', weekStartDate)
                .single(),
            supabase
                .from('task_week_allocations')
                .select('allocated_hours')
                .eq('assigned_user_id', userId)
                .eq('week_start_date', weekStartDate),
            supabase
                .from('project_assignments')
                .select('project_id')
                .eq('user_id', userId)
                .is('removed_at', null),
            supabase
                .from('tasks')
                .select('remaining_hours, estimated_hours, status')
                .eq('assigned_to', userId),
            supabase
                .from('time_entries')
                .select('hours_logged')
                .eq('user_id', userId)
                .gte('entry_date', weekStartDate)
                .lte('entry_date', weekEndStr)
        ]);
        if (userError || !userProfile) {
            debug_logger_1.logger.error('Error fetching user profile', {}, userError);
            return null;
        }
        // Default to 40 hours/week if no availability is set
        // Note: Proportional capacity split (dividing by account count) is handled
        // at the account level in /api/capacity/account/route.ts. User-level metrics
        // correctly show full available hours.
        const availableHours = availability?.available_hours ?? constants_1.DEFAULT_WEEKLY_HOURS;
        const weekAllocatedHours = allocError || !allocations
            ? 0
            : allocations.reduce((sum, a) => sum + (a.allocated_hours || 0), 0);
        let projectAllocatedHours = 0;
        // OPTIMIZATION: If project assignments exist, fetch projects and tasks in parallel (Phase 2)
        if (projectAssignments && projectAssignments.length > 0) {
            const projectIds = projectAssignments.map((pa) => pa.project_id);
            const [{ data: projects }, { data: projectTasks }] = await Promise.all([
                supabase
                    .from('projects')
                    .select('id, estimated_hours, status')
                    .in('id', projectIds)
                    .not('status', 'eq', 'complete'),
                supabase
                    .from('tasks')
                    .select('project_id, remaining_hours, estimated_hours, status, assigned_to')
                    .in('project_id', projectIds)
            ]);
            // Calculate hours per project — only count tasks assigned to THIS user
            if (projects) {
                for (const project of projects) {
                    // Get tasks assigned to this user in this project
                    const tasksForProject = projectTasks?.filter((t) => t.project_id === project.id &&
                        t.assigned_to === userId &&
                        t.status !== 'done' &&
                        t.status !== 'complete') || [];
                    // Sum remaining hours from user's tasks in this project
                    if (tasksForProject.length > 0) {
                        const taskHours = tasksForProject.reduce((sum, t) => {
                            const hours = t.remaining_hours ?? t.estimated_hours ?? 0;
                            return sum + hours;
                        }, 0);
                        projectAllocatedHours += taskHours;
                    }
                }
            }
        }
        const taskAllocatedHours = assignedTasks
            ? assignedTasks
                .filter((t) => t.status !== 'done' && t.status !== 'complete')
                .reduce((sum, t) => {
                const hours = t.remaining_hours ?? t.estimated_hours ?? 0;
                return sum + hours;
            }, 0)
            : 0;
        // Use weekly allocations if available (most accurate), otherwise fall back to task-level data
        const allocatedHours = weekAllocatedHours > 0
            ? weekAllocatedHours
            : taskAllocatedHours;
        const actualHours = timeEntries
            ? timeEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0)
            : 0;
        // Calculate metrics
        const utilizationRate = availableHours > 0
            ? Math.round((actualHours / availableHours) * 100)
            : 0;
        const remainingCapacity = availableHours - actualHours;
        return {
            userId: userProfile.id,
            userName: userProfile.name || 'Unknown',
            userEmail: userProfile.email || '',
            weekStartDate,
            availableHours,
            allocatedHours,
            actualHours,
            utilizationRate,
            remainingCapacity,
        };
    }
    /**
     * Get capacity metrics for a department for a specific week
     */
    async getDepartmentCapacityMetrics(departmentId, weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        // OPTIMIZATION: Parallelize department info and user roles queries
        const [{ data: department, error: deptError }, { data: userRoles, error: rolesError }] = await Promise.all([
            supabase
                .from('departments')
                .select('id, name')
                .eq('id', departmentId)
                .single(),
            supabase
                .from('user_roles')
                .select('user_id, roles!inner(department_id)')
                .eq('roles.department_id', departmentId)
        ]);
        if (deptError || !department) {
            debug_logger_1.logger.error('Error fetching department', {}, deptError);
            return null;
        }
        if (rolesError || !userRoles) {
            debug_logger_1.logger.error('Error fetching department users', {}, rolesError);
            return null;
        }
        const userIds = Array.from(new Set(userRoles.map((ur) => ur.user_id)));
        // Get metrics for each user
        const userMetricsPromises = userIds.map(userId => this.getUserCapacityMetrics(userId, weekStartDate, supabase));
        const userMetrics = (await Promise.all(userMetricsPromises)).filter(m => m !== null);
        // Aggregate department metrics
        const totalAvailableHours = userMetrics.reduce((sum, m) => sum + m.availableHours, 0);
        const totalAllocatedHours = userMetrics.reduce((sum, m) => sum + m.allocatedHours, 0);
        const totalActualHours = userMetrics.reduce((sum, m) => sum + m.actualHours, 0);
        const utilizationRate = totalAvailableHours > 0
            ? Math.round((totalActualHours / totalAvailableHours) * 100)
            : 0;
        const remainingCapacity = totalAvailableHours - totalActualHours;
        return {
            departmentId: department.id,
            departmentName: department.name || 'Unknown',
            weekStartDate,
            teamSize: userMetrics.length,
            totalAvailableHours,
            totalAllocatedHours,
            totalActualHours,
            utilizationRate,
            remainingCapacity,
            userMetrics,
        };
    }
    /**
     * Get capacity metrics for a project for a specific week
     */
    async getProjectCapacityMetrics(projectId, weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        // OPTIMIZATION: Calculate week end date once
        const weekEnd = new Date(weekStartDate);
        weekEnd.setDate(weekEnd.getDate() + 6);
        const weekEndStr = weekEnd.toISOString().split('T')[0];
        // OPTIMIZATION: Parallelize project info and tasks queries
        const [{ data: project, error: projError }, { data: tasks, error: tasksError }] = await Promise.all([
            supabase
                .from('projects')
                .select('id, name, account_id, estimated_hours')
                .eq('id', projectId)
                .single(),
            supabase
                .from('tasks')
                .select('id')
                .eq('project_id', projectId)
        ]);
        if (projError || !project) {
            debug_logger_1.logger.error('Error fetching project', {}, projError);
            return null;
        }
        if (tasksError || !tasks) {
            return {
                projectId: project.id,
                projectName: project.name || 'Unknown',
                accountId: project.account_id,
                weekStartDate,
                assignedUsers: 0,
                allocatedHours: 0,
                actualHours: 0,
                totalEstimatedHours: project.estimated_hours,
                progressPercentage: 0,
            };
        }
        const taskIds = tasks.map((t) => t.id);
        // OPTIMIZATION: Parallelize allocations and time entries queries
        const [{ data: allocations, error: allocError }, { data: timeEntries }] = await Promise.all([
            supabase
                .from('task_week_allocations')
                .select('allocated_hours, assigned_user_id')
                .in('task_id', taskIds)
                .eq('week_start_date', weekStartDate),
            supabase
                .from('time_entries')
                .select('hours_logged')
                .eq('project_id', projectId)
                .gte('entry_date', weekStartDate)
                .lte('entry_date', weekEndStr)
        ]);
        const allocatedHours = allocError || !allocations
            ? 0
            : allocations.reduce((sum, a) => sum + (a.allocated_hours || 0), 0);
        const assignedUsers = allocations
            ? new Set(allocations.map((a) => a.assigned_user_id).filter(Boolean)).size
            : 0;
        const actualHours = timeEntries
            ? timeEntries.reduce((sum, e) => sum + (e.hours_logged || 0), 0)
            : 0;
        // Calculate progress
        const totalEstimatedHours = project.estimated_hours;
        const progressPercentage = totalEstimatedHours && totalEstimatedHours > 0
            ? Math.round((actualHours / totalEstimatedHours) * 100)
            : 0;
        return {
            projectId: project.id,
            projectName: project.name || 'Unknown',
            accountId: project.account_id,
            weekStartDate,
            assignedUsers,
            allocatedHours,
            actualHours,
            totalEstimatedHours,
            progressPercentage,
        };
    }
    /**
     * Get organization-wide capacity metrics for a specific week
     */
    async getOrgCapacityMetrics(weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        // Get all departments
        const { data: departments, error: deptsError } = await supabase
            .from('departments')
            .select('id');
        if (deptsError || !departments) {
            debug_logger_1.logger.error('Error fetching departments', {}, deptsError);
            return null;
        }
        // Get metrics for each department
        const departmentMetricsPromises = departments.map((dept) => this.getDepartmentCapacityMetrics(dept.id, weekStartDate, supabase));
        const departmentMetrics = (await Promise.all(departmentMetricsPromises)).filter(m => m !== null);
        // Aggregate org metrics
        const totalUsers = departmentMetrics.reduce((sum, d) => sum + d.teamSize, 0);
        const totalAvailableHours = departmentMetrics.reduce((sum, d) => sum + d.totalAvailableHours, 0);
        const totalAllocatedHours = departmentMetrics.reduce((sum, d) => sum + d.totalAllocatedHours, 0);
        const totalActualHours = departmentMetrics.reduce((sum, d) => sum + d.totalActualHours, 0);
        const avgUtilizationRate = totalAvailableHours > 0
            ? Math.round((totalActualHours / totalAvailableHours) * 100)
            : 0;
        const totalRemainingCapacity = totalAvailableHours - totalActualHours;
        return {
            weekStartDate,
            totalUsers,
            totalAvailableHours,
            totalAllocatedHours,
            totalActualHours,
            avgUtilizationRate,
            totalRemainingCapacity,
            departmentMetrics,
        };
    }
    /**
     * Get capacity trend for a user over multiple weeks
     */
    async getUserCapacityTrend(userId, numberOfWeeks = 8) {
        const weeks = [];
        const today = new Date();
        for (let i = numberOfWeeks - 1; i >= 0; i--) {
            const weekDate = new Date(today);
            weekDate.setDate(weekDate.getDate() - (i * 7));
            weeks.push(availability_service_1.availabilityService.getWeekStartDate(weekDate));
        }
        const metricsPromises = weeks.map((week) => this.getUserCapacityMetrics(userId, week));
        const metrics = await Promise.all(metricsPromises);
        return metrics.filter((m) => m !== null);
    }
    /**
     * Get capacity trend for a department over multiple weeks
     */
    async getDepartmentCapacityTrend(departmentId, numberOfWeeks = 8) {
        const weeks = [];
        const today = new Date();
        for (let i = numberOfWeeks - 1; i >= 0; i--) {
            const weekDate = new Date(today);
            weekDate.setDate(weekDate.getDate() - (i * 7));
            weeks.push(availability_service_1.availabilityService.getWeekStartDate(weekDate));
        }
        const metricsPromises = weeks.map((week) => this.getDepartmentCapacityMetrics(departmentId, week));
        const metrics = await Promise.all(metricsPromises);
        return metrics.filter((m) => m !== null);
    }
}
// Export singleton instance
exports.capacityService = new CapacityService();
