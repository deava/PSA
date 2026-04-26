"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OverridePermissions = exports.DeprecatedPermissions = exports.PermissionCategories = exports.PermissionDefinitions = exports.Permission = void 0;
exports.checkPermission = checkPermission;
exports.getUserPermissions = getUserPermissions;
exports.getRolePermissions = getRolePermissions;
exports.updateRolePermissions = updateRolePermissions;
exports.getPermissionsByCategory = getPermissionsByCategory;
exports.getAllPermissions = getAllPermissions;
const supabase_1 = require("./supabase");
const debug_logger_1 = require("./debug-logger");
// Define all system permissions (following hybrid approach: base + override + context)
var Permission;
(function (Permission) {
    // ========================================
    // ROLE MANAGEMENT PERMISSIONS
    // ========================================
    Permission["MANAGE_USER_ROLES"] = "manage_user_roles";
    Permission["MANAGE_USERS"] = "manage_users";
    // ========================================
    // DEPARTMENT PERMISSIONS
    // ========================================
    Permission["MANAGE_DEPARTMENTS"] = "manage_departments";
    Permission["MANAGE_USERS_IN_DEPARTMENTS"] = "manage_users_in_departments";
    Permission["VIEW_DEPARTMENTS"] = "view_departments";
    Permission["VIEW_ALL_DEPARTMENTS"] = "view_all_departments";
    // ========================================
    // ACCOUNT PERMISSIONS
    // ========================================
    Permission["MANAGE_ACCOUNTS"] = "manage_accounts";
    Permission["MANAGE_USERS_IN_ACCOUNTS"] = "manage_users_in_accounts";
    Permission["VIEW_ACCOUNTS"] = "view_accounts";
    Permission["VIEW_ALL_ACCOUNTS"] = "view_all_accounts";
    // ========================================
    // PROJECT PERMISSIONS
    // ========================================
    Permission["MANAGE_PROJECTS"] = "manage_projects";
    Permission["VIEW_PROJECTS"] = "view_projects";
    Permission["VIEW_ALL_PROJECTS"] = "view_all_projects";
    Permission["MANAGE_ALL_PROJECTS"] = "manage_all_projects";
    // ========================================
    // PROJECT UPDATES PERMISSIONS
    // DEPRECATED: These exist for backwards compatibility but are NOT enforced.
    // Access to project sub-resources (issues, updates, tasks) uses userHasProjectAccess() instead.
    // ========================================
    Permission["MANAGE_UPDATES"] = "manage_updates";
    Permission["VIEW_UPDATES"] = "view_updates";
    Permission["VIEW_ALL_UPDATES"] = "view_all_updates";
    // ========================================
    // PROJECT ISSUES PERMISSIONS
    // DEPRECATED: Access controlled via userHasProjectAccess() — not checked individually.
    // ========================================
    Permission["MANAGE_ISSUES"] = "manage_issues";
    Permission["VIEW_ISSUES"] = "view_issues";
    // ========================================
    // NEWSLETTER PERMISSIONS
    // NOTE: Newsletter feature not yet implemented — these are placeholders.
    // ========================================
    Permission["MANAGE_NEWSLETTERS"] = "manage_newsletters";
    Permission["VIEW_NEWSLETTERS"] = "view_newsletters";
    // ========================================
    // ANALYTICS PERMISSIONS
    // ========================================
    Permission["VIEW_ALL_DEPARTMENT_ANALYTICS"] = "view_all_department_analytics";
    Permission["VIEW_ALL_ACCOUNT_ANALYTICS"] = "view_all_account_analytics";
    Permission["VIEW_ALL_ANALYTICS"] = "view_all_analytics";
    // ========================================
    // CAPACITY & TIME TRACKING PERMISSIONS
    // ========================================
    Permission["EDIT_OWN_AVAILABILITY"] = "edit_own_availability";
    Permission["VIEW_TEAM_CAPACITY"] = "view_team_capacity";
    Permission["VIEW_ALL_CAPACITY"] = "view_all_capacity";
    // Time Tracking
    Permission["MANAGE_TIME"] = "manage_time";
    Permission["VIEW_TIME_ENTRIES"] = "view_time_entries";
    Permission["EDIT_TIME_ENTRIES"] = "edit_time_entries";
    Permission["VIEW_ALL_TIME_ENTRIES"] = "view_all_time_entries";
    // ========================================
    // WORKFLOW MANAGEMENT PERMISSIONS
    // ========================================
    Permission["MANAGE_WORKFLOWS"] = "manage_workflows";
    Permission["EXECUTE_WORKFLOWS"] = "execute_workflows";
    Permission["EXECUTE_ANY_WORKFLOW"] = "execute_any_workflow";
    Permission["SKIP_WORKFLOW_NODES"] = "skip_workflow_nodes";
    Permission["MANAGE_ALL_WORKFLOWS"] = "manage_all_workflows";
    // ========================================
    // CLIENT PORTAL PERMISSIONS
    // ========================================
    Permission["MANAGE_CLIENT_INVITES"] = "manage_client_invites";
    // Note: Client access and approval permissions are now hardcoded based on is_client flag
})(Permission || (exports.Permission = Permission = {}));
// Human-readable permission definitions
exports.PermissionDefinitions = {
    // ========================================
    // ROLE MANAGEMENT PERMISSIONS
    // ========================================
    [Permission.MANAGE_USER_ROLES]: {
        name: 'Manage User Roles',
        description: 'Full role and user-role assignment management (create/edit/delete roles, assign/remove users, approve registrations)',
        category: 'Role Management'
    },
    [Permission.MANAGE_USERS]: {
        name: 'Manage Users',
        description: 'Full user management capabilities - view, edit, and delete users',
        category: 'Role Management'
    },
    // ========================================
    // DEPARTMENT PERMISSIONS
    // ========================================
    [Permission.MANAGE_DEPARTMENTS]: {
        name: 'Manage Departments',
        description: 'Create, edit, and delete departments (consolidated permission)',
        category: 'Department Management'
    },
    [Permission.MANAGE_USERS_IN_DEPARTMENTS]: {
        name: 'Manage Department Users (Deprecated)',
        description: 'Not enforced — department membership is dynamic from project assignments.',
        category: 'Deprecated'
    },
    [Permission.VIEW_DEPARTMENTS]: {
        name: 'View Departments',
        description: 'View departments user belongs to',
        category: 'Department Management'
    },
    [Permission.VIEW_ALL_DEPARTMENTS]: {
        name: 'View All Departments',
        description: 'View all departments across the organization (override)',
        category: 'Department Management',
        isOverride: true
    },
    // ========================================
    // ACCOUNT PERMISSIONS
    // ========================================
    [Permission.MANAGE_ACCOUNTS]: {
        name: 'Manage Accounts',
        description: 'Create, edit, and delete client accounts (consolidated permission)',
        category: 'Account Management'
    },
    [Permission.MANAGE_USERS_IN_ACCOUNTS]: {
        name: 'Manage Account Users',
        description: 'Assign and remove users from accounts (account membership management)',
        category: 'Account Management'
    },
    [Permission.VIEW_ACCOUNTS]: {
        name: 'View Accounts',
        description: 'View accounts user has access to',
        category: 'Account Management'
    },
    [Permission.VIEW_ALL_ACCOUNTS]: {
        name: 'View All Accounts',
        description: 'View all accounts across the organization (override)',
        category: 'Account Management',
        isOverride: true
    },
    // ========================================
    // PROJECT PERMISSIONS
    // ========================================
    [Permission.MANAGE_PROJECTS]: {
        name: 'Manage Projects',
        description: 'Create, edit, and delete projects in assigned accounts (consolidated permission)',
        category: 'Project Management'
    },
    [Permission.VIEW_PROJECTS]: {
        name: 'View Projects',
        description: 'View projects user is assigned to',
        category: 'Project Management'
    },
    [Permission.VIEW_ALL_PROJECTS]: {
        name: 'View All Projects',
        description: 'View all projects outside of assigned ones (override)',
        category: 'Project Management',
        isOverride: true
    },
    [Permission.MANAGE_ALL_PROJECTS]: {
        name: 'Manage All Projects',
        description: 'Create, edit, and delete any project regardless of assignment (override)',
        category: 'Project Management',
        isOverride: true
    },
    // ========================================
    // PROJECT UPDATES PERMISSIONS
    // ========================================
    [Permission.MANAGE_UPDATES]: {
        name: 'Manage Project Updates (Deprecated)',
        description: 'Not enforced — project access grants sub-resource access. Kept for backwards compatibility.',
        category: 'Deprecated'
    },
    [Permission.VIEW_UPDATES]: {
        name: 'View Project Updates (Deprecated)',
        description: 'Not enforced — project access grants sub-resource access via userHasProjectAccess().',
        category: 'Deprecated'
    },
    [Permission.VIEW_ALL_UPDATES]: {
        name: 'View All Updates (Deprecated)',
        description: 'Not enforced — project access grants sub-resource access via userHasProjectAccess().',
        category: 'Deprecated'
    },
    // ========================================
    // PROJECT ISSUES PERMISSIONS
    // ========================================
    [Permission.MANAGE_ISSUES]: {
        name: 'Manage Project Issues (Deprecated)',
        description: 'Not enforced — project access grants sub-resource access. Kept for backwards compatibility.',
        category: 'Deprecated'
    },
    [Permission.VIEW_ISSUES]: {
        name: 'View Project Issues (Deprecated)',
        description: 'Not enforced — project access grants sub-resource access. Kept for backwards compatibility.',
        category: 'Deprecated'
    },
    // ========================================
    // NEWSLETTER PERMISSIONS
    // ========================================
    [Permission.MANAGE_NEWSLETTERS]: {
        name: 'Manage Newsletters (Placeholder)',
        description: 'Newsletter feature not yet implemented. This permission has no effect.',
        category: 'Deprecated'
    },
    [Permission.VIEW_NEWSLETTERS]: {
        name: 'View Newsletters (Placeholder)',
        description: 'Newsletter feature not yet implemented. This permission has no effect.',
        category: 'Deprecated'
    },
    // ========================================
    // ANALYTICS PERMISSIONS
    // ========================================
    [Permission.VIEW_ALL_DEPARTMENT_ANALYTICS]: {
        name: 'View All Department Analytics',
        description: 'View analytics for entire department (all projects and users in department)',
        category: 'Analytics',
        isOverride: true
    },
    [Permission.VIEW_ALL_ACCOUNT_ANALYTICS]: {
        name: 'View All Account Analytics',
        description: 'View analytics for entire account (all projects in account)',
        category: 'Analytics',
        isOverride: true
    },
    [Permission.VIEW_ALL_ANALYTICS]: {
        name: 'View All Analytics',
        description: 'View organization-wide analytics (override)',
        category: 'Analytics',
        isOverride: true
    },
    // ========================================
    // CAPACITY & TIME TRACKING PERMISSIONS
    // ========================================
    [Permission.EDIT_OWN_AVAILABILITY]: {
        name: 'Edit Own Availability',
        description: 'Set and manage personal weekly work availability',
        category: 'Capacity & Time'
    },
    [Permission.VIEW_TEAM_CAPACITY]: {
        name: 'View Team Capacity',
        description: 'View capacity metrics for team/department members',
        category: 'Capacity & Time'
    },
    [Permission.VIEW_ALL_CAPACITY]: {
        name: 'View All Capacity',
        description: 'View organization-wide capacity metrics (override)',
        category: 'Capacity & Time',
        isOverride: true
    },
    // Time Tracking - NEW consolidated permissions
    [Permission.MANAGE_TIME]: {
        name: 'Manage Time',
        description: 'Log and edit own time entries (consolidated permission)',
        category: 'Capacity & Time'
    },
    [Permission.VIEW_TIME_ENTRIES]: {
        name: 'View Time Entries (Deprecated)',
        description: 'Not enforced — use Manage Time instead. Kept for backwards compatibility.',
        category: 'Deprecated'
    },
    [Permission.EDIT_TIME_ENTRIES]: {
        name: 'Edit Time Entries (Deprecated)',
        description: 'Not enforced — use Manage Time instead. Kept for backwards compatibility.',
        category: 'Deprecated'
    },
    [Permission.VIEW_ALL_TIME_ENTRIES]: {
        name: 'View All Time Entries',
        description: 'View all time entries organization-wide (override)',
        category: 'Capacity & Time',
        isOverride: true
    },
    // ========================================
    // WORKFLOW MANAGEMENT PERMISSIONS
    // ========================================
    [Permission.MANAGE_WORKFLOWS]: {
        name: 'Manage Workflows',
        description: 'Create, edit, and delete workflow templates',
        category: 'Workflows'
    },
    [Permission.EXECUTE_WORKFLOWS]: {
        name: 'Execute Workflows',
        description: 'Hand off work to next nodes in workflows (context-aware: checks node assignment)',
        category: 'Workflows'
    },
    [Permission.EXECUTE_ANY_WORKFLOW]: {
        name: 'Execute Any Workflow (Deprecated)',
        description: 'Not enforced at route level. Use SKIP_WORKFLOW_NODES for out-of-order execution.',
        category: 'Deprecated'
    },
    [Permission.SKIP_WORKFLOW_NODES]: {
        name: 'Skip Workflow Nodes',
        description: 'Hand off work out-of-order for innovation tracking (admin-only)',
        category: 'Workflows'
    },
    [Permission.MANAGE_ALL_WORKFLOWS]: {
        name: 'Manage All Workflows (Deprecated)',
        description: 'Not enforced — no org-wide workflow restrictions exist.',
        category: 'Deprecated'
    },
    // ========================================
    // CLIENT PORTAL PERMISSIONS
    // ========================================
    [Permission.MANAGE_CLIENT_INVITES]: {
        name: 'Manage Client Invitations',
        description: 'Send client invitations and view client feedback (admin/account manager permission)',
        category: 'Client Portal'
    },
};
// Permission categories for UI grouping (excludes deprecated permissions)
exports.PermissionCategories = {
    'Role Management': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Role Management'),
    'Department Management': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Department Management'),
    'Account Management': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Account Management'),
    'Project Management': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Project Management'),
    // Project Updates category removed — all permissions deprecated in favor of userHasProjectAccess()
    Analytics: Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Analytics'),
    'Capacity & Time': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Capacity & Time'),
    Workflows: Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Workflows'),
    'Client Portal': Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Client Portal'),
};
// Deprecated permissions (not shown in UI but kept for backwards compatibility)
exports.DeprecatedPermissions = Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.category === 'Deprecated');
// Get override permissions
exports.OverridePermissions = Object.values(Permission).filter((p) => exports.PermissionDefinitions[p]?.isOverride === true);
// Context for permission checks (enhanced for hybrid approach)
/**
 * Check if a user has a specific permission
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @param context - Optional context (department, account, etc.)
 * @returns True if user has the permission
 */
async function checkPermission(userProfile, permission, context) {
    const startTime = Date.now();
    try {
        // Null checks
        if (!userProfile) {
            debug_logger_1.logger.debug('No user profile provided', { action: 'checkPermission', permission });
            return false;
        }
        if (!userProfile.user_roles || !Array.isArray(userProfile.user_roles)) {
            debug_logger_1.logger.debug('No user roles found', { action: 'checkPermission', permission, userId: userProfile.id });
            return false;
        }
        // Superadmin always has all permissions
        if (isSuperadmin(userProfile)) {
            (0, debug_logger_1.permissionCheck)(permission, userProfile.id, true, { action: 'checkPermission', reason: 'superadmin' });
            return true;
        }
        // Get all user's roles and their permissions
        const userRoles = userProfile.user_roles;
        const roleIds = userRoles.map((ur) => ur?.role_id).filter(Boolean);
        if (roleIds.length === 0) {
            debug_logger_1.logger.debug('No valid role IDs found', { action: 'checkPermission', permission, userId: userProfile.id });
            return false;
        }
        // Fetch permissions for all user's roles
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase) {
            debug_logger_1.logger.error('Supabase client not available', { action: 'checkPermission', permission, userId: userProfile.id });
            return false;
        }
        (0, debug_logger_1.databaseQuery)('SELECT', 'roles', { action: 'checkPermission', permission, userId: userProfile.id });
        const { data: roles, error } = await supabase
            .from('roles')
            .select('id, permissions')
            .in('id', roleIds);
        if (error) {
            (0, debug_logger_1.databaseError)('SELECT', 'roles', error, { action: 'checkPermission', permission, userId: userProfile.id });
            debug_logger_1.logger.error('Error fetching role permissions', { action: 'checkPermission', permission, userId: userProfile.id }, error);
            return false;
        }
        if (!roles || roles.length === 0) {
            debug_logger_1.logger.debug('No roles found for user', { action: 'checkPermission', permission, userId: userProfile.id });
            return false;
        }
        // Check if any role has the required permission
        for (const role of roles) {
            if (!role || !role.permissions)
                continue;
            const permissions = role.permissions || {};
            if (permissions[permission]) {
                // Check context-specific permissions if needed
                if (context?.departmentId) {
                    // For department-specific permissions, check if user has role in that department
                    const userRole = userRoles.find((ur) => ur?.role_id === role.id);
                    if (userRole?.roles?.departments?.id === context.departmentId) {
                        const duration = Date.now() - startTime;
                        (0, debug_logger_1.permissionCheck)(permission, userProfile.id, true, {
                            action: 'checkPermission',
                            roleId: role.id,
                            departmentId: context.departmentId,
                            duration
                        });
                        return true;
                    }
                }
                else {
                    const duration = Date.now() - startTime;
                    (0, debug_logger_1.permissionCheck)(permission, userProfile.id, true, {
                        action: 'checkPermission',
                        roleId: role.id,
                        duration
                    });
                    return true;
                }
            }
        }
        const duration = Date.now() - startTime;
        (0, debug_logger_1.permissionCheck)(permission, userProfile.id, false, {
            action: 'checkPermission',
            duration,
            context: context?.departmentId ? { departmentId: context.departmentId } : undefined
        });
        return false;
    }
    catch (error) {
        const duration = Date.now() - startTime;
        debug_logger_1.logger.error('Exception in checkPermission', {
            action: 'checkPermission',
            permission,
            userId: userProfile?.id,
            duration
        }, error);
        return false;
    }
}
/**
 * Get all permissions for a user (union of all role permissions)
 * @param userProfile - User profile with roles
 * @returns Array of permissions the user has
 */
async function getUserPermissions(userProfile) {
    if (!userProfile?.user_roles)
        return [];
    // Superadmin has all permissions
    if (isSuperadmin(userProfile))
        return Object.values(Permission);
    const userRoles = userProfile.user_roles;
    const roleIds = userRoles.map((ur) => ur.role_id);
    const supabase = (0, supabase_1.createClientSupabase)();
    if (!supabase)
        return [];
    const { data: roles, error } = await supabase
        .from('roles')
        .select('id, permissions')
        .in('id', roleIds);
    if (error || !roles)
        return [];
    const userPermissions = new Set();
    for (const role of roles) {
        const permissions = role.permissions || {};
        for (const [permission, hasPermission] of Object.entries(permissions)) {
            if (hasPermission && Object.values(Permission).includes(permission)) {
                userPermissions.add(permission);
            }
        }
    }
    return Array.from(userPermissions);
}
/**
 * Get permissions for a specific role
 * @param roleId - Role ID
 * @returns Array of permissions for the role
 */
async function getRolePermissions(roleId) {
    const supabase = (0, supabase_1.createClientSupabase)();
    if (!supabase)
        return [];
    const { data: role, error } = await supabase
        .from('roles')
        .select('permissions')
        .eq('id', roleId)
        .single();
    if (error || !role)
        return [];
    const permissions = role.permissions || {};
    return Object.entries(permissions)
        .filter(([_, hasPermission]) => hasPermission)
        .map(([permission, _]) => permission)
        .filter((permission) => Object.values(Permission).includes(permission));
}
/**
 * Update permissions for a role
 * @param roleId - Role ID
 * @param permissions - Object mapping permissions to boolean values
 * @returns Success status
 */
async function updateRolePermissions(roleId, permissions) {
    const supabase = (0, supabase_1.createClientSupabase)();
    if (!supabase)
        return false;
    const { error } = await supabase
        .from('roles')
        .update({ permissions })
        .eq('id', roleId);
    return !error;
}
/**
 * Check if user is superadmin (helper function)
 * Uses is_superadmin flag on user profile, NOT hardcoded role names
 * @param userProfile - User profile with roles
 * @returns True if user is superadmin
 */
function isSuperadmin(userProfile) {
    if (!userProfile)
        return false;
    // Primary check: use the is_superadmin flag on user profile
    if (userProfile.is_superadmin)
        return true;
    // Fallback: check if user has a system role with superadmin-level permissions
    // This uses is_system_role flag, not hardcoded role names
    if (userProfile.user_roles) {
        return userProfile.user_roles.some((ur) => ur.roles.is_system_role &&
            ur.roles.name?.toLowerCase() === 'superadmin');
    }
    return false;
}
/**
 * Get permission definitions grouped by category
 * @returns Object with category names as keys and permission arrays as values
 */
function getPermissionsByCategory() {
    return exports.PermissionCategories;
}
/**
 * Get all available permissions
 * @returns Array of all permissions
 */
function getAllPermissions() {
    return Object.values(Permission);
}
