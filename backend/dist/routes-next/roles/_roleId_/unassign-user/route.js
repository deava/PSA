"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
async function POST(request, { params }) {
    try {
        const { roleId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(roleId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Check authentication and permission
        const userProfile = await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Parse request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { userId } = body;
        if (!userId) {
            return server_1.NextResponse.json({ error: 'User ID is required' }, { status: 400 });
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
        // Remove user from the specific role
        const { error: deleteError } = await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', userId)
            .eq('role_id', roleId);
        if (deleteError) {
            debug_logger_1.logger.error('Error removing user from role', {}, deleteError);
            return server_1.NextResponse.json({ error: 'Failed to remove user from role' }, { status: 500 });
        }
        // Get the fallback role
        const { data: fallbackRole, error: fallbackError } = await supabase
            .from('roles')
            .select('id, name')
            .eq('name', 'No Assigned Role')
            .single();
        if (fallbackError || !fallbackRole) {
            debug_logger_1.logger.error('Fallback role not found', {}, fallbackError);
            return server_1.NextResponse.json({
                error: 'Fallback role not found. User removed from role but not reassigned.'
            }, { status: 500 });
        }
        // Assign user to fallback role
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
                error: 'User removed from role but failed to assign to fallback role'
            }, { status: 500 });
        }
        debug_logger_1.logger.info(`User ${targetUser.name} removed from ${role.name} and assigned to ${fallbackRole.name}`, {});
        return server_1.NextResponse.json({
            success: true,
            message: `${targetUser.name} removed from ${role.name} and assigned to ${fallbackRole.name}`
        });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
