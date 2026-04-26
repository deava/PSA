"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/org-structure/departments - Get all departments
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Permission check: requires VIEW_DEPARTMENTS, VIEW_ALL_DEPARTMENTS, or MANAGE_WORKFLOWS
        const canView = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_DEPARTMENTS, undefined, admin);
        const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_DEPARTMENTS, undefined, admin);
        const canManageWorkflows = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!canView && !canViewAll && !canManageWorkflows) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view departments' }, { status: 403 });
        }
        // Get all departments
        const { data: departments, error } = await supabase
            .from('departments')
            .select('id, name')
            .order('name');
        if (error) {
            debug_logger_1.logger.error('Error fetching departments', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch departments' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true, departments: departments || [] }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/org-structure/departments', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
