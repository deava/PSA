"use strict";
/**
 * API Route: Clock In/Out
 * GET - Check clock status
 * POST - Clock in
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/clock
 * Check if user is currently clocked in
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
        // Check for active session
        const { data: session, error } = await supabase
            .from('clock_sessions')
            .select('*')
            .eq('user_id', userProfile.id)
            .eq('is_active', true)
            .single();
        if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
            debug_logger_1.logger.error('Error fetching clock session', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch clock status' }, { status: 500 });
        }
        // Check for stale sessions (over 16 hours) and auto clock them out
        if (session) {
            const clockInTime = new Date(session.clock_in_time);
            const now = new Date();
            const hoursElapsed = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
            if (hoursElapsed >= 16) {
                // Auto clock out
                await supabase
                    .from('clock_sessions')
                    .update({
                    is_active: false,
                    is_auto_clock_out: true,
                    clock_out_time: new Date(clockInTime.getTime() + 16 * 60 * 60 * 1000).toISOString()
                })
                    .eq('id', session.id);
                return server_1.NextResponse.json({
                    success: true,
                    isClockedIn: false,
                    session: null,
                    message: 'Previous session was auto clocked out after 16 hours'
                });
            }
        }
        return server_1.NextResponse.json({
            success: true,
            isClockedIn: !!session,
            session: session || null
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/clock', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/clock
 * Clock in - start a new session
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
        // Permission check: LOG_TIME
        const canLogTime = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_TIME, undefined, admin);
        if (!canLogTime) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to clock in' }, { status: 403 });
        }
        // Check if user already has an active session
        const { data: existingSession } = await supabase
            .from('clock_sessions')
            .select('id')
            .eq('user_id', userProfile.id)
            .eq('is_active', true)
            .single();
        if (existingSession) {
            return server_1.NextResponse.json({ error: 'Already clocked in. Please clock out first.' }, { status: 400 });
        }
        // Create new clock session
        const { data: session, error } = await supabase
            .from('clock_sessions')
            .insert({
            user_id: userProfile.id,
            clock_in_time: new Date().toISOString(),
            is_active: true
        })
            .select()
            .single();
        if (error) {
            // Handle unique constraint violation (race condition - another request already clocked in)
            if (error.code === '23505') {
                return server_1.NextResponse.json({ error: 'Already clocked in. Please clock out first.' }, { status: 400 });
            }
            debug_logger_1.logger.error('Error creating clock session', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to clock in' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Clocked in successfully',
            session
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/clock', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
