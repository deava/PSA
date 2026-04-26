"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DELETE = DELETE;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const debug_logger_1 = require("@/lib/debug-logger");
const role_management_service_1 = require("@/lib/role-management-service");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const supabase_server_1 = require("@/lib/supabase-server");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const validation_helpers_1 = require("@/lib/validation-helpers");
async function DELETE(request, { params }) {
    const startTime = Date.now();
    const { roleId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(roleId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_role');
        if (blocked)
            return blocked;
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        debug_logger_1.logger.info('API DELETE /api/roles/[roleId]', {
            action: 'api_call',
            roleId
        });
        if (!roleId) {
            return server_1.NextResponse.json({ message: 'Role ID is required' }, { status: 400 });
        }
        // Use authenticated client that respects RLS
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Check if role exists and get details
        const { data: existingRole, error: roleError } = await supabase
            .from('roles')
            .select('id, name, is_system_role')
            .eq('id', roleId)
            .single();
        if (roleError || !existingRole) {
            debug_logger_1.logger.error('Role not found', {
                action: 'deleteRole',
                roleId,
                error: roleError?.message
            });
            return server_1.NextResponse.json({ message: 'Role not found' }, { status: 404 });
        }
        // Check if role is system role (cannot be deleted)
        if (existingRole.is_system_role) {
            debug_logger_1.logger.warn('Attempted to delete system role', {
                action: 'deleteRole',
                roleId,
                roleName: existingRole.name
            });
            return server_1.NextResponse.json({ message: 'Cannot delete system roles' }, { status: 400 });
        }
        // Check if role has users assigned and get fallback role
        const { data: userRoles, error: userRolesError } = await supabase
            .from('user_roles')
            .select('id, user_id')
            .eq('role_id', roleId);
        if (userRolesError) {
            debug_logger_1.logger.error('Error checking user roles', {
                action: 'deleteRole',
                roleId,
                error: userRolesError.message
            });
            return server_1.NextResponse.json({ message: 'Error checking role assignments' }, { status: 500 });
        }
        // Check for workflow nodes that reference this role
        const { data: workflowNodes, error: workflowNodesError } = await supabase
            .from('workflow_nodes')
            .select('id, label, workflow_template_id')
            .eq('entity_id', roleId);
        if (workflowNodesError) {
            debug_logger_1.logger.error('Error checking workflow nodes', {
                action: 'deleteRole',
                roleId,
                error: workflowNodesError.message
            });
            // Continue anyway - don't block deletion
        }
        // Clear entity_id on workflow nodes that reference this role
        if (workflowNodes && workflowNodes.length > 0) {
            debug_logger_1.logger.info('Clearing entity_id on workflow nodes that reference this role', {
                action: 'deleteRole',
                roleId,
                roleName: existingRole.name,
                affectedNodes: workflowNodes.length,
                nodeLabels: workflowNodes.map((n) => n.label)
            });
            const { error: clearEntityError } = await supabase
                .from('workflow_nodes')
                .update({ entity_id: null })
                .eq('entity_id', roleId);
            if (clearEntityError) {
                debug_logger_1.logger.error('Error clearing entity_id on workflow nodes', {
                    action: 'deleteRole',
                    roleId,
                    error: clearEntityError.message
                });
                // Continue anyway - the nodes will have orphaned references but won't break
            }
            else {
                debug_logger_1.logger.info('Successfully cleared entity_id on workflow nodes', {
                    action: 'deleteRole',
                    roleId,
                    clearedCount: workflowNodes.length
                });
            }
        }
        // If role has users, reassign them to fallback role
        if (userRoles && userRoles.length > 0) {
            debug_logger_1.logger.info('Role has assigned users, reassigning to fallback role', {
                action: 'deleteRole',
                roleId,
                roleName: existingRole.name,
                userCount: userRoles.length
            });
            // Get the fallback role (should always exist)
            const { data: fallbackRole, error: fallbackError } = await supabase
                .from('roles')
                .select('id, name')
                .eq('name', 'No Assigned Role')
                .single();
            if (fallbackError || !fallbackRole) {
                debug_logger_1.logger.error('Fallback role not found', {
                    action: 'deleteRole',
                    error: fallbackError?.message
                });
                return server_1.NextResponse.json({ message: 'Fallback role not found. Please contact administrator.' }, { status: 500 });
            }
            // For each user, check if they have other roles before reassigning to fallback
            for (const userRole of userRoles) {
                const { data: otherRoles, error: otherRolesError } = await supabase
                    .from('user_roles')
                    .select('role_id, roles(name)')
                    .eq('user_id', userRole.user_id)
                    .neq('role_id', roleId); // Exclude the role being deleted
                if (otherRolesError) {
                    debug_logger_1.logger.error('Error checking other roles for user', {
                        action: 'deleteRole',
                        userId: userRole.user_id,
                        error: otherRolesError.message
                    });
                    continue;
                }
                // Only reassign to fallback if user has no other roles
                if (!otherRoles || otherRoles.length === 0) {
                    const { error: reassignError } = await supabase
                        .from('user_roles')
                        .update({ role_id: fallbackRole.id })
                        .eq('user_id', userRole.user_id)
                        .eq('role_id', roleId);
                    if (reassignError) {
                        debug_logger_1.logger.error('Error reassigning user to fallback role', {
                            action: 'deleteRole',
                            userId: userRole.user_id,
                            error: reassignError.message
                        });
                    }
                    else {
                        debug_logger_1.logger.info('User reassigned to fallback role (no other roles)', {
                            action: 'deleteRole',
                            userId: userRole.user_id,
                            fallbackRoleId: fallbackRole.id
                        });
                    }
                }
                else {
                    // Just remove from the deleted role, keep other roles
                    const { error: deleteError } = await supabase
                        .from('user_roles')
                        .delete()
                        .eq('user_id', userRole.user_id)
                        .eq('role_id', roleId);
                    if (deleteError) {
                        debug_logger_1.logger.error('Error removing user from deleted role', {
                            action: 'deleteRole',
                            userId: userRole.user_id,
                            error: deleteError.message
                        });
                    }
                    else {
                        debug_logger_1.logger.info('User removed from deleted role, keeping other roles', {
                            action: 'deleteRole',
                            userId: userRole.user_id,
                            otherRoles: otherRoles.map((or) => {
                                const roles = or.roles;
                                return roles.name;
                            })
                        });
                    }
                }
            }
            debug_logger_1.logger.info('User reassignment completed', {
                action: 'deleteRole',
                roleId,
                userCount: userRoles.length
            });
        }
        // Delete the role
        debug_logger_1.logger.info('Attempting to delete role from database', {
            action: 'deleteRole',
            roleId,
            roleName: existingRole.name
        });
        const { data: deletedData, error: deleteError } = await supabase
            .from('roles')
            .delete()
            .eq('id', roleId)
            .select();
        if (deleteError) {
            debug_logger_1.logger.error('Error deleting role', {
                action: 'deleteRole',
                roleId,
                error: deleteError.message,
                errorDetails: deleteError
            });
            return server_1.NextResponse.json({ error: 'Failed to delete role' }, { status: 500 });
        }
        const duration = Date.now() - startTime;
        debug_logger_1.logger.info('Role deleted successfully', {
            action: 'deleteRole',
            roleId,
            roleName: existingRole.name,
            deletedData,
            deletedCount: deletedData?.length || 0,
            duration
        });
        return server_1.NextResponse.json({
            message: 'Role deleted successfully',
            deletedRole: existingRole.name,
            deletedCount: deletedData?.length || 0,
            workflowNodesCleared: workflowNodes?.length || 0,
            affectedWorkflowNodes: workflowNodes?.map((n) => n.label) || []
        }, { status: 200 });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
async function PATCH(request, { params }) {
    const startTime = Date.now();
    const { roleId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(roleId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    try {
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        debug_logger_1.logger.info('API PATCH /api/roles/[roleId]', {
            action: 'api_call',
            roleId
        });
        if (!roleId) {
            return server_1.NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate role name if provided
        if (body.name !== undefined) {
            if (typeof body.name !== 'string' || !body.name.trim()) {
                return server_1.NextResponse.json({ error: 'Role name is required and cannot be empty' }, { status: 400 });
            }
            if (body.name.trim().length > 100) {
                return server_1.NextResponse.json({ error: 'Role name must be 100 characters or less' }, { status: 400 });
            }
        }
        // Validate description if provided
        if (body.description !== undefined && body.description !== null) {
            if (typeof body.description !== 'string') {
                return server_1.NextResponse.json({ error: 'Description must be a string' }, { status: 400 });
            }
            if (body.description.length > 500) {
                return server_1.NextResponse.json({ error: 'Description must be 500 characters or less' }, { status: 400 });
            }
        }
        debug_logger_1.logger.info('Role update request body', { action: 'updateRole', roleId, body });
        // Use roleManagementService to update the role
        const updatedRole = await role_management_service_1.roleManagementService.updateRole(roleId, body);
        if (!updatedRole) {
            debug_logger_1.logger.error('Failed to update role', { action: 'updateRole', roleId });
            return server_1.NextResponse.json({ error: 'Failed to update role' }, { status: 500 });
        }
        const duration = Date.now() - startTime;
        debug_logger_1.logger.info('Role updated successfully', {
            action: 'updateRole',
            roleId,
            roleName: updatedRole.name,
            duration
        });
        return server_1.NextResponse.json({ success: true, role: updatedRole });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
