"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
async function GET(request, { params }) {
    try {
        const { roleId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(roleId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_USER_ROLES, {}, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Fetch users assigned to this role
        const { data, error } = await supabase
            .from('user_roles')
            .select(`
        user_id,
        user_profiles:user_id (
          id,
          name,
          email,
          image
        )
      `)
            .eq('role_id', roleId);
        if (error) {
            debug_logger_1.logger.error('Error fetching role users', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }
        // Extract user profiles from the join
        const users = data?.map((item) => item.user_profiles).filter(Boolean) || [];
        return server_1.NextResponse.json(users);
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
