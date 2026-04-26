"use strict";
/**
 * API Route: Time by Project
 * Returns hours logged per project for the current week
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
const debug_logger_1 = require("@/lib/debug-logger");
exports.dynamic = 'force-dynamic';
// Colors for the pie chart - Brand colors (blue primary + gray variants)
const COLORS = [
    '#007EE5', // accent blue (primary)
    '#647878', // gray
    '#787878', // gray
    '#7B8994', // gray
    '#3D464D', // gray
    '#475250', // gray
    '#4A5D3A', // olive (for variety)
    '#282828', // dark gray
];
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
        const userId = userProfile.id;
        const now = new Date();
        // Get current week range (Monday to Sunday)
        // Extend by 1 day to handle timezone differences
        const weekStart = (0, date_fns_1.startOfWeek)(now, { weekStartsOn: 1 });
        const weekEnd = (0, date_fns_1.endOfWeek)(now, { weekStartsOn: 1 });
        const nextDay = new Date(weekEnd);
        nextDay.setDate(nextDay.getDate() + 1);
        const weekStartStr = (0, date_fns_1.format)(weekStart, 'yyyy-MM-dd');
        const weekEndStr = (0, date_fns_1.format)(nextDay, 'yyyy-MM-dd');
        // Get time entries for this week grouped by project
        const { data: timeEntries, error } = await supabase
            .from('time_entries')
            .select(`
        hours_logged,
        project_id,
        projects(
          id,
          name,
          accounts(name)
        )
      `)
            .eq('user_id', userId)
            .gte('entry_date', weekStartStr)
            .lte('entry_date', weekEndStr);
        if (error) {
            debug_logger_1.logger.error('Error fetching time entries', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch time data' }, { status: 500 });
        }
        // Aggregate by project
        const projectMap = new Map();
        timeEntries?.forEach((entry) => {
            const projectId = entry.project_id;
            const project = Array.isArray(entry.projects) ? entry.projects[0] : entry.projects;
            if (!project)
                return;
            const existing = projectMap.get(projectId);
            if (existing) {
                existing.hours += entry.hours_logged || 0;
            }
            else {
                const account = Array.isArray(project.accounts) ? project.accounts[0] : project.accounts;
                projectMap.set(projectId, {
                    projectId,
                    projectName: project.name,
                    accountName: account?.name || 'No Account',
                    hours: entry.hours_logged || 0,
                    color: COLORS[projectMap.size % COLORS.length],
                });
            }
        });
        // Convert to array and sort by hours
        const projects = Array.from(projectMap.values())
            .sort((a, b) => b.hours - a.hours)
            .map((p, i) => ({
            ...p,
            hours: Math.round(p.hours * 10) / 10,
            color: COLORS[i % COLORS.length],
        }));
        const totalHours = projects.reduce((sum, p) => sum + p.hours, 0);
        return server_1.NextResponse.json({
            success: true,
            data: {
                projects,
                totalHours: Math.round(totalHours * 10) / 10,
                weekStart: weekStartStr,
                weekEnd: weekEndStr,
            },
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/dashboard/time-by-project', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
