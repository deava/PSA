"use strict";
/**
 * Permission Utilities - Fast Synchronous Permission Checks
 *
 * This module provides INSTANT permission checking by using the permissions
 * already loaded in the user profile's roles JSONB. No database calls needed!
 *
 * Use these functions in client-side code where permissions are already loaded.
 * For server-side code that needs context-aware checks, use permission-checker.ts.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkIsSuperadminSync = checkIsSuperadminSync;
exports.checkIsUnassignedSync = checkIsUnassignedSync;
exports.computeUserPermissions = computeUserPermissions;
exports.hasPermissionSync = hasPermissionSync;
exports.hasAnyPermissionSync = hasAnyPermissionSync;
exports.hasAllPermissionsSync = hasAllPermissionsSync;
exports.getAllUserPermissionsSync = getAllUserPermissionsSync;
exports.hasPermissionDirect = hasPermissionDirect;
exports.hasAnyPermissionDirect = hasAnyPermissionDirect;
const permissions_1 = require("./permissions");
/**
 * Check if user is superadmin (synchronous)
 */
function checkIsSuperadminSync(userProfile) {
    if (!userProfile)
        return false;
    // Check is_superadmin flag
    if (userProfile.is_superadmin)
        return true;
    // Check if user has Superadmin role
    if (!userProfile.user_roles || !Array.isArray(userProfile.user_roles))
        return false;
    return userProfile.user_roles.some((ur) => {
        const roleName = ur.roles?.name?.toLowerCase();
        return roleName === 'superadmin' && ur.roles?.is_system_role === true;
    });
}
/**
 * Check if user is unassigned (synchronous)
 */
function checkIsUnassignedSync(userProfile) {
    if (!userProfile?.user_roles || userProfile.user_roles.length === 0) {
        return true; // No roles = unassigned
    }
    // Check if user has ONLY the "No Assigned Role" system role
    if (userProfile.user_roles.length === 1) {
        const role = userProfile.user_roles[0].roles;
        if (!role)
            return true;
        const roleNameLower = role.name?.toLowerCase() || '';
        const isSystemRole = role.is_system_role === true;
        return isSystemRole && (roleNameLower === 'unassigned' ||
            roleNameLower === 'no assigned role' ||
            roleNameLower.includes('unassigned'));
    }
    return false;
}
/**
 * Compute all permissions for a user from their loaded roles
 * This should be called ONCE when the user profile is loaded
 *
 * @param userProfile - User profile with roles already loaded
 * @returns ComputedPermissions object for fast lookups
 */
function computeUserPermissions(userProfile) {
    const result = {
        permissions: new Set(),
        isSuperadmin: false,
        isUnassigned: true,
        userId: userProfile?.id || ''
    };
    if (!userProfile)
        return result;
    result.isSuperadmin = checkIsSuperadminSync(userProfile);
    result.isUnassigned = checkIsUnassignedSync(userProfile);
    // Superadmin has ALL permissions
    if (result.isSuperadmin) {
        Object.values(permissions_1.Permission).forEach(p => result.permissions.add(p));
        return result;
    }
    // Extract permissions from all user's roles
    if (userProfile.user_roles && Array.isArray(userProfile.user_roles)) {
        for (const userRole of userProfile.user_roles) {
            const rolePermissions = userRole.roles?.permissions;
            if (rolePermissions && typeof rolePermissions === 'object') {
                for (const [permName, hasPermission] of Object.entries(rolePermissions)) {
                    if (hasPermission === true) {
                        result.permissions.add(permName);
                    }
                }
            }
        }
    }
    return result;
}
/**
 * Check if user has a specific permission (SYNCHRONOUS - instant!)
 * Uses pre-computed permissions, no database call needed
 *
 * @param computed - Pre-computed permissions from computeUserPermissions
 * @param permission - Permission to check
 * @returns boolean
 */
function hasPermissionSync(computed, permission) {
    if (computed.isSuperadmin)
        return true;
    return computed.permissions.has(permission);
}
/**
 * Check if user has any of the specified permissions (SYNCHRONOUS)
 *
 * @param computed - Pre-computed permissions
 * @param permissions - Array of permissions to check (OR logic)
 * @returns boolean
 */
function hasAnyPermissionSync(computed, permissions) {
    if (computed.isSuperadmin)
        return true;
    return permissions.some(p => computed.permissions.has(p));
}
/**
 * Check if user has all of the specified permissions (SYNCHRONOUS)
 *
 * @param computed - Pre-computed permissions
 * @param permissions - Array of permissions to check (AND logic)
 * @returns boolean
 */
function hasAllPermissionsSync(computed, permissions) {
    if (computed.isSuperadmin)
        return true;
    return permissions.every(p => computed.permissions.has(p));
}
/**
 * Get all permissions a user has (SYNCHRONOUS)
 *
 * @param computed - Pre-computed permissions
 * @returns Array of Permission enum values
 */
function getAllUserPermissionsSync(computed) {
    if (computed.isSuperadmin)
        return Object.values(permissions_1.Permission);
    return Array.from(computed.permissions).filter(p => Object.values(permissions_1.Permission).includes(p));
}
/**
 * Direct permission check from user profile (convenience wrapper)
 * Computes permissions and checks in one call - use when you only need one check
 * For multiple checks, use computeUserPermissions first then hasPermissionSync
 *
 * @param userProfile - User profile with roles
 * @param permission - Permission to check
 * @returns boolean
 */
function hasPermissionDirect(userProfile, permission) {
    const computed = computeUserPermissions(userProfile);
    return hasPermissionSync(computed, permission);
}
/**
 * Direct check for any of multiple permissions (convenience wrapper)
 *
 * @param userProfile - User profile with roles
 * @param permissions - Array of permissions (OR logic)
 * @returns boolean
 */
function hasAnyPermissionDirect(userProfile, permissions) {
    const computed = computeUserPermissions(userProfile);
    return hasAnyPermissionSync(computed, permissions);
}
