"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const debug_logger_1 = require("@/lib/debug-logger");
// GET /api/org-structure/roles - Get all roles with user counts
async function GET(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get all roles with department info and user count
        const { data: roles, error } = await admin
            .from('roles')
            .select(`
        id,
        name,
        department_id,
        user_roles!user_id(count)
      `)
            .order('name');
        if (error) {
            debug_logger_1.logger.error('Error fetching roles', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch roles' }, { status: 500 });
        }
        // Transform to include user_count as a simple number
        const rolesWithCounts = (roles || []).map((role) => ({
            id: role.id,
            name: role.name,
            department_id: role.department_id,
            user_count: role.user_roles?.[0]?.count || 0
        }));
        return server_1.NextResponse.json({ success: true, roles: rolesWithCounts }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/org-structure/roles', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
