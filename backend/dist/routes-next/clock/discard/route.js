"use strict";
/**
 * API Route: Discard Clock Session
 * POST - Clock out without creating time entries (for accidental clock-ins)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * POST /api/clock/discard
 * Clock out without creating time entries
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
        // Close the clock session without creating time entries
        const { error: updateError } = await supabase
            .from('clock_sessions')
            .update({
            is_active: false,
            clock_out_time: clockOutTime.toISOString(),
            notes: 'Discarded - no time logged'
        })
            .eq('id', session.id);
        if (updateError) {
            debug_logger_1.logger.error('Error closing clock session', {}, updateError);
            return server_1.NextResponse.json({ error: 'Failed to close session' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Clocked out without saving time entries',
            session: {
                ...session,
                clock_out_time: clockOutTime.toISOString(),
                is_active: false
            }
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/clock/discard', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
