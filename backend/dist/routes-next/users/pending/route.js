"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const user_approval_service_1 = require("@/lib/user-approval-service");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    const startTime = Date.now();
    try {
        // Check authentication and permission (approving users is part of user role management)
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'getPendingUsers' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        (0, debug_logger_1.apiCall)('GET', '/api/users/pending', { action: 'getPendingUsers' });
        const pendingUsers = await user_approval_service_1.userApprovalService.getPendingUsers();
        const duration = Date.now() - startTime;
        (0, debug_logger_1.apiResponse)('GET', '/api/users/pending', 200, {
            action: 'getPendingUsers',
            duration,
            count: pendingUsers.length
        });
        debug_logger_1.logger.info('Pending users retrieved', {
            action: 'getPendingUsers',
            count: pendingUsers.length,
            duration
        });
        return server_1.NextResponse.json({
            users: pendingUsers,
            count: pendingUsers.length
        });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
