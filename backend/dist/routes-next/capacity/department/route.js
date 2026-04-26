"use strict";
/**
 * API Route: Department Capacity
 * Returns aggregated capacity data for a specific department
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
const constants_1 = require("@/lib/constants");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const departmentId = searchParams.get('departmentId');
        const period = (searchParams.get('period') ?? 'weekly');
        if (!departmentId) {
            return server_1.NextResponse.json({ error: 'Department ID is required' }, { status: 400 });
        }
        // Permission check: requires VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY
        const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
        if (!canViewTeam && !canViewAll) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view department capacity' }, { status: 403 });
        }
        const ranges = getDateRanges(period);
        const earliestDate = ranges[0].startDate;
        const latestDate = ranges[ranges.length - 1].endDate;
        // Get all roles in this department
        const { data: departmentRoles } = await supabase
            .from('roles')
            .select('id')
            .eq('department_id', departmentId);
        const roleIds = (departmentRoles || []).map((r) => r.id);
        if (roleIds.length === 0) {
            // No roles in department, return empty data
            return server_1.NextResponse.json({
                success: true,
                data: ranges.map((r) => ({
                    label: r.label,
                    startDate: r.startDate,
                    endDate: r.endDate,
                    available: 0,
                    allocated: 0,
                    actual: 0,
                    utilization: 0,
                })),
                period,
            });
        }
        // Get all users with these roles
        const { data: userRolesData } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('role_id', roleIds);
        const userIds = Array.from(new Set((userRolesData || []).map((ur) => ur.user_id)));
        if (userIds.length === 0) {
            return server_1.NextResponse.json({
                success: true,
                data: ranges.map((r) => ({
                    label: r.label,
                    startDate: r.startDate,
                    endDate: r.endDate,
                    available: 0,
                    allocated: 0,
                    actual: 0,
                    utilization: 0,
                })),
                period,
            });
        }
        // Fetch department data
        const [availabilityData, timeEntriesData, projectAssignmentsData, tasksData] = await Promise.all([
            supabase
                .from('user_availability')
                .select('user_id, week_start_date, available_hours')
                .in('user_id', userIds)
                .gte('week_start_date', earliestDate)
                .lte('week_start_date', latestDate),
            supabase
                .from('time_entries')
                .select('hours_logged, entry_date')
                .in('user_id', userIds)
                .gte('entry_date', earliestDate)
                .lte('entry_date', latestDate),
            supabase
                .from('project_assignments')
                .select(`
          user_id,
          project_id,
          projects!inner (
            id,
            estimated_hours,
            status,
            start_date,
            end_date
          )
        `)
                .in('user_id', userIds)
                .is('removed_at', null),
            supabase
                .from('tasks')
                .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at, assigned_to')
                .in('assigned_to', userIds)
        ]);
        const projectIds = Array.from(new Set((projectAssignmentsData.data || []).map((pa) => pa.project_id)));
        let projectTasksData = null;
        if (projectIds.length > 0) {
            const { data } = await supabase
                .from('tasks')
                .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at')
                .in('project_id', projectIds);
            projectTasksData = data;
        }
        // Build a map of project end dates for tasks to inherit when they have no due_date
        const projectEndDateMap = new Map();
        if (projectAssignmentsData.data) {
            for (const pa of projectAssignmentsData.data) {
                const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
                if (project) {
                    const projectId = project.id;
                    const endDate = project.end_date
                        ? new Date(project.end_date)
                        : null;
                    projectEndDateMap.set(projectId, endDate);
                }
            }
        }
        const availabilityMap = new Map();
        if (availabilityData.data) {
            availabilityData.data.forEach((a) => {
                const userId = a.user_id;
                const weekStartDate = a.week_start_date;
                const availableHours = a.available_hours;
                if (!availabilityMap.has(userId)) {
                    availabilityMap.set(userId, new Map());
                }
                availabilityMap.get(userId).set(weekStartDate, availableHours);
            });
        }
        const dataPoints = ranges.map((range) => {
            const periodStart = new Date(range.startDate);
            const periodEnd = new Date(range.endDate);
            let totalAvailable = 0;
            userIds.forEach(userId => {
                const userAvailability = availabilityMap.get(userId) ?? new Map();
                if (period === 'daily') {
                    const weekStart = getWeekStartDate(periodStart);
                    // Use default 40 hours/week if not explicitly set
                    const weeklyHours = userAvailability.get(weekStart) ?? constants_1.DEFAULT_WEEKLY_HOURS;
                    totalAvailable += weeklyHours / 5;
                }
                else if (period === 'weekly') {
                    const weekStart = getWeekStartDate(periodStart);
                    // Use default 40 hours/week if not explicitly set
                    totalAvailable += userAvailability.get(weekStart) ?? constants_1.DEFAULT_WEEKLY_HOURS;
                }
                else {
                    const currentWeek = new Date(periodStart);
                    const dayOfWeek = currentWeek.getDay();
                    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    currentWeek.setDate(currentWeek.getDate() + daysToMonday);
                    while (currentWeek <= periodEnd) {
                        const weekStr = (0, date_fns_1.format)(currentWeek, 'yyyy-MM-dd');
                        // Use default 40 hours/week if not explicitly set
                        const weekHours = userAvailability.get(weekStr) ?? constants_1.DEFAULT_WEEKLY_HOURS;
                        totalAvailable += weekHours;
                        currentWeek.setDate(currentWeek.getDate() + 7);
                    }
                }
            });
            const allTasks = [
                ...(tasksData.data || []),
                ...(projectTasksData ?? [])
            ];
            const uniqueTasks = Array.from(new Map(allTasks.map((t) => [t.id, t])).values());
            // Filter to incomplete tasks only
            const incompleteTasks = uniqueTasks.filter((task) => {
                return task.status !== 'done' && task.status !== 'complete';
            });
            const now = new Date();
            let totalAllocated = incompleteTasks.reduce((sum, task) => {
                const hours = (task.remaining_hours ?? task.estimated_hours ?? 0);
                if (hours === 0)
                    return sum;
                const taskStart = task.start_date ? new Date(task.start_date) : new Date(task.created_at);
                // IMPORTANT: If task has no due_date, inherit from parent project's end_date
                // This ensures tasks in overdue projects are correctly treated as overdue
                const taskOwnDueDate = task.due_date ? new Date(task.due_date) : null;
                const projectEndDate = task.project_id ? projectEndDateMap.get(task.project_id) : null;
                const taskDueDate = taskOwnDueDate ?? projectEndDate;
                // CASE 1: Task is OVERDUE
                if (taskDueDate && taskDueDate < now) {
                    if (periodStart <= now && periodEnd >= now) {
                        return sum + hours;
                    }
                    return sum;
                }
                // CASE 2: No due date - spread over 90 days
                if (!taskDueDate) {
                    const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                    const effectiveStart = taskStart > now ? taskStart : now;
                    if (effectiveStart > periodEnd || effectiveEnd < periodStart)
                        return sum;
                    const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
                    const dailyRate = hours / durationDays;
                    const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
                    const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), periodEnd.getTime()));
                    const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    return sum + (dailyRate * overlapDays);
                }
                // CASE 3: Future due date
                const effectiveStart = taskStart > now ? taskStart : now;
                if (effectiveStart > periodEnd)
                    return sum;
                const remainingDurationMs = taskDueDate.getTime() - effectiveStart.getTime();
                const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
                const dailyRate = hours / remainingDurationDays;
                const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
                const overlapEnd = new Date(Math.min(taskDueDate.getTime(), periodEnd.getTime()));
                const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);
                return sum + (dailyRate * overlapDays);
            }, 0);
            // Add project-level estimates for projects with no tasks
            if (projectAssignmentsData.data) {
                for (const pa of projectAssignmentsData.data) {
                    const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
                    if (!project || project.status === 'complete')
                        continue;
                    const projectHasTasks = (projectTasksData || []).some((t) => t.project_id === project.id);
                    if (!projectHasTasks && project.estimated_hours) {
                        const projectStart = project.start_date ? new Date(project.start_date) : new Date();
                        const projectDueDate = project.end_date ? new Date(project.end_date) : null;
                        const estimatedHours = project.estimated_hours;
                        // CASE 1: Project is OVERDUE
                        if (projectDueDate && projectDueDate < now) {
                            if (periodStart <= now && periodEnd >= now) {
                                totalAllocated += estimatedHours;
                            }
                            continue;
                        }
                        // CASE 2: No due date
                        if (!projectDueDate) {
                            const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                            const effectiveStart = projectStart > now ? projectStart : now;
                            if (effectiveStart <= periodEnd && effectiveEnd >= periodStart) {
                                const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
                                const dailyRate = estimatedHours / durationDays;
                                const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
                                const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), periodEnd.getTime()));
                                const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                totalAllocated += dailyRate * overlapDays;
                            }
                            continue;
                        }
                        // CASE 3: Future due date
                        const effectiveStart = projectStart > now ? projectStart : now;
                        if (effectiveStart > periodEnd)
                            continue;
                        const remainingDurationMs = projectDueDate.getTime() - effectiveStart.getTime();
                        const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
                        const dailyRate = estimatedHours / remainingDurationDays;
                        const overlapStart = new Date(Math.max(effectiveStart.getTime(), periodStart.getTime()));
                        const overlapEnd = new Date(Math.min(projectDueDate.getTime(), periodEnd.getTime()));
                        const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                        const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);
                        totalAllocated += dailyRate * overlapDays;
                    }
                }
            }
            const totalActual = (timeEntriesData.data || [])
                .filter((entry) => {
                const entryDate = new Date(entry.entry_date);
                return entryDate >= periodStart && entryDate <= periodEnd;
            })
                .reduce((sum, entry) => sum + (entry.hours_logged || 0), 0);
            const utilization = totalAvailable > 0 ? Math.round((totalActual / totalAvailable) * 100) : 0;
            return {
                label: range.label,
                startDate: range.startDate,
                endDate: range.endDate,
                available: Math.round(totalAvailable * 10) / 10,
                allocated: Math.round(totalAllocated * 10) / 10,
                actual: Math.round(totalActual * 10) / 10,
                utilization,
            };
        });
        return server_1.NextResponse.json({
            success: true,
            data: dataPoints,
            period,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/capacity/department', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return (0, date_fns_1.format)(monday, 'yyyy-MM-dd');
}
function getDateRanges(period) {
    const ranges = [];
    const today = new Date();
    switch (period) {
        case 'daily': {
            for (let i = -7; i <= 7; i++) {
                const date = (0, date_fns_1.subDays)(today, -i);
                const dateStr = (0, date_fns_1.format)(date, 'yyyy-MM-dd');
                ranges.push({
                    startDate: dateStr,
                    endDate: dateStr,
                    label: (0, date_fns_1.format)(date, 'MMM d'),
                });
            }
            break;
        }
        case 'weekly': {
            for (let i = -4; i <= 4; i++) {
                const weekStart = (0, date_fns_1.startOfWeek)((0, date_fns_1.subWeeks)(today, -i), { weekStartsOn: 1 });
                const weekEnd = (0, date_fns_1.endOfWeek)((0, date_fns_1.subWeeks)(today, -i), { weekStartsOn: 1 });
                ranges.push({
                    startDate: (0, date_fns_1.format)(weekStart, 'yyyy-MM-dd'),
                    endDate: (0, date_fns_1.format)(weekEnd, 'yyyy-MM-dd'),
                    label: (0, date_fns_1.format)(weekStart, 'MMM d'),
                });
            }
            break;
        }
        case 'monthly': {
            for (let i = -3; i <= 3; i++) {
                const monthStart = (0, date_fns_1.startOfMonth)((0, date_fns_1.subMonths)(today, -i));
                const monthEnd = (0, date_fns_1.endOfMonth)((0, date_fns_1.subMonths)(today, -i));
                ranges.push({
                    startDate: (0, date_fns_1.format)(monthStart, 'yyyy-MM-dd'),
                    endDate: (0, date_fns_1.format)(monthEnd, 'yyyy-MM-dd'),
                    label: (0, date_fns_1.format)(monthStart, 'MMM yyyy'),
                });
            }
            break;
        }
        case 'quarterly': {
            for (let i = -2; i <= 2; i++) {
                const quarterStart = (0, date_fns_1.startOfQuarter)((0, date_fns_1.subQuarters)(today, -i));
                const quarterEnd = (0, date_fns_1.endOfQuarter)((0, date_fns_1.subQuarters)(today, -i));
                ranges.push({
                    startDate: (0, date_fns_1.format)(quarterStart, 'yyyy-MM-dd'),
                    endDate: (0, date_fns_1.format)(quarterEnd, 'yyyy-MM-dd'),
                    label: `Q${Math.floor(quarterStart.getMonth() / 3) + 1} ${(0, date_fns_1.format)(quarterStart, 'yyyy')}`,
                });
            }
            break;
        }
    }
    return ranges;
}
