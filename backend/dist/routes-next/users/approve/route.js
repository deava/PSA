"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const user_approval_service_1 = require("@/lib/user-approval-service");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function POST(request) {
    const startTime = Date.now();
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'approveUser' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Check authentication and permission
        const userProfile = await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        // Parse request body
        const body = await request.json();
        const { userId, action, reason } = body;
        if (!userId || !action) {
            debug_logger_1.logger.error('Missing required fields', { action: 'approveUser', body });
            return server_1.NextResponse.json({
                error: 'Missing required fields: userId, action'
            }, { status: 400 });
        }
        if (!['approve', 'reject'].includes(action)) {
            debug_logger_1.logger.error('Invalid action', { action: 'approveUser', requestedAction: action });
            return server_1.NextResponse.json({
                error: 'Invalid action. Must be "approve" or "reject"'
            }, { status: 400 });
        }
        (0, debug_logger_1.apiCall)('POST', '/api/users/approve', {
            action: 'approveUser',
            targetUserId: userId,
            actionType: action,
            approverId: userProfile.id
        });
        let success = false;
        if (action === 'approve') {
            success = await user_approval_service_1.userApprovalService.approveUser(userId, userProfile.id, reason);
            if (success) {
                (0, debug_logger_1.userAction)('approved', userId, {
                    action: 'approveUser',
                    approvedBy: userProfile.id,
                    reason
                });
                debug_logger_1.logger.info('User approved successfully', {
                    action: 'approveUser',
                    userId,
                    approvedBy: userProfile.id
                });
            }
        }
        else if (action === 'reject') {
            success = await user_approval_service_1.userApprovalService.rejectUser(userId, userProfile.id, reason);
            if (success) {
                (0, debug_logger_1.userAction)('rejected', userId, {
                    action: 'approveUser',
                    rejectedBy: userProfile.id,
                    reason
                });
                debug_logger_1.logger.info('User rejected successfully', {
                    action: 'approveUser',
                    userId,
                    rejectedBy: userProfile.id
                });
            }
        }
        const duration = Date.now() - startTime;
        (0, debug_logger_1.apiResponse)('POST', '/api/users/approve', success ? 200 : 400, {
            action: 'approveUser',
            duration,
            success
        });
        if (!success) {
            debug_logger_1.logger.error('Failed to process user approval', {
                action: 'approveUser',
                userId,
                actionType: action,
                duration
            });
            return server_1.NextResponse.json({
                error: `Failed to ${action} user`
            }, { status: 400 });
        }
        return server_1.NextResponse.json({
            success: true,
            message: `User ${action}d successfully`
        });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
async function GET(request) {
    const startTime = Date.now();
    try {
        // Check authentication and permission first
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'getApprovalStats' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        (0, debug_logger_1.apiCall)('GET', '/api/users/approve', { action: 'getApprovalStats' });
        const stats = await user_approval_service_1.userApprovalService.getApprovalStats();
        const duration = Date.now() - startTime;
        (0, debug_logger_1.apiResponse)('GET', '/api/users/approve', 200, {
            action: 'getApprovalStats',
            duration
        });
        debug_logger_1.logger.info('Approval stats retrieved', {
            action: 'getApprovalStats',
            ...stats,
            duration
        });
        return server_1.NextResponse.json({ stats });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
