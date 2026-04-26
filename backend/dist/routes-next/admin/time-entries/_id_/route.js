"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * PATCH /api/admin/time-entries/[id]
 * Update a time entry (hours, project, description)
 */
async function PATCH(request, { params }) {
    try {
        const { id } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(id)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
        }
        // Check authentication and permissions
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        // Admin edit requires VIEW_ALL_TIME_ENTRIES + MANAGE_TIME (view alone shouldn't grant write access)
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
        const canManageTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canViewAll || !canManageTime) {
            return server_1.NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }
        // Parse request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { hours_logged, project_id, description } = body;
        // Validate hours
        if (hours_logged !== undefined) {
            const hours = parseFloat(hours_logged);
            if (isNaN(hours) || hours < 0) {
                return server_1.NextResponse.json({ success: false, error: 'Invalid hours value' }, { status: 400 });
            }
        }
        // Build update object
        const updateData = {};
        if (hours_logged !== undefined)
            updateData.hours_logged = parseFloat(hours_logged);
        if (project_id !== undefined)
            updateData.project_id = project_id || null;
        if (description !== undefined)
            updateData.description = description || null;
        // Update the time entry
        const { data, error } = await supabase
            .from('time_entries')
            .update(updateData)
            .eq('id', id)
            .select()
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating time entry', {}, error);
            return server_1.NextResponse.json({ success: false, error: 'Failed to update time entry' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            timeEntry: data,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in PATCH /api/admin/time-entries/[id]', {}, error);
        return server_1.NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/admin/time-entries/[id]
 * Delete a time entry
 */
async function DELETE(request, { params }) {
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_time_entry');
        if (blocked)
            return blocked;
        const { id } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(id)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ success: false, error: 'Database connection not available' }, { status: 500 });
        }
        // Check authentication and permissions
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }
        // Admin delete requires VIEW_ALL_TIME_ENTRIES + MANAGE_TIME (view alone shouldn't grant delete access)
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_TIME_ENTRIES, undefined, admin);
        const canManageTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canViewAll || !canManageTime) {
            return server_1.NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
        }
        // Delete the time entry
        const { error } = await supabase
            .from('time_entries')
            .delete()
            .eq('id', id);
        if (error) {
            debug_logger_1.logger.error('Error deleting time entry', {}, error);
            return server_1.NextResponse.json({ success: false, error: 'Failed to delete time entry' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Time entry deleted successfully',
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in DELETE /api/admin/time-entries/[id]', {}, error);
        return server_1.NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}
