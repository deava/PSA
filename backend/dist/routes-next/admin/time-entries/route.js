"use strict";
/**
 * API Route: Admin Time Entries
 * GET - Get all time entries for admin view
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/admin/time-entries
 * Get all time entries for admin dashboard
 * Query params: startDate, endDate, userId
 */
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
        // Check for admin permission
        // Phase 9: VIEW_TEAM_TIME_ENTRIES → VIEW_ALL_TIME_ENTRIES
        const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
        if (!canViewTeam) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view team time entries' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const startDate = searchParams.get('startDate');
        const endDate = searchParams.get('endDate');
        const userId = searchParams.get('userId');
        // Build query
        let query = supabase
            .from('time_entries')
            .select(`
        *,
        user:user_profiles!user_id (
          id,
          name,
          email
        ),
        project:projects!project_id (
          id,
          name
        ),
        task:tasks!task_id (
          id,
          name
        )
      `)
            .order('entry_date', { ascending: false })
            .order('created_at', { ascending: false });
        // Apply filters
        if (startDate) {
            query = query.gte('entry_date', startDate);
        }
        if (endDate) {
            query = query.lte('entry_date', endDate);
        }
        if (userId) {
            query = query.eq('user_id', userId);
        }
        // Default to last 30 days if no date range specified
        if (!startDate && !endDate) {
            const thirtyDaysAgo = new Date();
            thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
            query = query.gte('entry_date', thirtyDaysAgo.toISOString().split('T')[0]);
        }
        const { data: timeEntries, error } = await query;
        if (error) {
            debug_logger_1.logger.error('Error fetching time entries', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch time entries' }, { status: 500 });
        }
        // Calculate summary stats
        const totalHours = timeEntries?.reduce((sum, entry) => sum + (entry.hours_logged || 0), 0) || 0;
        const uniqueUsers = new Set(timeEntries?.map((e) => e.user_id)).size;
        const uniqueProjects = new Set(timeEntries?.map((e) => e.project_id)).size;
        const autoClockOuts = timeEntries?.filter((e) => e.is_auto_clock_out).length || 0;
        return server_1.NextResponse.json({
            success: true,
            timeEntries: timeEntries || [],
            summary: {
                totalEntries: timeEntries?.length || 0,
                totalHours: Math.round(totalHours * 100) / 100,
                uniqueUsers,
                uniqueProjects,
                autoClockOuts
            }
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/admin/time-entries', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
