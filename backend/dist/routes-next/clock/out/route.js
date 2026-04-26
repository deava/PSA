"use strict";
/**
 * API Route: Clock Out
 * POST - Clock out and allocate time to projects/tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * POST /api/clock/out
 * Clock out and create time entries for allocated hours
 */
async function POST(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { allocations, notes } = body;
        // Validate allocations
        if (!allocations || !Array.isArray(allocations) || allocations.length === 0) {
            return server_1.NextResponse.json({ error: 'At least one time allocation is required' }, { status: 400 });
        }
        // Validate each allocation has required fields
        for (const allocation of allocations) {
            if (allocation.hours === undefined || allocation.hours <= 0) {
                return server_1.NextResponse.json({ error: 'Each allocation must have positive hours' }, { status: 400 });
            }
            // Allow null projectId (for "Other" unassigned work)
        }
        // Permission check: LOG_TIME
        const canLogTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canLogTime) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to log time' }, { status: 403 });
        }
        // Get active session
        const { data: session, error: sessionError } = await supabase
            .from('clock_sessions')
            .select('*')
            .eq('user_id', userProfile.id)
            .eq('is_active', true)
            .single();
        if (sessionError || !session) {
            return server_1.NextResponse.json({ error: 'No active clock session found' }, { status: 400 });
        }
        const clockOutTime = new Date();
        const clockInTime = new Date(session.clock_in_time);
        // Calculate total hours clocked
        const totalMinutes = Math.round((clockOutTime.getTime() - clockInTime.getTime()) / (1000 * 60));
        const totalHours = totalMinutes / 60;
        // Calculate total allocated hours
        const totalAllocated = allocations.reduce((sum, a) => sum + a.hours, 0);
        // Warn if allocated hours significantly differ from actual (allow some flexibility)
        if (Math.abs(totalAllocated - totalHours) > 0.5) {
            debug_logger_1.logger.warn(`Clock session ${session.id}: Allocated ${totalAllocated}h but was clocked in for ${totalHours.toFixed(2)}h`, {});
        }
        // Calculate entry date (local time, not UTC)
        // Use local date formatting to match the filter in time-entries-list.tsx
        const year = clockOutTime.getFullYear();
        const month = String(clockOutTime.getMonth() + 1).padStart(2, '0');
        const dayOfMonth = String(clockOutTime.getDate()).padStart(2, '0');
        const entryDate = `${year}-${month}-${dayOfMonth}`;
        // Calculate week start date (Monday)
        const day = clockOutTime.getDay();
        const diff = clockOutTime.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(clockOutTime);
        monday.setDate(diff);
        const mondayYear = monday.getFullYear();
        const mondayMonth = String(monday.getMonth() + 1).padStart(2, '0');
        const mondayDay = String(monday.getDate()).padStart(2, '0');
        const weekStartDate = `${mondayYear}-${mondayMonth}-${mondayDay}`;
        // Create time entries for each allocation
        const timeEntries = allocations.map((allocation) => ({
            task_id: allocation.taskId ?? null,
            user_id: userProfile.id,
            project_id: allocation.projectId,
            hours_logged: Math.round(allocation.hours * 100) / 100, // Round to 2 decimals
            entry_date: entryDate,
            week_start_date: weekStartDate,
            description: (allocation.description ?? notes) || null,
            clock_session_id: session.id,
            clock_in_time: session.clock_in_time,
            clock_out_time: clockOutTime.toISOString(),
            is_auto_clock_out: false
        }));
        // Insert time entries
        const { data: createdEntries, error: entriesError } = await supabase
            .from('time_entries')
            .insert(timeEntries)
            .select();
        if (entriesError) {
            debug_logger_1.logger.error('Error creating time entries', {}, entriesError);
            return server_1.NextResponse.json({ error: 'Failed to create time entries' }, { status: 500 });
        }
        // Close the clock session
        const { error: updateError } = await supabase
            .from('clock_sessions')
            .update({
            is_active: false,
            clock_out_time: clockOutTime.toISOString(),
            notes: notes ?? null
        })
            .eq('id', session.id);
        if (updateError) {
            debug_logger_1.logger.error('Error closing clock session', {}, updateError);
            // Don't fail the request since entries were created
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Clocked out successfully',
            session: {
                ...session,
                clock_out_time: clockOutTime.toISOString(),
                is_active: false
            },
            timeEntries: createdEntries,
            summary: {
                clockedInHours: Math.round(totalHours * 100) / 100,
                allocatedHours: totalAllocated,
                entriesCreated: createdEntries?.length || 0
            }
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/clock/out', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
