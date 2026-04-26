"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PUT = PUT;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * GET /api/accounts/[accountId]/kanban-config
 * Get Kanban configuration for an account
 * NOTE: Kanban/Gantt for projects is deprecated (workflows replace it), but visual display still works
 */
async function GET(request, { params }) {
    try {
        const { accountId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Require VIEW_PROJECTS permission (kanban view permissions are deprecated)
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.VIEW_PROJECTS, { accountId }, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
        }
        const { data: config, error } = await supabase
            .from('account_kanban_configs')
            .select('*')
            .eq('account_id', accountId)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No config found, return null (client will use defaults)
                return server_1.NextResponse.json({ config: null });
            }
            debug_logger_1.logger.error('Error fetching kanban config', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch kanban config' }, { status: 500 });
        }
        return server_1.NextResponse.json({ config });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/accounts/[accountId]/kanban-config', {}, error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
/**
 * PUT /api/accounts/[accountId]/kanban-config
 * Update Kanban configuration for an account
 */
async function PUT(request, { params }) {
    try {
        const { accountId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Authenticate before parsing body
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_PROJECTS, { accountId }, request);
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { columns } = body;
        if (!columns || !Array.isArray(columns)) {
            return server_1.NextResponse.json({ error: 'Columns array is required' }, { status: 400 });
        }
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
        }
        // Check if config exists
        const { data: existingConfig } = await supabase
            .from('account_kanban_configs')
            .select('id')
            .eq('account_id', accountId)
            .single();
        let config;
        if (existingConfig) {
            // Update existing config
            const { data, error } = await supabase
                .from('account_kanban_configs')
                .update({
                columns,
                updated_at: new Date().toISOString()
            })
                .eq('account_id', accountId)
                .select()
                .single();
            if (error) {
                debug_logger_1.logger.error('Error updating kanban config', {}, error);
                return server_1.NextResponse.json({ error: 'Failed to update kanban config' }, { status: 500 });
            }
            config = data;
        }
        else {
            // Create new config
            const { data, error } = await supabase
                .from('account_kanban_configs')
                .insert({
                account_id: accountId,
                columns
            })
                .select()
                .single();
            if (error) {
                debug_logger_1.logger.error('Error creating kanban config', {}, error);
                return server_1.NextResponse.json({ error: 'Failed to create kanban config' }, { status: 500 });
            }
            config = data;
        }
        return server_1.NextResponse.json({ success: true, config });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PUT /api/accounts/[accountId]/kanban-config', {}, error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
