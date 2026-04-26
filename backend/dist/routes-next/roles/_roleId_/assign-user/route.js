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
        // PRIVILEGE ESCALATION PROTECTION: Prevent users from assigning roles to themselves
        if (userId === userProfile.id) {
            return server_1.NextResponse.json({
                error: 'You cannot assign roles to yourself. Please contact an administrator.'
            }, { status: 403 });
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
        // Check if assignment already exists
        const { data: existingAssignment } = await supabase
            .from('user_roles')
            .select('id')
            .eq('user_id', userId)
            .eq('role_id', roleId)
            .single();
        if (existingAssignment) {
            return server_1.NextResponse.json({ error: 'User already has this role' }, { status: 400 });
        }
        // Get user's current roles for logging
        const { data: currentRoles, error: currentRolesError } = await supabase
            .from('user_roles')
            .select(`
        role_id,
        roles!inner(name)
      `)
            .eq('user_id', userId);
        if (currentRolesError) {
            debug_logger_1.logger.error('Error fetching current roles', {}, currentRolesError);
            return server_1.NextResponse.json({ error: 'Failed to check current roles' }, { status: 500 });
        }
        // Helper function to check if a role is the "No Assigned Role" / "Unassigned" role
        const isUnassignedRole = (roleName) => {
            if (!roleName)
                return false;
            const nameLower = roleName.toLowerCase();
            return nameLower === 'no assigned role' ||
                nameLower === 'unassigned' ||
                nameLower.includes('unassigned');
        };
        // Check if user is only in "No Assigned Role" (needs special handling due to P0001 constraint)
        const noAssignedRole = currentRoles?.find((cr) => {
            const roles = cr.roles;
            return isUnassignedRole(roles?.name);
        });
        const hasOtherRoles = currentRoles?.some((cr) => {
            const roles = cr.roles;
            return !isUnassignedRole(roles?.name);
        });
        if (noAssignedRole && !hasOtherRoles) {
            debug_logger_1.logger.debug('User is only in "No Assigned Role", will replace with new role', {});
            // Don't remove yet - we'll replace the assignment after adding the new role
        }
        else if (noAssignedRole && hasOtherRoles) {
            debug_logger_1.logger.debug('User has "No Assigned Role" + other roles, removing from "No Assigned Role"', {});
            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', noAssignedRole.role_id);
            if (deleteError) {
                debug_logger_1.logger.error('Error removing user from "No Assigned Role"', {}, deleteError);
                return server_1.NextResponse.json({ error: 'Failed to remove user from "No Assigned Role"' }, { status: 500 });
            }
            debug_logger_1.logger.debug('User removed from "No Assigned Role"', {});
        }
        else {
            debug_logger_1.logger.debug('User is not in "No Assigned Role", keeping existing roles', {});
        }
        // Create the new assignment
        const { error: insertError } = await supabase
            .from('user_roles')
            .insert({
            user_id: userId,
            role_id: roleId,
            assigned_by: userProfile.id,
            assigned_at: new Date().toISOString()
        });
        if (insertError) {
            debug_logger_1.logger.error('Error assigning user to role', {}, insertError);
            return server_1.NextResponse.json({ error: 'Failed to assign user to role' }, { status: 500 });
        }
        // If user was only in "No Assigned Role", remove it now (after adding new role)
        if (noAssignedRole && !hasOtherRoles) {
            debug_logger_1.logger.debug('Now removing user from "No Assigned Role" (user now has new role)', {});
            const { error: deleteError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', noAssignedRole.role_id);
            if (deleteError) {
                debug_logger_1.logger.error('Error removing user from "No Assigned Role" after assignment', {}, deleteError);
                // Don't fail the request - user is already assigned to new role
                debug_logger_1.logger.warn('User assigned to new role but failed to remove from "No Assigned Role"', {});
            }
            else {
                debug_logger_1.logger.debug('User removed from "No Assigned Role" after assignment', {});
            }
        }
        debug_logger_1.logger.info(`User ${targetUser.name} assigned to ${role.name}`, { previousRolesCount: currentRoles?.length || 0 });
        return server_1.NextResponse.json({
            success: true,
            message: `${targetUser.name} assigned to ${role.name}`
        });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
