"use strict";
/**
 * API Route: RBAC Diagnostic Tests
 * Runs automated tests to verify RBAC system is functioning correctly
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function POST(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check if user has permission to run RBAC diagnostic tests
        const canManageUsers = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_USERS, undefined, admin);
        if (!canManageUsers && !(0, rbac_1.isSuperadmin)(userProfile)) {
            return server_1.NextResponse.json({ error: 'Forbidden: Insufficient permissions to run RBAC diagnostic tests' }, { status: 403 });
        }
        const failures = [];
        let totalTests = 0;
        let passedTests = 0;
        // Test 1: Verify all users can be fetched with their roles
        totalTests++;
        const { data: allUsers, error: usersError } = await supabase
            .from('user_profiles')
            .select(`
        id,
        name,
        is_superadmin,
        user_roles!user_id(
          id,
          role_id,
          roles!role_id(
            id,
            name,
            permissions
          )
        )
      `);
        if (usersError || !allUsers) {
            failures.push('Failed to fetch users with roles');
        }
        else {
            passedTests++;
        }
        // Test 2: Verify getUserProfileFromRequest loads user_roles correctly
        totalTests++;
        if (userProfile.user_roles && Array.isArray(userProfile.user_roles)) {
            passedTests++;
        }
        else {
            failures.push('getUserProfileFromRequest did not load user_roles array');
        }
        // Test 3: Verify roles have permission objects
        totalTests++;
        const { data: roles, error: rolesError } = await supabase
            .from('roles')
            .select('id, name, permissions');
        if (rolesError || !roles) {
            failures.push('Failed to fetch roles');
        }
        else {
            const rolesWithoutPermissions = roles.filter((r) => !r.permissions || typeof r.permissions !== 'object');
            if (rolesWithoutPermissions.length > 0) {
                failures.push(`${rolesWithoutPermissions.length} role(s) have invalid permissions structure`);
            }
            else {
                passedTests++;
            }
        }
        // Test 4: Verify no users are missing roles (except superadmins)
        totalTests++;
        const usersWithoutRoles = (allUsers || []).filter((user) => {
            const userRoles = user.user_roles;
            return !user.is_superadmin && (!userRoles || userRoles.length === 0);
        });
        if (usersWithoutRoles.length > 0) {
            failures.push(`${usersWithoutRoles.length} non-superadmin user(s) have no roles assigned`);
        }
        else {
            passedTests++;
        }
        // Test 5: Verify all user_roles have valid role references
        totalTests++;
        const { data: userRoles, error: userRolesError } = await supabase
            .from('user_roles')
            .select(`
        id,
        user_id,
        role_id,
        roles (id)
      `);
        if (userRolesError || !userRoles) {
            failures.push('Failed to fetch user_roles');
        }
        else {
            const orphanedUserRoles = userRoles.filter((ur) => !ur.roles);
            if (orphanedUserRoles.length > 0) {
                failures.push(`${orphanedUserRoles.length} user_role(s) reference non-existent roles`);
            }
            else {
                passedTests++;
            }
        }
        // Test 6: Verify role permissions are valid JSON structure
        totalTests++;
        if (roles) {
            const invalidPermissionRoles = roles.filter((r) => {
                if (!r.permissions)
                    return true;
                return Object.values(r.permissions).some((v) => typeof v !== 'boolean');
            });
            if (invalidPermissionRoles.length > 0) {
                failures.push(`${invalidPermissionRoles.length} role(s) have non-boolean permission values`);
            }
            else {
                passedTests++;
            }
        }
        else {
            failures.push('Cannot verify permission structure - no roles loaded');
        }
        const allPassed = failures.length === 0;
        return server_1.NextResponse.json({
            success: true,
            allPassed,
            total: totalTests,
            passed: passedTests,
            failed: totalTests - passedTests,
            failures,
            timestamp: new Date().toISOString(),
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/admin/rbac-diagnostics/test:', {}, err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
