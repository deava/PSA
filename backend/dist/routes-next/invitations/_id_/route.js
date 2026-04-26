"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
// DELETE - Revoke a pending invitation
async function DELETE(request, { params }) {
    try {
        const { id } = await params;
        // Auth + permission check
        const user = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        await (0, server_guards_1.requirePermission)(user, permissions_1.Permission.MANAGE_USER_ROLES, {}, admin);
        // Use admin client to bypass RLS for invitation management
        const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!adminSupabase) {
            return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        // Verify invitation exists and is pending
        const { data: invitation, error: fetchError } = await adminSupabase
            .from('user_invitations')
            .select('id, status')
            .eq('id', id)
            .single();
        if (fetchError || !invitation) {
            debug_logger_1.logger.error('Invitation not found for revoke', { invitationId: id, error: fetchError?.message });
            return server_1.NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        if (invitation.status === 'pending') {
            // Soft delete: revoke pending invitations
            const { data: updated, error: updateError } = await adminSupabase
                .from('user_invitations')
                .update({ status: 'revoked' })
                .eq('id', id)
                .select()
                .single();
            if (updateError) {
                debug_logger_1.logger.error('Failed to revoke invitation', { error: updateError.message, invitationId: id });
                return server_1.NextResponse.json({ error: 'Failed to revoke invitation' }, { status: 500 });
            }
            return server_1.NextResponse.json({ invitation: updated });
        }
        // Hard delete: remove non-pending invitations (revoked, accepted, expired)
        const { error: deleteError } = await adminSupabase
            .from('user_invitations')
            .delete()
            .eq('id', id);
        if (deleteError) {
            debug_logger_1.logger.error('Failed to delete invitation', { error: deleteError.message, invitationId: id });
            return server_1.NextResponse.json({ error: 'Failed to delete invitation' }, { status: 500 });
        }
        return server_1.NextResponse.json({ deleted: true });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
