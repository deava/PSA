"use strict";
/**
 * API Route: Time Entries
 * Endpoints for logging and managing time on tasks
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const time_entry_service_1 = require("@/lib/services/time-entry-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
const zod_1 = require("zod");
const createTimeEntrySchema = zod_1.z.object({
    taskId: zod_1.z.string().uuid('Invalid task ID').optional().nullable(),
    projectId: zod_1.z.string().uuid('Invalid project ID'),
    hoursLogged: zod_1.z.number().min(0.01).max(24),
    entryDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    description: zod_1.z.string().max(2000).optional().nullable(),
    weekStartDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format').optional(),
});
const updateTimeEntrySchema = zod_1.z.object({
    entryId: zod_1.z.string().uuid('Invalid entry ID'),
    hoursLogged: zod_1.z.number().min(0.01).max(24).optional(),
    description: zod_1.z.string().max(2000).optional().nullable(),
});
/**
 * GET /api/time-entries
 * Get time entries for a user, task, or project
 * Query params: userId, taskId, projectId, startDate, endDate
 */
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
        const userId = searchParams.get('userId');
        const taskId = searchParams.get('taskId');
        const projectId = searchParams.get('projectId');
        const startDate = searchParams.get('startDate') ?? undefined;
        const endDate = searchParams.get('endDate') ?? undefined;
        let timeEntries = [];
        if (taskId) {
            // Get time entries for a specific task
            timeEntries = await time_entry_service_1.timeEntryService.getTaskTimeEntries(taskId);
        }
        else if (projectId) {
            // Get time entries for a project
            timeEntries = await time_entry_service_1.timeEntryService.getProjectTimeEntries(projectId);
        }
        else {
            // Get time entries for a user (default to current user)
            const targetUserId = userId ?? userProfile.id;
            // Permission check for viewing other users' time entries
            // Phase 9: VIEW_TEAM_TIME_ENTRIES → VIEW_ALL_TIME_ENTRIES
            if (targetUserId !== userProfile.id) {
                const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
                if (!canViewTeam) {
                    return server_1.NextResponse.json({ error: 'Insufficient permissions to view other users\' time entries' }, { status: 403 });
                }
            }
            timeEntries = await time_entry_service_1.timeEntryService.getUserTimeEntries(targetUserId, startDate, endDate);
        }
        return server_1.NextResponse.json({
            success: true,
            timeEntries,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/time-entries', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/time-entries
 * Log time on a task
 * Body: { taskId, projectId, hoursLogged, entryDate, description? }
 */
async function POST(request) {
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
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate with Zod schema
        const parsed = createTimeEntrySchema.safeParse(rawBody);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return server_1.NextResponse.json({ error: firstError.message }, { status: 400 });
        }
        const { taskId, projectId, hoursLogged, entryDate, description } = parsed.data;
        // Permission check: LOG_TIME
        const canLogTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canLogTime) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to log time' }, { status: 403 });
        }
        // Calculate week start date (Monday) using local time format
        const entryDateObj = new Date(entryDate);
        const day = entryDateObj.getDay();
        const diff = entryDateObj.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(entryDateObj);
        monday.setDate(diff);
        const mondayYear = monday.getFullYear();
        const mondayMonth = String(monday.getMonth() + 1).padStart(2, '0');
        const mondayDay = String(monday.getDate()).padStart(2, '0');
        const weekStartDate = `${mondayYear}-${mondayMonth}-${mondayDay}`;
        // Insert time entry directly using server-side Supabase
        const { data: timeEntry, error: insertError } = await supabase
            .from('time_entries')
            .insert({
            task_id: taskId,
            user_id: userProfile.id,
            project_id: projectId,
            hours_logged: hoursLogged,
            entry_date: entryDate,
            week_start_date: weekStartDate,
            description: description || null,
        })
            .select()
            .single();
        if (insertError) {
            debug_logger_1.logger.error('Error inserting time entry', {}, insertError);
            return server_1.NextResponse.json({ error: 'Failed to log time' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            timeEntry,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/time-entries', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * PATCH /api/time-entries
 * Update a time entry
 * Body: { entryId, hoursLogged?, entryDate?, description? }
 */
async function PATCH(request) {
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
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate with Zod schema
        const parsed = updateTimeEntrySchema.safeParse(rawBody);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return server_1.NextResponse.json({ error: firstError.message }, { status: 400 });
        }
        const { entryId, hoursLogged, description } = parsed.data;
        const entryDate = rawBody.entryDate;
        // Permission check: EDIT_OWN_TIME_ENTRIES
        const canEdit = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canEdit) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to edit time entries' }, { status: 403 });
        }
        // Verify ownership and check 14-day limit
        const { data: existingEntry, error: fetchError } = await supabase
            .from('time_entries')
            .select('user_id, entry_date')
            .eq('id', entryId)
            .single();
        if (fetchError || !existingEntry) {
            return server_1.NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
        }
        // Check ownership or admin override (VIEW_ALL_TIME_ENTRIES acts as admin time management permission)
        if (existingEntry.user_id !== userProfile.id) {
            const canManageAllTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
            if (!canManageAllTime) {
                return server_1.NextResponse.json({ error: 'Can only edit your own time entries' }, { status: 403 });
            }
        }
        // Check 14-day edit limit (only for own entries)
        if (existingEntry.user_id === userProfile.id) {
            const existingEntryDate = new Date(existingEntry.entry_date);
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            if (existingEntryDate < fourteenDaysAgo) {
                return server_1.NextResponse.json({ error: 'Cannot edit time entries older than 14 days' }, { status: 403 });
            }
        }
        const timeEntry = await time_entry_service_1.timeEntryService.updateTimeEntry(entryId, {
            hours_logged: hoursLogged,
            entry_date: entryDate,
            description: description ?? undefined,
        });
        if (!timeEntry) {
            return server_1.NextResponse.json({ error: 'Failed to update time entry' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            timeEntry,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in PATCH /api/time-entries', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/time-entries
 * Delete a time entry
 * Query params: entryId
 */
async function DELETE(request) {
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_time_entry');
        if (blocked)
            return blocked;
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
        const entryId = searchParams.get('entryId');
        if (!entryId) {
            return server_1.NextResponse.json({ error: 'Missing required parameter: entryId' }, { status: 400 });
        }
        // Permission check: EDIT_OWN_TIME_ENTRIES
        const canEdit = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canEdit) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to delete time entries' }, { status: 403 });
        }
        // Verify ownership and check 14-day limit
        const { data: existingEntry, error: fetchError } = await supabase
            .from('time_entries')
            .select('user_id, entry_date')
            .eq('id', entryId)
            .single();
        if (fetchError || !existingEntry) {
            return server_1.NextResponse.json({ error: 'Time entry not found' }, { status: 404 });
        }
        // Check ownership or admin override (VIEW_ALL_TIME_ENTRIES acts as admin time management permission)
        if (existingEntry.user_id !== userProfile.id) {
            const canManageAllTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
            if (!canManageAllTime) {
                return server_1.NextResponse.json({ error: 'Can only delete your own time entries' }, { status: 403 });
            }
        }
        // Check 14-day edit limit (only for own entries)
        if (existingEntry.user_id === userProfile.id) {
            const entryDate = new Date(existingEntry.entry_date);
            const fourteenDaysAgo = new Date();
            fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
            if (entryDate < fourteenDaysAgo) {
                return server_1.NextResponse.json({ error: 'Cannot delete time entries older than 14 days' }, { status: 403 });
            }
        }
        const success = await time_entry_service_1.timeEntryService.deleteTimeEntry(entryId);
        if (!success) {
            return server_1.NextResponse.json({ error: 'Failed to delete time entry' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Time entry deleted successfully',
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in DELETE /api/time-entries', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
