"use strict";
/**
 * API Route: RBAC Diagnostics
 * Provides diagnostic information about roles, permissions, and user assignments
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check if user has permission to view RBAC diagnostics
        const canManageUsers = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_USERS, undefined, admin);
        if (!canManageUsers && !(0, rbac_1.isSuperadmin)(userProfile)) {
            return server_1.NextResponse.json({ error: 'Forbidden: Insufficient permissions to access RBAC diagnostics' }, { status: 403 });
        }
        // Fetch all users with their roles
        const { data: users, error: usersError } = await supabase
            .from('user_profiles')
            .select(`
        id,
        name,
        email,
        is_superadmin,
        user_roles!user_id(
          id,
          role_id,
          roles!role_id(
            id,
            name,
            department_id,
            permissions,
            departments (
              id,
              name
            )
          )
        )
      `)
            .order('name');
        if (usersError) {
            debug_logger_1.logger.error('Error fetching users for diagnostics:', {}, usersError);
            return server_1.NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }
        // Fetch all roles with user counts
        const { data: roles, error: rolesError } = await supabase
            .from('roles')
            .select(`
        id,
        name,
        permissions,
        department_id,
        departments (
          name
        )
      `)
            .order('name');
        if (rolesError) {
            debug_logger_1.logger.error('Error fetching roles for diagnostics:', {}, rolesError);
            return server_1.NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
        }
        // Count users per role
        const rolesWithCounts = await Promise.all((roles || []).map(async (role) => {
            const { count } = await supabase
                .from('user_roles')
                .select('*', { count: 'exact', head: true })
                .eq('role_id', role.id);
            const departments = role.departments;
            return {
                id: role.id,
                name: role.name,
                department_name: departments?.name || 'Unknown',
                permissions: role.permissions || {},
                user_count: count || 0,
            };
        }));
        return server_1.NextResponse.json({
            success: true,
            users: users || [],
            roles: rolesWithCounts,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/admin/rbac-diagnostics:', {}, err);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
