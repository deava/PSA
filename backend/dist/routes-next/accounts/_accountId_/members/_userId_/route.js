"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * DELETE /api/accounts/[accountId]/members/[userId]
 * Remove a user from an account
 */
async function DELETE(request, { params }) {
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('remove_account_member');
        if (blocked)
            return blocked;
        const { accountId, userId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId) || !(0, validation_helpers_1.isValidUUID)(userId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Require permission to remove users from accounts (with account context)
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USERS_IN_ACCOUNTS, { accountId }, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
        }
        // Remove user from account
        const { error } = await supabase
            .from('account_members')
            .delete()
            .eq('account_id', accountId)
            .eq('user_id', userId);
        if (error) {
            debug_logger_1.logger.error('Error removing user from account', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to remove user from account' }, { status: 500 });
        }
        return server_1.NextResponse.json({ message: 'User removed from account successfully' });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/accounts/[accountId]/members/[userId]', {}, error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
