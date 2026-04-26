"use strict";
/**
 * API Route: Organization Capacity
 * Returns aggregated capacity data for the entire organization
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
// Enable route caching with stale-while-revalidate
exports.dynamic = 'force-dynamic';
exports.revalidate = 30; // Revalidate every 30 seconds
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
        const period = (searchParams.get('period') ?? 'weekly');
        // Permission check: VIEW_ALL_CAPACITY required for organization-wide data
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
        if (!canViewAll) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view organization capacity' }, { status: 403 });
        }
        const ranges = getDateRanges(period);
        const earliestDate = ranges[0].startDate;
        const latestDate = ranges[ranges.length - 1].endDate;
        // Get all users with availability data
        const { data: allUsers } = await supabase
            .from('user_profiles')
            .select('id');
        const userIds = (allUsers || []).map((u) => u.id);
        // Fetch organization-wide data
        const [availabilityData, timeEntriesData, projectAssignmentsData, tasksData] = await Promise.all([
            supabase
                .from('user_availability')
                .select('user_id, week_start_date, available_hours, schedule_data')
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
        // Get all project tasks
        const projectIds = Array.from(new Set((projectAssignmentsData.data || []).map((pa) => pa.project_id)));
        let projectTasksData = null;
        if (projectIds.length > 0) {
            const { data } = await supabase
                .from('tasks')
                .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at')
                .in('project_id', projectIds);
            projectTasksData = data;
        }
        // Build availability map per user per week, schedule data map, and per-user defaults
        const availabilityMap = new Map();
        const scheduleDataMap = new Map();
        const userDefaultHoursMap = new Map();
        if (availabilityData.data) {
            availabilityData.data.forEach((a) => {
                const userId = a.user_id;
                const weekStartDate = a.week_start_date;
                const availableHours = a.available_hours;
                if (!availabilityMap.has(userId)) {
                    availabilityMap.set(userId, new Map());
                }
                availabilityMap.get(userId)?.set(weekStartDate, availableHours);
                if (a.schedule_data) {
                    if (!scheduleDataMap.has(userId)) {
                        scheduleDataMap.set(userId, new Map());
                    }
                    scheduleDataMap.get(userId)?.set(weekStartDate, a.schedule_data);
                }
            });
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
        // Calculate capacity for each date range
        const dataPoints = ranges.map((range) => {
            const periodStart = new Date(range.startDate);
            const periodEnd = new Date(range.endDate);
            // Calculate total available hours across all users
            let totalAvailable = 0;
            userIds.forEach(userId => {
                const userAvailability = availabilityMap.get(userId) ?? new Map();
                const defaultHours = 0; // No record = not available
                const userScheduleData = scheduleDataMap.get(userId);
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                if (period === 'daily') {
                    const weekStart = getWeekStartDate(periodStart);
                    const schedule = userScheduleData?.get(weekStart);
                    const dayName = dayNames[periodStart.getDay()];
                    if (schedule?.hoursPerDay && schedule.hoursPerDay[dayName] !== undefined) {
                        totalAvailable += Number(schedule.hoursPerDay[dayName]);
                    }
                    else {
                        totalAvailable += (userAvailability.get(weekStart) ?? defaultHours) / 7;
                    }
                }
                else if (period === 'weekly') {
                    const weekStart = getWeekStartDate(periodStart);
                    const schedule = userScheduleData?.get(weekStart);
                    if (schedule?.hoursPerDay) {
                        totalAvailable += allDays.reduce((sum, d) => sum + (Number(schedule.hoursPerDay[d]) || 0), 0);
                    }
                    else {
                        totalAvailable += userAvailability.get(weekStart) ?? defaultHours;
                    }
                }
                else {
                    const currentWeek = new Date(periodStart);
                    const dayOfWeek = currentWeek.getDay();
                    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    currentWeek.setDate(currentWeek.getDate() + daysToMonday);
                    while (currentWeek <= periodEnd) {
                        const weekStr = (0, date_fns_1.format)(currentWeek, 'yyyy-MM-dd');
                        const schedule = userScheduleData?.get(weekStr);
                        let weekHours;
                        if (schedule?.hoursPerDay) {
                            weekHours = allDays.reduce((sum, d) => sum + (Number(schedule.hoursPerDay[d]) || 0), 0);
                        }
                        else {
                            weekHours = userAvailability.get(weekStr) ?? defaultHours;
                        }
                        totalAvailable += weekHours;
                        currentWeek.setDate(currentWeek.getDate() + 7);
                    }
                }
            });
            // Calculate allocated hours from all tasks
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
                // CASE 1: Task is OVERDUE (due date is in the past)
                // All remaining hours should be allocated to current/future periods
                if (taskDueDate && taskDueDate < now) {
                    // For overdue tasks, allocate all remaining hours to this week
                    // (they need to be done NOW)
                    if (periodStart <= now && periodEnd >= now) {
                        // This is the current period - allocate all overdue hours here
                        return sum + hours;
                    }
                    else if (periodStart > now) {
                        // Future period - don't double-count overdue tasks
                        return sum;
                    }
                    else {
                        // Past period - don't count overdue tasks in historical data
                        return sum;
                    }
                }
                // CASE 2: Task has no due date - spread from now until far future
                if (!taskDueDate) {
                    // No due date means indefinite - spread over a reasonable timeframe (90 days)
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
                // CASE 3: Task has a FUTURE due date - spread hours from now until due date
                const effectiveStart = taskStart > now ? taskStart : now;
                // If task hasn't started yet and starts after this period, skip
                if (effectiveStart > periodEnd)
                    return sum;
                // Calculate remaining duration (from now or task start, whichever is later)
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
                const now = new Date();
                for (const pa of projectAssignmentsData.data) {
                    const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
                    if (!project || project.status === 'complete')
                        continue;
                    const projectHasTasks = (projectTasksData ?? []).some((t) => t.project_id === project.id);
                    if (!projectHasTasks && project.estimated_hours) {
                        const projectStart = project.start_date ? new Date(project.start_date) : new Date();
                        const projectDueDate = project.end_date ? new Date(project.end_date) : null;
                        const estimatedHours = project.estimated_hours;
                        // CASE 1: Project is OVERDUE
                        if (projectDueDate && projectDueDate < now) {
                            if (periodStart <= now && periodEnd >= now) {
                                // Allocate all remaining hours to current period
                                totalAllocated += estimatedHours;
                            }
                            continue;
                        }
                        // CASE 2: No due date - spread over 90 days from now
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
                        // CASE 3: Future due date - spread from now until due date
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
            // Calculate total actual hours
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
        const response = server_1.NextResponse.json({
            success: true,
            data: dataPoints,
            period,
        });
        // Add aggressive caching headers (30 second cache, 5 minute stale-while-revalidate)
        response.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=300');
        return response;
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/capacity/organization', {}, error);
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
