"use strict";
/**
 * API Route: Time Analytics
 * Returns time distribution and tracking metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const date_fns_1 = require("date-fns");
const debug_logger_1 = require("@/lib/debug-logger");
function getDateRange(range) {
    const now = new Date();
    const end = now;
    switch (range) {
        case '7d':
            return { start: (0, date_fns_1.subDays)(now, 7), end };
        case '30d':
            return { start: (0, date_fns_1.subDays)(now, 30), end };
        case '90d':
            return { start: (0, date_fns_1.subDays)(now, 90), end };
        case 'ytd':
            return { start: new Date(now.getFullYear(), 0, 1), end };
        case 'all':
            return { start: new Date(2020, 0, 1), end };
        default:
            return { start: (0, date_fns_1.subDays)(now, 30), end };
    }
}
exports.dynamic = 'force-dynamic';
exports.revalidate = 60;
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
        // Require analytics permission
        const hasAnalytics = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.VIEW_ALL_ANALYTICS, undefined, admin);
        if (!hasAnalytics) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view time analytics' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const dateRange = (searchParams.get('dateRange') || '30d');
        const { start, end } = getDateRange(dateRange);
        const startStr = (0, date_fns_1.format)(start, 'yyyy-MM-dd');
        const endStr = (0, date_fns_1.format)(end, 'yyyy-MM-dd');
        // Fetch data
        const [timeEntriesData, projectsData, usersData] = await Promise.all([
            supabase
                .from('time_entries')
                .select('id, user_id, project_id, hours_logged, entry_date, created_at')
                .gte('entry_date', startStr)
                .lte('entry_date', endStr),
            admin.from('projects').select('id, name'),
            admin.from('user_profiles').select('id, name'),
        ]);
        const timeEntries = timeEntriesData.data || [];
        const projects = projectsData.data || [];
        const users = usersData.data || [];
        // Create lookup maps
        const projectMap = new Map(projects.map((p) => [p.id, p.name]));
        const userMap = new Map(users.map((u) => [u.id, u.name]));
        // Calculate total hours
        const totalHours = timeEntries.reduce((sum, te) => sum + (te.hours_logged || 0), 0);
        // Hours by project
        const projectHoursMap = new Map();
        timeEntries.forEach((te) => {
            if (te.project_id) {
                const current = projectHoursMap.get(te.project_id) || 0;
                projectHoursMap.set(te.project_id, current + (te.hours_logged || 0));
            }
        });
        const hoursByProject = Array.from(projectHoursMap.entries())
            .map(([projectId, hours]) => ({
            name: (projectMap.get(projectId) || 'Unknown').substring(0, 15),
            hours: Math.round(hours * 10) / 10,
        }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 10);
        // Hours by day of week
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const hoursByDay = dayNames.map(day => ({ day, hours: 0 }));
        timeEntries.forEach((te) => {
            const dayOfWeek = (0, date_fns_1.getDay)((0, date_fns_1.parseISO)(te.entry_date));
            hoursByDay[dayOfWeek].hours += te.hours_logged || 0;
        });
        // Reorder to start from Monday
        const hoursByDayOrdered = [
            hoursByDay[1],
            hoursByDay[2],
            hoursByDay[3],
            hoursByDay[4],
            hoursByDay[5],
            hoursByDay[6],
            hoursByDay[0],
        ];
        // Calculate daily trend
        const days = (0, date_fns_1.eachDayOfInterval)({ start, end });
        const dailyTrend = days.map(day => {
            const dateStr = (0, date_fns_1.format)(day, 'yyyy-MM-dd');
            const dayEntries = timeEntries.filter((te) => te.entry_date === dateStr);
            const hours = dayEntries.reduce((sum, te) => sum + (te.hours_logged || 0), 0);
            return {
                date: (0, date_fns_1.format)(day, 'MMM d'),
                hours: Math.round(hours * 10) / 10,
            };
        });
        // For longer ranges, aggregate by week
        let aggregatedTrend = dailyTrend;
        if (days.length > 60) {
            const weeklyMap = new Map();
            dailyTrend.forEach(d => {
                const week = d.date.split(' ')[0]; // Just use month as key
                const current = weeklyMap.get(week) || 0;
                weeklyMap.set(week, current + d.hours);
            });
            aggregatedTrend = Array.from(weeklyMap.entries()).map(([date, hours]) => ({
                date,
                hours: Math.round(hours * 10) / 10,
            }));
        }
        // Calculate tracking compliance (days with entries / working days)
        const workingDays = days.filter(d => {
            const dow = (0, date_fns_1.getDay)(d);
            return dow !== 0 && dow !== 6; // Exclude weekends
        });
        const daysWithEntries = new Set(timeEntries.map((te) => te.entry_date));
        const workingDaysWithEntries = workingDays.filter(d => daysWithEntries.has((0, date_fns_1.format)(d, 'yyyy-MM-dd')));
        const trackingCompliance = workingDays.length > 0
            ? Math.round((workingDaysWithEntries.length / workingDays.length) * 100)
            : 0;
        // Calculate averages
        const uniqueUsers = new Set(timeEntries.map((te) => te.user_id));
        const daysInRange = Math.max(1, days.length);
        const avgHoursPerDay = Math.round((totalHours / daysInRange) * 10) / 10;
        const avgHoursPerUser = uniqueUsers.size > 0
            ? Math.round((totalHours / uniqueUsers.size) * 10) / 10
            : 0;
        // Top contributors
        const userHoursMap = new Map();
        timeEntries.forEach((te) => {
            const current = userHoursMap.get(te.user_id) || 0;
            userHoursMap.set(te.user_id, current + (te.hours_logged || 0));
        });
        const topContributors = Array.from(userHoursMap.entries())
            .map(([userId, hours]) => ({
            name: (userMap.get(userId) || 'Unknown').split(' ')[0],
            hours: Math.round(hours * 10) / 10,
        }))
            .sort((a, b) => b.hours - a.hours)
            .slice(0, 5);
        return server_1.NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalHours: Math.round(totalHours * 10) / 10,
                    totalEntries: timeEntries.length,
                    avgHoursPerDay,
                    avgHoursPerUser,
                    trackingCompliance,
                    activeUsers: uniqueUsers.size,
                },
                hoursByProject,
                hoursByDay: hoursByDayOrdered,
                dailyTrend: aggregatedTrend,
                topContributors,
            },
            dateRange,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/analytics/time', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
