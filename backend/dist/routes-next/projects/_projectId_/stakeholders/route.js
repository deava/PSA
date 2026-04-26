"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
// Type definitions
async function GET(request, { params }) {
    try {
        // Await params (Next.js 15 requirement)
        const { projectId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Check authentication and permission
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.VIEW_PROJECTS, { projectId }, request);
        // Use API Supabase client (not createServerSupabase which crashes in API routes)
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Fetch stakeholders - specify the relationship to avoid ambiguity
        const { data, error } = await supabase
            .from('project_stakeholders')
            .select(`
        id,
        user_id,
        role,
        user_profiles:user_profiles(
          id,
          name,
          email,
          image
        )
      `)
            .eq('project_id', projectId);
        if (error) {
            debug_logger_1.logger.error('Error fetching stakeholders', { action: 'getStakeholders', projectId }, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch stakeholders' }, { status: 500 });
        }
        return server_1.NextResponse.json({ stakeholders: data || [] });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
