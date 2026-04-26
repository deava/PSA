"use strict";
/**
 * API Route: User Availability
 * Endpoints for managing weekly user work capacity
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const availability_service_1 = require("@/lib/services/availability-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const zod_1 = require("zod");
const createAvailabilitySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid('Invalid user ID'),
    weekStartDate: zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)'),
    availableHours: zod_1.z.number().min(0).max(168),
    scheduleData: zod_1.z.any().optional().nullable(),
    notes: zod_1.z.string().max(1000).optional().nullable(),
});
/**
 * GET /api/availability
 * Get user availability for a specific week
 * Query params: userId, weekStartDate
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
        const userId = searchParams.get('userId') ?? userProfile.id;
        const weekStartDate = searchParams.get('weekStartDate') ?? availability_service_1.availabilityService.getWeekStartDate();
        // Permission check: can view own or has VIEW_TEAM_CAPACITY/VIEW_ALL_CAPACITY
        const isOwnData = userId === userProfile.id;
        if (!isOwnData) {
            const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
            const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
            if (!canViewTeam && !canViewAll) {
                return server_1.NextResponse.json({ error: 'Insufficient permissions to view other users\' availability' }, { status: 403 });
            }
        }
        const availability = await availability_service_1.availabilityService.getUserAvailability(userId, weekStartDate, admin);
        return server_1.NextResponse.json({
            success: true,
            availability,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/availability', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/availability
 * Set or update user availability for a week
 * Body: { userId, weekStartDate, availableHours, scheduleData?, notes? }
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
        const parsed = createAvailabilitySchema.safeParse(rawBody);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return server_1.NextResponse.json({ error: firstError.message }, { status: 400 });
        }
        const { userId, weekStartDate, availableHours, scheduleData, notes } = parsed.data;
        // Permission check: can only edit own availability
        if (userId !== userProfile.id) {
            return server_1.NextResponse.json({ error: 'Can only edit your own availability' }, { status: 403 });
        }
        // Check EDIT_OWN_AVAILABILITY permission
        const canEdit = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.EDIT_OWN_AVAILABILITY, undefined, admin);
        if (!canEdit) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to edit availability' }, { status: 403 });
        }
        const availability = await availability_service_1.availabilityService.setUserAvailability(userId, weekStartDate, availableHours, scheduleData ?? undefined, notes ?? undefined, supabase);
        if (!availability) {
            return server_1.NextResponse.json({ error: 'Failed to set availability' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            availability,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/availability', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/availability
 * Delete user availability for a week
 * Query params: userId, weekStartDate
 */
async function DELETE(request) {
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
        const weekStartDate = searchParams.get('weekStartDate');
        if (!userId || !weekStartDate) {
            return server_1.NextResponse.json({ error: 'Missing required parameters: userId, weekStartDate' }, { status: 400 });
        }
        // Permission check: can only delete own availability
        if (userId !== userProfile.id) {
            return server_1.NextResponse.json({ error: 'Can only delete your own availability' }, { status: 403 });
        }
        const success = await availability_service_1.availabilityService.deleteUserAvailability(userId, weekStartDate, admin);
        if (!success) {
            return server_1.NextResponse.json({ error: 'Failed to delete availability' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Availability deleted successfully',
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in DELETE /api/availability', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
