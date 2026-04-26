"use strict";
/**
 * API Route: Capacity History
 * Returns historical capacity data for trend charts
 * Calculates all data points in a single query for performance
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
// Helper to parse date string as local time (not UTC)
function parseLocalDate(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
}
// Helper to format date as YYYY-MM-DD in local time
function formatLocalDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
// Enable aggressive caching with stale-while-revalidate
exports.dynamic = 'force-dynamic';
exports.revalidate = 30;
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        // Get current user
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId') ?? userProfile.id;
        const period = (searchParams.get('period') ?? 'weekly');
        // Permission check: can view own data, or needs VIEW_TEAM_CAPACITY/VIEW_ALL_CAPACITY for others
        const isOwnData = userId === userProfile.id;
        if (!isOwnData) {
            const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
            const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
            if (!canViewTeam && !canViewAll) {
                return server_1.NextResponse.json({ error: 'Insufficient permissions to view other users\' capacity history' }, { status: 403 });
            }
        }
        // Generate date ranges based on period
        const ranges = getDateRanges(period);
        // Get the full date range for queries
        const originalEarliestDate = ranges[0].startDate;
        const latestDate = ranges[ranges.length - 1].endDate;
        // Extend range to capture weeks that might start before the period (for availability)
        const earliestDateObj = new Date(ranges[0].startDate);
        earliestDateObj.setDate(earliestDateObj.getDate() - 7); // Go back a week to catch boundary weeks
        const extendedEarliestDate = earliestDateObj.toISOString().split('T')[0];
        // Fetch all relevant data in parallel for performance
        const [availabilityData, tasksData, projectAssignmentsData, timeEntriesData] = await Promise.all([
            // Get user availability for all weeks in range (use extended range)
            supabase
                .from('user_availability')
                .select('week_start_date, available_hours, schedule_data')
                .eq('user_id', userId)
                .gte('week_start_date', extendedEarliestDate)
                .lte('week_start_date', latestDate),
            // Get all tasks assigned to user with dates in range
            supabase
                .from('tasks')
                .select('id, estimated_hours, remaining_hours, status, start_date, due_date, updated_at, created_at')
                .eq('assigned_to', userId),
            // Get project assignments for the user
            supabase
                .from('project_assignments')
                .select(`
          project_id,
          projects!inner (
            id,
            estimated_hours,
            status,
            start_date,
            end_date
          )
        `)
                .eq('user_id', userId)
                .is('removed_at', null),
            // Get time entries for actual hours worked (use original date range)
            supabase
                .from('time_entries')
                .select('hours_logged, entry_date')
                .eq('user_id', userId)
                .gte('entry_date', originalEarliestDate)
                .lte('entry_date', latestDate)
        ]);
        // Also get tasks from assigned projects
        let projectTasksData = null;
        if (projectAssignmentsData.data && projectAssignmentsData.data.length > 0) {
            const projectIds = projectAssignmentsData.data.map((pa) => pa.project_id);
            const { data } = await supabase
                .from('tasks')
                .select('id, project_id, estimated_hours, remaining_hours, status, start_date, due_date, updated_at, created_at')
                .in('project_id', projectIds);
            projectTasksData = data;
        }
        // Build availability map (week_start_date -> hours) and schedule data map
        const availabilityMap = new Map();
        const scheduleDataMap = new Map();
        if (availabilityData.data) {
            availabilityData.data.forEach((a) => {
                availabilityMap.set(a.week_start_date, a.available_hours);
                if (a.schedule_data) {
                    scheduleDataMap.set(a.week_start_date, a.schedule_data);
                }
            });
        }
        // Default to 0 hours for weeks without an explicit availability record.
        // Users must set their availability — unset weeks = not available.
        const userDefaultHours = 0;
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
        // Combine all tasks (directly assigned + from projects)
        const allTasks = [
            ...(tasksData.data || []),
            ...(projectTasksData ?? [])
        ];
        // Remove duplicates (task might be both directly assigned and in an assigned project)
        const uniqueTasks = Array.from(new Map(allTasks.map((t) => [t.id, t])).values());
        // Calculate capacity for each date range
        const dataPoints = ranges.map((range) => {
            // Get available hours for this period based on user_availability
            let available = 0;
            let weeksInPeriod = 0;
            // Parse as local dates to match how date-fns generates them
            const periodStart = parseLocalDate(range.startDate);
            const periodEnd = parseLocalDate(range.endDate);
            if (period === 'daily') {
                // For daily, use per-day hours from schedule_data if available
                const weekStart = getWeekStartDate(periodStart);
                const scheduleData = scheduleDataMap.get(weekStart);
                const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
                const dayName = dayNames[periodStart.getDay()];
                if (scheduleData?.hoursPerDay && scheduleData.hoursPerDay[dayName] !== undefined) {
                    available = Number(scheduleData.hoursPerDay[dayName]);
                }
                else if (scheduleData?.[dayName] !== undefined) {
                    // Legacy format: schedule_data has day names directly
                    available = Number(scheduleData[dayName]);
                }
                else {
                    // Fallback: divide weekly hours by 7 days
                    const weeklyHours = availabilityMap.get(weekStart) ?? userDefaultHours;
                    available = weeklyHours / 7;
                }
                weeksInPeriod = 1 / 7;
            }
            else if (period === 'weekly') {
                const weekStart = getWeekStartDate(periodStart);
                const scheduleData = scheduleDataMap.get(weekStart);
                // Use per-day sum from schedule_data if available (source of truth)
                if (scheduleData?.hoursPerDay) {
                    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                    available = days.reduce((sum, d) => sum + (Number(scheduleData.hoursPerDay[d]) || 0), 0);
                }
                else {
                    available = availabilityMap.get(weekStart) ?? userDefaultHours;
                }
                weeksInPeriod = 1;
            }
            else if (period === 'monthly' || period === 'quarterly') {
                // Sum up weekly availabilities that fall within this period
                let totalHours = 0;
                // Use local time to match how availability is saved
                const currentWeek = new Date(periodStart.getFullYear(), periodStart.getMonth(), periodStart.getDate());
                // Get the Monday of the week containing periodStart
                const dayOfWeek = currentWeek.getDay();
                const daysToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
                currentWeek.setDate(currentWeek.getDate() + daysToMonday);
                // If the Monday is before the period start, move to next Monday
                if (currentWeek.getTime() < periodStart.getTime()) {
                    currentWeek.setDate(currentWeek.getDate() + 7);
                }
                const endTime = periodEnd.getTime();
                while (currentWeek.getTime() <= endTime) {
                    const weekStr = formatLocalDate(currentWeek);
                    const weekSchedule = scheduleDataMap.get(weekStr);
                    let weekHours;
                    if (weekSchedule?.hoursPerDay) {
                        const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
                        weekHours = days.reduce((sum, d) => sum + (Number(weekSchedule.hoursPerDay[d]) || 0), 0);
                    }
                    else {
                        weekHours = availabilityMap.get(weekStr) ?? userDefaultHours;
                    }
                    totalHours += weekHours;
                    weeksInPeriod++;
                    // Move to next week
                    currentWeek.setDate(currentWeek.getDate() + 7);
                }
                available = totalHours;
            }
            // Calculate allocated hours from tasks
            const incompleteTasks = uniqueTasks.filter((task) => {
                return task.status !== 'done' && task.status !== 'complete';
            });
            const now = new Date();
            const rangePeriodStart = new Date(range.startDate);
            const rangePeriodEnd = new Date(range.endDate);
            let allocated = incompleteTasks.reduce((sum, task) => {
                const hours = (task.remaining_hours ?? task.estimated_hours ?? 0);
                if (hours === 0)
                    return sum;
                const taskStart = task.start_date ? new Date(task.start_date) : new Date(task.created_at);
                // IMPORTANT: If task has no due_date, inherit from parent project's end_date
                // This ensures tasks in overdue projects are correctly treated as overdue
                const taskOwnDueDate = task.due_date ? new Date(task.due_date) : null;
                const projectEndDate = task.project_id ? projectEndDateMap.get(task.project_id) : null;
                const taskDueDate = taskOwnDueDate ?? projectEndDate;
                // CASE 1: Task is OVERDUE (its due date OR project's end date is in the past)
                if (taskDueDate && taskDueDate < now) {
                    if (rangePeriodStart <= now && rangePeriodEnd >= now) {
                        return sum + hours;
                    }
                    return sum;
                }
                // CASE 2: No due date AND no project end date - spread over 90 days
                if (!taskDueDate) {
                    const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                    const effectiveStart = taskStart > now ? taskStart : now;
                    if (effectiveStart > rangePeriodEnd || effectiveEnd < rangePeriodStart)
                        return sum;
                    const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
                    const dailyRate = hours / durationDays;
                    const overlapStart = new Date(Math.max(effectiveStart.getTime(), rangePeriodStart.getTime()));
                    const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), rangePeriodEnd.getTime()));
                    const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                    return sum + (dailyRate * overlapDays);
                }
                // CASE 3: Future due date
                const effectiveStart = taskStart > now ? taskStart : now;
                if (effectiveStart > rangePeriodEnd)
                    return sum;
                const remainingDurationMs = taskDueDate.getTime() - effectiveStart.getTime();
                const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
                const dailyRate = hours / remainingDurationDays;
                const overlapStart = new Date(Math.max(effectiveStart.getTime(), rangePeriodStart.getTime()));
                const overlapEnd = new Date(Math.min(taskDueDate.getTime(), rangePeriodEnd.getTime()));
                const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);
                return sum + (dailyRate * overlapDays);
            }, 0);
            // Add project-level estimated hours for projects with no tasks
            if (projectAssignmentsData.data) {
                for (const pa of projectAssignmentsData.data) {
                    const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
                    if (!project || project.status === 'complete')
                        continue;
                    // Check if project has tasks WITH estimated hours — if not, use project-level estimate as fallback
                    const projectTasks = (projectTasksData ?? []).filter((t) => t.project_id === project.id);
                    const taskEstimatedTotal = projectTasks.reduce((sum, t) => sum + (t.remaining_hours ?? t.estimated_hours ?? 0), 0);
                    const projectHasTaskEstimates = taskEstimatedTotal > 0;
                    if (!projectHasTaskEstimates && project.estimated_hours) {
                        const projectStart = project.start_date ? new Date(project.start_date) : new Date();
                        const projectDueDate = project.end_date ? new Date(project.end_date) : null;
                        const estimatedHours = project.estimated_hours;
                        // CASE 1: Project is OVERDUE
                        if (projectDueDate && projectDueDate < now) {
                            if (rangePeriodStart <= now && rangePeriodEnd >= now) {
                                allocated += estimatedHours;
                            }
                            continue;
                        }
                        // CASE 2: No due date
                        if (!projectDueDate) {
                            const effectiveEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                            const effectiveStart = projectStart > now ? projectStart : now;
                            if (effectiveStart <= rangePeriodEnd && effectiveEnd >= rangePeriodStart) {
                                const durationDays = Math.max(1, Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)));
                                const dailyRate = estimatedHours / durationDays;
                                const overlapStart = new Date(Math.max(effectiveStart.getTime(), rangePeriodStart.getTime()));
                                const overlapEnd = new Date(Math.min(effectiveEnd.getTime(), rangePeriodEnd.getTime()));
                                const overlapDays = Math.max(0, Math.ceil((overlapEnd.getTime() - overlapStart.getTime()) / (1000 * 60 * 60 * 24)) + 1);
                                allocated += dailyRate * overlapDays;
                            }
                            continue;
                        }
                        // CASE 3: Future due date
                        const effectiveStart = projectStart > now ? projectStart : now;
                        if (effectiveStart > rangePeriodEnd)
                            continue;
                        const remainingDurationMs = projectDueDate.getTime() - effectiveStart.getTime();
                        const remainingDurationDays = Math.max(1, Math.ceil(remainingDurationMs / (1000 * 60 * 60 * 24)));
                        const dailyRate = estimatedHours / remainingDurationDays;
                        const overlapStart = new Date(Math.max(effectiveStart.getTime(), rangePeriodStart.getTime()));
                        const overlapEnd = new Date(Math.min(projectDueDate.getTime(), rangePeriodEnd.getTime()));
                        const overlapMs = overlapEnd.getTime() - overlapStart.getTime();
                        const overlapDays = Math.max(0, Math.ceil(overlapMs / (1000 * 60 * 60 * 24)) + 1);
                        allocated += dailyRate * overlapDays;
                    }
                }
            }
            // Calculate actual hours from time_entries (real hours logged)
            const actual = (timeEntriesData.data || [])
                .filter((entry) => {
                const entryDate = new Date(entry.entry_date);
                const periodStart = new Date(range.startDate);
                const periodEnd = new Date(range.endDate);
                return entryDate >= periodStart && entryDate <= periodEnd;
            })
                .reduce((sum, entry) => {
                // Convert to number (Postgres numeric/decimal returns as string)
                return sum + Number(entry.hours_logged || 0);
            }, 0);
            // Calculate utilization percentage
            const utilization = available > 0 ? Math.round((actual / available) * 100) : 0;
            return {
                label: range.label,
                startDate: range.startDate,
                endDate: range.endDate,
                available: Math.round(available * 100) / 100, // 2 decimal places
                allocated: Math.round(allocated * 100) / 100, // 2 decimal places
                actual: Math.round(actual * 100) / 100, // 2 decimal places
                utilization,
            };
        });
        return server_1.NextResponse.json({
            success: true,
            data: dataPoints,
            period,
            userId,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/capacity/history', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// Helper function to get week start date (Monday) - uses local time
function getWeekStartDate(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.getFullYear(), d.getMonth(), diff);
    return formatLocalDate(monday);
}
// Generate date ranges based on period type
// Shows current day in the middle - past and future data
function getDateRanges(period) {
    const ranges = [];
    const today = new Date();
    switch (period) {
        case 'daily': {
            // 7 days before, today, and 7 days after (15 total with today in middle)
            for (let i = -7; i <= 7; i++) {
                const date = (0, date_fns_1.subDays)(today, -i); // Negative to add days for positive i
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
            // 4 weeks before and 4 weeks after (9 total with current week in middle)
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
            // 3 months before and 3 months after (7 total with current month in middle)
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
            // 2 quarters before and 2 quarters after (5 total with current quarter in middle)
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
