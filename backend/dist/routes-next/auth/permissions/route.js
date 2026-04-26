"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const permissions_1 = require("@/lib/permissions");
const permission_checker_1 = require("@/lib/permission-checker");
const server_guards_1 = require("@/lib/server-guards");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET() {
    try {
        // Get authenticated user (doesn't throw if not authenticated)
        const userProfile = await (0, server_guards_1.getAuthenticatedUser)();
        if (!userProfile) {
            return server_1.NextResponse.json({
                can_manage_roles: false,
                can_view_roles: false,
                is_admin: false
            });
        }
        // Check actual permissions using permission checker (Phase 9: consolidated to MANAGE_USER_ROLES)
        const canManageRoles = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.MANAGE_USER_ROLES);
        const canViewRoles = canManageRoles; // Viewing is implied by MANAGE permission
        const roleNames = userProfile.user_roles?.map((ur) => {
            const roles = ur.roles;
            return roles?.name;
        }).filter(Boolean) || [];
        const isAdmin = (0, permission_checker_1.isSuperadmin)(userProfile);
        return server_1.NextResponse.json({
            can_manage_roles: canManageRoles,
            can_view_roles: canViewRoles,
            is_admin: isAdmin,
            roles: roleNames
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error checking permissions', { action: 'getPermissions' }, error);
        return server_1.NextResponse.json({
            can_manage_roles: false,
            can_view_roles: false,
            is_admin: false,
            error: 'Failed to check permissions'
        }, { status: 500 });
    }
}
