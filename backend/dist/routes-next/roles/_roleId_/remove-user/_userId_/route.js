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
async function DELETE(request, { params }) {
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('remove_user');
        if (blocked)
            return blocked;
        const { roleId, userId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(roleId) || !(0, validation_helpers_1.isValidUUID)(userId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Check authentication and permission
        const userProfile = await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // PRIVILEGE ESCALATION PROTECTION: Prevent users from removing their own roles
        // (This is allowed but logged for audit purposes)
        const isSelfRemoval = userId === userProfile.id;
        if (isSelfRemoval) {
            // Log self-removal attempt for audit
            debug_logger_1.logger.warn('User attempted to remove their own role', {
                userId: userProfile.id,
                roleId,
                timestamp: new Date().toISOString()
            });
            // Allow self-removal but ensure they have at least one other role
        }
        // Check if role exists
        const { data: role, error: roleError } = await supabase
            .from('roles')
            .select('id, name')
            .eq('id', roleId)
            .single();
        if (roleError || !role) {
            return server_1.NextResponse.json({ error: 'Role not found' }, { status: 404 });
        }
        // Check if user exists
        const { data: targetUser, error: userError } = await supabase
            .from('user_profiles')
            .select('id, name')
            .eq('id', userId)
            .single();
        if (userError || !targetUser) {
            return server_1.NextResponse.json({ error: 'User not found' }, { status: 404 });
        }
        // Check if assignment exists
        const { data: existingAssignment } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleId)
            .single();
        if (!existingAssignment) {
            return server_1.NextResponse.json({ error: 'User does not have this role' }, { status: 400 });
        }
        // Check if user has Record<string, unknown> other roles BEFORE attempting removal
        const { data: otherRoles, error: otherRolesError } = await supabase
            .from('user_roles')
            .select('role_id, roles(name)')
            .eq('user_id', userId)
            .neq('role_id', roleId); // Exclude the role being removed
        if (otherRolesError) {
            debug_logger_1.logger.error('Error checking other roles', {}, otherRolesError);
            return server_1.NextResponse.json({ error: 'Failed to check other roles' }, { status: 500 });
        }
        // If user has no other roles, assign to "No Assigned Role" first
        if (!otherRoles || otherRoles.length === 0) {
            debug_logger_1.logger.debug('User has no other roles, assigning to "No Assigned Role" first');
            // Get the fallback role
            const { data: fallbackRole, error: fallbackError } = await supabase
                .from('roles')
                .select('id, name')
                .eq('name', 'No Assigned Role')
                .single();
            if (fallbackError || !fallbackRole) {
                debug_logger_1.logger.error('Fallback role not found', {}, fallbackError);
                return server_1.NextResponse.json({
                    error: 'Fallback role not found. Cannot remove user from their last role.'
                }, { status: 500 });
            }
            // Assign user to fallback role first
            const { error: assignError } = await supabase
                .from('user_roles')
                .insert({
                user_id: userId,
                role_id: fallbackRole.id,
                assigned_by: userProfile.id,
                assigned_at: new Date().toISOString()
            });
            if (assignError) {
                debug_logger_1.logger.error('Error assigning user to fallback role', {}, assignError);
                return server_1.NextResponse.json({
                    error: 'Failed to assign user to fallback role before removal'
                }, { status: 500 });
            }
            debug_logger_1.logger.debug('User assigned to fallback role before removal', { data: { userName: targetUser.name, fallbackRole: fallbackRole.name } });
        }
        else {
            debug_logger_1.logger.debug('User has other roles, proceeding with removal', { data: { userName: targetUser.name, otherRolesCount: otherRoles.length } });
        }
        // Now remove the assignment (user now has at least one other role or fallback role)
        const { error: deleteError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role_id', roleId);
        if (deleteError) {
            debug_logger_1.logger.error('Error removing user from role', {}, deleteError);
            return server_1.NextResponse.json({ error: 'Failed to remove user from role' }, { status: 500 });
        }
        debug_logger_1.logger.debug('User successfully removed from role', { data: { userName: targetUser.name, roleName: role.name } });
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
