"use strict";
/**
 * API Route: Task Completion Trend
 * Returns task completion data for the past 4 weeks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
const debug_logger_1 = require("@/lib/debug-logger");
exports.dynamic = 'force-dynamic';
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
        const weeks = [];
        // Get data for the past 4 weeks
        for (let i = 3; i >= 0; i--) {
            const weekDate = (0, date_fns_1.subWeeks)(now, i);
            const weekStart = (0, date_fns_1.startOfWeek)(weekDate, { weekStartsOn: 1 });
            const weekEnd = (0, date_fns_1.endOfWeek)(weekDate, { weekStartsOn: 1 });
            const weekStartStr = (0, date_fns_1.format)(weekStart, 'yyyy-MM-dd');
            const weekEndStr = (0, date_fns_1.format)(weekEnd, 'yyyy-MM-dd');
            // Count tasks completed this week (assigned to user)
            const { count: completedCount } = await supabase
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', userId)
                .eq('status', 'done')
                .gte('updated_at', weekStartStr)
                .lte('updated_at', weekEndStr + 'T23:59:59');
            // Count tasks created this week (assigned to user)
            const { count: createdCount } = await supabase
                .from('tasks')
                .select('*', { count: 'exact', head: true })
                .eq('assigned_to', userId)
                .gte('created_at', weekStartStr)
                .lte('created_at', weekEndStr + 'T23:59:59');
            weeks.push({
                weekStart: weekStartStr,
                weekLabel: (0, date_fns_1.format)(weekStart, 'MMM d'),
                completed: completedCount || 0,
                created: createdCount || 0,
            });
        }
        // Calculate totals
        const totalCompleted = weeks.reduce((sum, w) => sum + w.completed, 0);
        const totalCreated = weeks.reduce((sum, w) => sum + w.created, 0);
        return server_1.NextResponse.json({
            success: true,
            data: {
                weeks,
                totalCompleted,
                totalCreated,
                completionRate: totalCreated > 0
                    ? Math.round((totalCompleted / totalCreated) * 100)
                    : 0,
            },
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/dashboard/task-completion-trend', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
    }
}
