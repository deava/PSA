"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
async function GET(request) {
    try {
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USERS, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'getUsers' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Fetch all user profiles with their roles
        const { data: users, error } = await supabase
            .from('user_profiles')
            .select(`
        id,
        name,
        email,
        image,
        user_roles!user_id(
          id,
          roles!role_id(
            id,
            name,
            department_id,
            departments(
              id,
              name
            )
          )
        )
      `)
            .order('name');
        if (error) {
            debug_logger_1.logger.error('Error fetching users', { action: 'getUsers' }, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }
        return server_1.NextResponse.json({ users: users || [] });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
