"use strict";
/**
 * API Route: Account Capacity
 * Returns aggregated capacity data for a specific account
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
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
        const accountId = searchParams.get('accountId');
        const period = (searchParams.get('period') ?? 'weekly');
        if (!accountId) {
            return server_1.NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
        }
        // Permission check: requires VIEW_TEAM_CAPACITY or VIEW_ALL_CAPACITY
        const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
        if (!canViewTeam && !canViewAll) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view account capacity' }, { status: 403 });
        }
        const ranges = getDateRanges(period);
        const earliestDate = ranges[0].startDate;
        const latestDate = ranges[ranges.length - 1].endDate;
        // Get all projects for this account
        const { data: accountProjects, error: projectsError } = await supabase
            .from('projects')
            .select('id')
            .eq('account_id', accountId);
        if (projectsError) {
            debug_logger_1.logger.error('[Capacity API] Error fetching projects', {}, projectsError);
        }
        const projectIds = (accountProjects || []).map((p) => p.id);
        debug_logger_1.logger.debug('[Capacity API] Found projects for account', { count: projectIds.length });
        if (projectIds.length === 0) {
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
        // Get all users assigned to these projects
        const { data: projectAssignmentsData, error: assignmentsError } = await supabase
            .from('project_assignments')
            .select('user_id, project_id')
            .in('project_id', projectIds)
            .is('removed_at', null);
        if (assignmentsError) {
            debug_logger_1.logger.error('[Capacity API] Error fetching assignments', {}, assignmentsError);
        }
        const userIds = Array.from(new Set((projectAssignmentsData || []).map((pa) => pa.user_id)));
        debug_logger_1.logger.debug('[Capacity API] Found unique users assigned to projects', { count: userIds.length });
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
        // Fetch account data + user's total project assignments (for capacity allocation)
        const [availabilityData, timeEntriesData, projectsData, tasksData, allUserProjectsData] = await Promise.all([
            supabase
                .from('user_availability')
                .select('user_id, week_start_date, available_hours, schedule_data')
                .in('user_id', userIds)
                .gte('week_start_date', earliestDate)
                .lte('week_start_date', latestDate),
            supabase
                .from('time_entries')
                .select('hours_logged, entry_date, project_id')
                .in('user_id', userIds)
                .in('project_id', projectIds)
                .gte('entry_date', earliestDate)
                .lte('entry_date', latestDate),
            supabase
                .from('projects')
                .select('id, estimated_hours, status, start_date, end_date')
                .in('id', projectIds),
            supabase
                .from('tasks')
                .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, created_at, assigned_to')
                .in('project_id', projectIds),
            // Get ALL projects for each user to calculate capacity allocation
            supabase
                .from('project_assignments')
                .select('user_id, project_id, projects!inner(account_id)')
                .in('user_id', userIds)
                .is('removed_at', null)
        ]);
        // Debug logging
        debug_logger_1.logger.debug('[Capacity API] Data fetched', {
            availabilityRecords: availabilityData.data?.length || 0,
            availabilityError: availabilityData.error?.message || null,
            timeEntries: timeEntriesData.data?.length || 0,
            timeEntriesError: timeEntriesData.error?.message || null,
            tasks: tasksData.data?.length || 0,
            tasksError: tasksData.error?.message || null,
        });
        // Log sample availability data to check format
        if (availabilityData.data && availabilityData.data.length > 0) {
            debug_logger_1.logger.debug('[Capacity API] Sample availability', { sample: availabilityData.data[0] });
        }
        // Build a map of project end dates for tasks to inherit when they have no due_date
        const projectEndDateMap = new Map();
        if (projectsData.data) {
            for (const project of projectsData.data) {
                const endDate = project.end_date ? new Date(project.end_date) : null;
                projectEndDateMap.set(project.id, endDate);
            }
        }
        // Build availability map, schedule data map, and per-user defaults
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
        // Calculate how many accounts each user is working on (for proportional allocation)
        const userAccountsMap = new Map();
        if (allUserProjectsData.data) {
            allUserProjectsData.data.forEach((assignment) => {
                const userId = assignment.user_id;
                const projects = assignment.projects;
                const accountId = projects.account_id;
                if (!userAccountsMap.has(userId)) {
                    userAccountsMap.set(userId, new Set());
                }
                userAccountsMap.get(userId)?.add(accountId);
            });
        }
        const dataPoints = ranges.map((range) => {
            const periodStart = new Date(range.startDate);
            const periodEnd = new Date(range.endDate);
            // Calculate available hours for users working on account projects
            // Proportionally allocate user capacity based on number of accounts they work on
            let totalAvailable = 0;
            userIds.forEach(userId => {
                const userAvailability = availabilityMap.get(userId) ?? new Map();
                const userAccounts = userAccountsMap.get(userId);
                const accountCount = userAccounts ? userAccounts.size : 1;
                const allocationFactor = 1 / accountCount; // Split capacity evenly across accounts
                const defaultHours = 0; // No record = not available
                const userScheduleData = scheduleDataMap.get(userId);
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                if (period === 'daily') {
                    const weekStart = getWeekStartDate(periodStart);
                    const schedule = userScheduleData?.get(weekStart);
                    const dayName = dayNames[periodStart.getDay()];
                    let dayHours;
                    if (schedule?.hoursPerDay && schedule.hoursPerDay[dayName] !== undefined) {
                        dayHours = Number(schedule.hoursPerDay[dayName]);
                    }
                    else {
                        dayHours = (userAvailability.get(weekStart) ?? defaultHours) / 7;
                    }
                    totalAvailable += dayHours * allocationFactor;
                }
                else if (period === 'weekly') {
                    const weekStart = getWeekStartDate(periodStart);
                    const schedule = userScheduleData?.get(weekStart);
                    let weekHours;
                    if (schedule?.hoursPerDay) {
                        weekHours = allDays.reduce((sum, d) => sum + (Number(schedule.hoursPerDay[d]) || 0), 0);
                    }
                    else {
                        weekHours = userAvailability.get(weekStart) ?? defaultHours;
                    }
                    totalAvailable += weekHours * allocationFactor;
                }
                else {
                    const currentWeek = new Date(periodStart);
                    const dayOfWeek = currentWeek.getDay();
                    const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                    currentWeek.setDate(currentWeek.getDate() + daysToMonday);
                    while (currentWeek < periodEnd) {
                        const weekStr = (0, date_fns_1.format)(currentWeek, 'yyyy-MM-dd');
                        const schedule = userScheduleData?.get(weekStr);
                        let weekHours;
                        if (schedule?.hoursPerDay) {
                            weekHours = allDays.reduce((sum, d) => sum + (Number(schedule.hoursPerDay[d]) || 0), 0);
                        }
                        else {
                            weekHours = userAvailability.get(weekStr) ?? defaultHours;
                        }
                        totalAvailable += weekHours * allocationFactor;
                        currentWeek.setDate(currentWeek.getDate() + 7);
                    }
                }
            });
            // Calculate allocated hours from tasks
            // Only count tasks assigned to users working on this account
            const incompleteTasks = (tasksData.data || []).filter((task) => {
                // Skip completed tasks
                if (task.status === 'done' || task.status === 'complete')
                    return false;
                // Only count tasks assigned to users in this account (or unassigned tasks)
                if (task.assigned_to && !userIds.includes(task.assigned_to))
                    return false;
                return true;
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
                if (taskDueDate && taskDueDate < now) {
                    // Allocate all remaining hours to the current period
                    if (periodStart <= now && periodEnd >= now) {
                        return sum + hours;
                    }
                    return sum; // Don't count in past or future periods
                }
                // CASE 2: Task has no due date - spread over 90 days from now
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
                // CASE 3: Task has a FUTURE due date - spread from now until due date
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
            if (projectsData.data) {
                for (const project of projectsData.data) {
                    if (project.status === 'complete')
                        continue;
                    const projectHasTasks = (tasksData.data || []).some((t) => t.project_id === project.id);
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
            // Calculate actual hours from time entries on account projects
            const totalActual = (timeEntriesData.data || [])
                .filter((entry) => {
                const entryDate = new Date(entry.entry_date);
                return entryDate >= periodStart && entryDate <= periodEnd;
            })
                .reduce((sum, entry) => sum + (entry.hours_logged || 0), 0);
            const utilization = totalAvailable > 0 ? Math.round((totalActual / totalAvailable) * 100) : 0;
            // Ensure all values are valid finite numbers (NaN/Infinity breaks chart lines)
            const safeAvailable = Number.isFinite(totalAvailable) ? Math.round(totalAvailable * 10) / 10 : 0;
            const safeAllocated = Number.isFinite(totalAllocated) ? Math.round(totalAllocated * 10) / 10 : 0;
            const safeActual = Number.isFinite(totalActual) ? Math.round(totalActual * 10) / 10 : 0;
            const safeUtilization = Number.isFinite(utilization) ? utilization : 0;
            return {
                label: range.label,
                startDate: range.startDate,
                endDate: range.endDate,
                available: safeAvailable,
                allocated: safeAllocated,
                actual: safeActual,
                utilization: safeUtilization,
            };
        });
        // Log final computed data
        debug_logger_1.logger.debug('[Capacity API] Computed data points', { count: dataPoints.length });
        const hasNonZero = dataPoints.some(dp => dp.available > 0 || dp.allocated > 0 || dp.actual > 0);
        debug_logger_1.logger.debug('[Capacity API] Has non-zero data', { hasNonZero });
        if (dataPoints.length > 0) {
            debug_logger_1.logger.debug('[Capacity API] Sample data point', { sample: dataPoints[0] });
        }
        return server_1.NextResponse.json({
            success: true,
            data: dataPoints,
            period,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/capacity/account', {}, error);
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
