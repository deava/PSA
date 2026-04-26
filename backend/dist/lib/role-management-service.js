"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleManagementService = void 0;
const supabase_1 = require("./supabase");
const permissions_1 = require("./permissions");
const debug_logger_1 = require("./debug-logger");
const validation_1 = require("./validation");
const permission_checker_1 = require("./permission-checker");
class RoleManagementService {
    getSupabase(providedClient) {
        // Use provided client if available (for server-side calls)
        if (providedClient) {
            return providedClient;
        }
        // Fall back to client-side Supabase (for browser)
        return (0, supabase_1.createClientSupabase)();
    }
    // CRUD operations
    async createRole(data) {
        const startTime = Date.now();
        try {
            // Validate input data
            const validation = (0, validation_1.validateRole)(data);
            if (!validation.isValid) {
                debug_logger_1.logger.error('Role validation failed', {
                    action: 'createRole',
                    errors: validation.errors,
                    warnings: validation.warnings
                });
                return null;
            }
            const supabase = this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'createRole' });
                return null;
            }
            debug_logger_1.logger.info('Creating role', {
                action: 'createRole',
                name: data.name,
                department_id: data.department_id,
                hasReportingRole: !!data.reporting_role_id
            });
            (0, debug_logger_1.databaseQuery)('INSERT', 'roles', { action: 'createRole', name: data.name });
            const { data: role, error } = await supabase
                .from('roles')
                .insert({
                name: data.name,
                description: data.description || null,
                department_id: data.department_id,
                permissions: data.permissions || {},
                reporting_role_id: data.reporting_role_id || null,
            })
                .select()
                .single();
            if (error) {
                (0, debug_logger_1.databaseError)('INSERT', 'roles', error, { action: 'createRole', name: data.name });
                debug_logger_1.logger.error('Error creating role', {
                    action: 'createRole',
                    name: data.name,
                    error: error.message,
                    code: error.code
                }, error);
                return null;
            }
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('createRole', duration, { action: 'createRole', name: data.name });
            (0, debug_logger_1.roleManagement)('created', role.id, undefined, {
                action: 'createRole',
                name: data.name,
                department_id: data.department_id
            });
            debug_logger_1.logger.info('Role created successfully', {
                action: 'createRole',
                roleId: role.id,
                name: role.name,
                duration
            });
            return role;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in createRole', {
                action: 'createRole',
                name: data.name,
                duration
            }, error);
            return null;
        }
    }
    async updateRole(roleId, updates) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return null;
            // Check if role is system role (cannot be updated)
            const { data: existingRole } = await supabase
                .from('roles')
                .select('is_system_role')
                .eq('id', roleId)
                .single();
            if (existingRole?.is_system_role) {
                throw new Error('Cannot update system roles');
            }
            const { data: role, error } = await supabase
                .from('roles')
                .update({
                ...updates,
                updated_at: new Date().toISOString(),
            })
                .eq('id', roleId)
                .select()
                .single();
            if (error) {
                debug_logger_1.logger.error('Error updating role', { error });
                return null;
            }
            return role;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in updateRole', {}, error);
            return null;
        }
    }
    async deleteRole(roleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return false;
            // Check if role is system role (cannot be deleted)
            const { data: existingRole } = await supabase
                .from('roles')
                .select('is_system_role')
                .eq('id', roleId)
                .single();
            if (existingRole?.is_system_role) {
                throw new Error('Cannot delete system roles');
            }
            // Check if role has users assigned
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('id')
                .eq('role_id', roleId)
                .limit(1);
            if (userRoles && userRoles.length > 0) {
                throw new Error('Cannot delete role with assigned users');
            }
            const { error } = await supabase
                .from('roles')
                .delete()
                .eq('id', roleId);
            if (error) {
                debug_logger_1.logger.error('Error deleting role', { error });
                return false;
            }
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in deleteRole', {}, error);
            return false;
        }
    }
    async getRoleById(roleId) {
        const startTime = Date.now();
        try {
            if (!roleId || typeof roleId !== 'string') {
                debug_logger_1.logger.error('Invalid roleId provided', { action: 'getRoleById', roleId });
                return null;
            }
            const supabase = this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getRoleById', roleId });
                return null;
            }
            debug_logger_1.logger.debug('Fetching role by ID', { action: 'getRoleById', roleId });
            (0, debug_logger_1.databaseQuery)('SELECT', 'roles', { action: 'getRoleById', roleId });
            // Fix the nested select syntax - use proper Supabase syntax
            const { data: role, error } = await supabase
                .from('roles')
                .select(`
          *,
          department:departments(id, name),
          reporting_role:roles(id, name)
        `)
                .eq('id', roleId)
                .single();
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'roles', error, { action: 'getRoleById', roleId });
                debug_logger_1.logger.error('Error fetching role', { action: 'getRoleById', roleId }, error);
                return null;
            }
            if (!role) {
                debug_logger_1.logger.warn('Role not found', { action: 'getRoleById', roleId });
                return null;
            }
            // Get user count separately to avoid complex joins
            const { count: userCount } = await supabase
                .from('user_roles')
                .select('*', { count: 'exact', head: true })
                .eq('role_id', roleId);
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('getRoleById', duration, { action: 'getRoleById', roleId });
            const result = {
                ...role,
                department: role.department || { id: '', name: 'Unknown' },
                reporting_role: role.reporting_role || null,
                user_count: userCount || 0,
            };
            debug_logger_1.logger.debug('Role fetched successfully', {
                action: 'getRoleById',
                roleId,
                name: role.name,
                userCount: result.user_count,
                duration
            });
            return result;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in getRoleById', { action: 'getRoleById', roleId, duration }, error);
            return null;
        }
    }
    async getAllRoles() {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return [];
            const { data: roles, error } = await supabase
                .from('roles')
                .select(`
          *,
          department:departments(id, name),
          reporting_role:roles(id, name),
          user_roles!user_id(count)
        `)
                .order('hierarchy_level', { ascending: false });
            if (error) {
                debug_logger_1.logger.error('Error fetching roles', { error });
                return [];
            }
            return roles.map((role) => ({
                ...role,
                department: role.department || { id: '', name: 'Unknown' },
                reporting_role: role.reporting_role || null,
                user_count: role.user_roles?.[0]?.count || 0,
            }));
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getAllRoles', {}, error);
            return [];
        }
    }
    async getRolesByDepartment(departmentId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return [];
            const { data: roles, error } = await supabase
                .from('roles')
                .select(`
          *,
          department:departments(id, name),
          reporting_role:roles(id, name),
          user_roles!user_id(count)
        `)
                .eq('department_id', departmentId)
                .order('hierarchy_level', { ascending: false });
            if (error) {
                debug_logger_1.logger.error('Error fetching roles by department', { error });
                return [];
            }
            return roles.map((role) => ({
                ...role,
                department: role.department || { id: '', name: 'Unknown' },
                reporting_role: role.reporting_role || null,
                user_count: role.user_roles?.[0]?.count || 0,
            }));
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getRolesByDepartment', {}, error);
            return [];
        }
    }
    // Hierarchy operations
    async getRoleHierarchy() {
        const startTime = Date.now();
        try {
            const supabase = this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getRoleHierarchy' });
                return [];
            }
            debug_logger_1.logger.debug('Fetching role hierarchy', { action: 'getRoleHierarchy' });
            (0, debug_logger_1.databaseQuery)('SELECT', 'roles', { action: 'getRoleHierarchy' });
            const { data: roles, error } = await supabase
                .from('roles')
                .select(`
          *,
          department:departments(id, name)
        `)
                .order('hierarchy_level', { ascending: false });
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'roles', error, { action: 'getRoleHierarchy' });
                debug_logger_1.logger.error('Error fetching role hierarchy', { action: 'getRoleHierarchy' }, error);
                return [];
            }
            if (!roles || roles.length === 0) {
                debug_logger_1.logger.warn('No roles found for hierarchy', { action: 'getRoleHierarchy' });
                return [];
            }
            // Get user counts separately to avoid complex joins
            const roleIds = roles.map((role) => role.id);
            const { data: userCounts } = await supabase
                .from('user_roles')
                .select('role_id')
                .in('role_id', roleIds);
            // Count users per role
            const userCountMap = new Map();
            userCounts?.forEach((ur) => {
                const count = userCountMap.get(ur.role_id) || 0;
                userCountMap.set(ur.role_id, count + 1);
            });
            // Build hierarchy tree
            const roleMap = new Map();
            const rootRoles = [];
            // Create nodes with null checks
            roles.forEach((role) => {
                // Handle null departments
                const departmentName = role.department?.name || 'Unknown Department';
                const departmentId = role.department?.id || role.department_id;
                // Safely parse permissions
                let permissions = [];
                try {
                    if (role.permissions && typeof role.permissions === 'object') {
                        permissions = Object.entries(role.permissions || {})
                            .filter(([, hasPermission]) => hasPermission)
                            .map(([permission]) => permission)
                            .filter((permission) => Object.values(permissions_1.Permission).includes(permission));
                    }
                }
                catch (permError) {
                    debug_logger_1.logger.warn('Error parsing permissions', {
                        action: 'getRoleHierarchy',
                        roleId: role.id,
                        error: permError
                    });
                }
                const node = {
                    id: role.id,
                    name: role.name || 'Unnamed Role',
                    department_id: departmentId,
                    department_name: departmentName,
                    hierarchy_level: role.hierarchy_level || 0,
                    is_system_role: role.is_system_role || false,
                    user_count: userCountMap.get(role.id) || 0,
                    children: [],
                    permissions,
                };
                roleMap.set(role.id, node);
            });
            // Build tree structure with null checks
            roles.forEach((role) => {
                const node = roleMap.get(role.id);
                if (!node) {
                    debug_logger_1.logger.warn('Node not found in map', { action: 'getRoleHierarchy', roleId: role.id });
                    return;
                }
                if (role.reporting_role_id) {
                    const parent = roleMap.get(role.reporting_role_id);
                    if (parent) {
                        parent.children.push(node);
                    }
                    else {
                        // Parent not found, treat as root
                        debug_logger_1.logger.debug('Parent role not found, treating as root', {
                            action: 'getRoleHierarchy',
                            roleId: role.id,
                            reportingRoleId: role.reporting_role_id
                        });
                        rootRoles.push(node);
                    }
                }
                else {
                    rootRoles.push(node);
                }
            });
            const duration = Date.now() - startTime;
            (0, debug_logger_1.performance)('getRoleHierarchy', duration, {
                action: 'getRoleHierarchy',
                roleCount: roles.length,
                rootCount: rootRoles.length
            });
            debug_logger_1.logger.info('Role hierarchy built successfully', {
                action: 'getRoleHierarchy',
                roleCount: roles.length,
                rootCount: rootRoles.length,
                duration
            });
            return rootRoles;
        }
        catch (error) {
            const duration = Date.now() - startTime;
            debug_logger_1.logger.error('Exception in getRoleHierarchy', { action: 'getRoleHierarchy', duration }, error);
            return [];
        }
    }
    async updateRoleReporting(roleId, newReportingRoleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return false;
            // Check for circular reference
            if (newReportingRoleId) {
                const isCircular = await this.checkCircularReference(roleId, newReportingRoleId);
                if (isCircular) {
                    throw new Error('Circular reference detected');
                }
            }
            const { error } = await supabase
                .from('roles')
                .update({
                reporting_role_id: newReportingRoleId,
                updated_at: new Date().toISOString(),
            })
                .eq('id', roleId);
            if (error) {
                debug_logger_1.logger.error('Error updating role reporting', { error });
                return false;
            }
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in updateRoleReporting', {}, error);
            return false;
        }
    }
    // Helper function to check if a role is the "No Assigned Role" / "Unassigned" role
    isUnassignedRole(roleName) {
        if (!roleName)
            return false;
        const nameLower = roleName.toLowerCase();
        return nameLower === 'no assigned role' ||
            nameLower === 'unassigned' ||
            nameLower.includes('unassigned');
    }
    // User-role operations
    async assignUserToRole(userId, roleId, assignedBy) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return false;
            // First, check user's current roles to see if they have the "unassigned" role
            const { data: currentRoles, error: currentRolesError } = await supabase
                .from('user_roles')
                .select(`
          role_id,
          roles!inner(name)
        `)
                .eq('user_id', userId);
            if (currentRolesError) {
                debug_logger_1.logger.error('Error fetching current roles', { error: currentRolesError });
                // Continue anyway - this is not a critical error
            }
            // Find the "No Assigned Role" if user has it
            const noAssignedRole = currentRoles?.find((cr) => this.isUnassignedRole(cr.roles?.name));
            const hasOtherRoles = currentRoles?.some((cr) => !this.isUnassignedRole(cr.roles?.name));
            // If user has "No Assigned Role" + other roles, remove "No Assigned Role" first
            if (noAssignedRole && hasOtherRoles) {
                debug_logger_1.logger.info('User has "No Assigned Role" + other roles, removing from "No Assigned Role"', { userId });
                await supabase
                    .from('user_roles')
                    .delete()
                    .eq('user_id', userId)
                    .eq('role_id', noAssignedRole.role_id);
            }
            // Insert the new role assignment
            const { error } = await supabase
                .from('user_roles')
                .insert({
                user_id: userId,
                role_id: roleId,
                assigned_by: assignedBy,
                assigned_at: new Date().toISOString(),
            });
            if (error) {
                debug_logger_1.logger.error('Error assigning user to role', { error });
                return false;
            }
            // If user was ONLY in "No Assigned Role", remove it now (after adding new role)
            if (noAssignedRole && !hasOtherRoles) {
                debug_logger_1.logger.info('User was only in "No Assigned Role", now removing it', { userId });
                const { error: deleteError } = await supabase
                    .from('user_roles')
                    .delete()
                    .eq('user_id', userId)
                    .eq('role_id', noAssignedRole.role_id);
                if (deleteError) {
                    debug_logger_1.logger.error('Error removing user from "No Assigned Role" after assignment', { error: deleteError });
                    // Don't fail the request - user is already assigned to new role
                }
            }
            // Clear permission cache for this user since their roles changed
            (0, permission_checker_1.clearPermissionCache)(userId);
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in assignUserToRole', {}, error);
            return false;
        }
    }
    async removeUserFromRole(userId, roleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return false;
            // Check if this is the user's last role
            const { data: userRoles } = await supabase
                .from('user_roles')
                .select('id')
                .eq('user_id', userId);
            if (userRoles && userRoles.length <= 1) {
                throw new Error('Cannot remove last role from user');
            }
            const { error } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId)
                .eq('role_id', roleId);
            if (error) {
                debug_logger_1.logger.error('Error removing user from role', { error });
                return false;
            }
            // Clear permission cache for this user since their roles changed
            (0, permission_checker_1.clearPermissionCache)(userId);
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in removeUserFromRole', {}, error);
            return false;
        }
    }
    async getUserRoles(userId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return [];
            const { data: userRoles, error } = await supabase
                .from('user_roles')
                .select(`
          roles(*)
        `)
                .eq('user_id', userId);
            if (error) {
                debug_logger_1.logger.error('Error fetching user roles', { error });
                return [];
            }
            return userRoles.map((ur) => ur.roles).filter(Boolean);
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getUserRoles', {}, error);
            return [];
        }
    }
    async getRoleUsers(roleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return [];
            const { data: userRoles, error } = await supabase
                .from('user_roles')
                .select(`
          user_id,
          assigned_at,
          assigned_by,
          user_profiles(id, name, email, image)
        `)
                .eq('role_id', roleId);
            if (error) {
                debug_logger_1.logger.error('Error fetching role users', { error });
                return [];
            }
            return userRoles.map((ur) => ({
                user_id: ur.user_id,
                assigned_at: ur.assigned_at,
                assigned_by: ur.assigned_by,
                user: ur.user_profiles,
            }));
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getRoleUsers', {}, error);
            return [];
        }
    }
    // Permission operations
    async updateRolePermissions(roleId, permissions) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return false;
            // Check if role is system role (cannot update permissions)
            const { data: existingRole } = await supabase
                .from('roles')
                .select('is_system_role')
                .eq('id', roleId)
                .single();
            if (existingRole?.is_system_role) {
                throw new Error('Cannot update permissions for system roles');
            }
            const { error } = await supabase
                .from('roles')
                .update({
                permissions,
                updated_at: new Date().toISOString(),
            })
                .eq('id', roleId);
            if (error) {
                debug_logger_1.logger.error('Error updating role permissions', { error });
                return false;
            }
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in updateRolePermissions', {}, error);
            return false;
        }
    }
    async getRolePermissions(roleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return [];
            const { data: role, error } = await supabase
                .from('roles')
                .select('permissions')
                .eq('id', roleId)
                .single();
            if (error || !role) {
                debug_logger_1.logger.error('Error fetching role permissions', { error });
                return [];
            }
            const permissions = role.permissions || {};
            return Object.entries(permissions)
                .filter(([, hasPermission]) => hasPermission)
                .map(([permission]) => permission)
                .filter((permission) => Object.values(permissions_1.Permission).includes(permission));
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getRolePermissions', {}, error);
            return [];
        }
    }
    // Validation helpers
    async checkCircularReference(roleId, reportingRoleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return true;
            let currentRoleId = reportingRoleId;
            const visited = new Set();
            while (currentRoleId && !visited.has(currentRoleId)) {
                if (currentRoleId === roleId) {
                    return true; // Circular reference detected
                }
                visited.add(currentRoleId);
                const { data: role } = await supabase
                    .from('roles')
                    .select('reporting_role_id')
                    .eq('id', currentRoleId)
                    .single();
                currentRoleId = role?.reporting_role_id || null;
            }
            return false;
        }
        catch (error) {
            debug_logger_1.logger.error('Error checking circular reference', {}, error);
            return true; // Assume circular to be safe
        }
    }
    async validateRoleAssignment(userId, roleId) {
        try {
            const supabase = this.getSupabase();
            if (!supabase)
                return { valid: false, message: 'Database connection failed' };
            // Check if user exists
            const { data: user } = await supabase
                .from('user_profiles')
                .select('id')
                .eq('id', userId)
                .single();
            if (!user) {
                return { valid: false, message: 'User not found' };
            }
            // Check if role exists
            const { data: role } = await supabase
                .from('roles')
                .select('id')
                .eq('id', roleId)
                .single();
            if (!role) {
                return { valid: false, message: 'Role not found' };
            }
            // Check if user already has this role
            const { data: existingAssignment } = await supabase
                .from('user_roles')
                .select('id')
                .eq('user_id', userId)
                .eq('role_id', roleId)
                .single();
            if (existingAssignment) {
                return { valid: false, message: 'User already has this role' };
            }
            return { valid: true };
        }
        catch (error) {
            debug_logger_1.logger.error('Error validating role assignment', {}, error);
            return { valid: false, message: 'Validation failed' };
        }
    }
    async validateRoleHierarchy(roleId, reportingRoleId) {
        try {
            if (!reportingRoleId) {
                return { valid: true }; // No reporting role is valid
            }
            const isCircular = await this.checkCircularReference(roleId, reportingRoleId);
            if (isCircular) {
                return { valid: false, message: 'Circular reference detected' };
            }
            return { valid: true };
        }
        catch (error) {
            debug_logger_1.logger.error('Error validating role hierarchy', {}, error);
            return { valid: false, message: 'Validation failed' };
        }
    }
}
// Export singleton instance
exports.roleManagementService = new RoleManagementService();
