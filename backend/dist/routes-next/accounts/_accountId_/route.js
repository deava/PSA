"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PATCH = PATCH;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * PATCH /api/accounts/[accountId]
 * Update account details (admin only)
 */
async function PATCH(request, { params }) {
    try {
        const { accountId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        // Require MANAGE_ACCOUNTS permission (consolidated from EDIT_ACCOUNT)
        await (0, server_guards_1.requireAuthAndPermission)(permissions_1.Permission.MANAGE_ACCOUNTS, { accountId }, request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Supabase client not available' }, { status: 500 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate input with Zod schema
        const validation = validation_schemas_1.updateAccountSchema.safeParse(body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: 'Validation failed. Please check your input.' }, { status: 400 });
        }
        // Build update object from validated data
        const allowedUpdates = {};
        const validatedData = validation.data;
        if (validatedData.name !== undefined) {
            allowedUpdates.name = validatedData.name;
        }
        if (validatedData.description !== undefined) {
            allowedUpdates.description = validatedData.description;
        }
        if (validatedData.primary_contact_name !== undefined) {
            allowedUpdates.primary_contact_name = validatedData.primary_contact_name;
        }
        if (validatedData.primary_contact_email !== undefined) {
            allowedUpdates.primary_contact_email = validatedData.primary_contact_email;
        }
        if (validatedData.status !== undefined) {
            allowedUpdates.status = validatedData.status;
        }
        if (validatedData.account_manager_id !== undefined) {
            allowedUpdates.account_manager_id = validatedData.account_manager_id;
        }
        if (Object.keys(allowedUpdates).length === 0) {
            return server_1.NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
        }
        const { data, error } = await supabase
            .from('accounts')
            .update(allowedUpdates)
            .eq('id', accountId)
            .select()
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating account', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
        }
        return server_1.NextResponse.json({ account: data });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PATCH /api/accounts/[accountId]', {}, error);
        return (0, server_guards_1.handleGuardError)(error);
    }
}
