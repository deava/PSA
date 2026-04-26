"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const validation_schemas_1 = require("@/lib/validation-schemas");
const debug_logger_1 = require("@/lib/debug-logger");
const config_1 = require("@/lib/config");
/**
 * GET /api/accounts - List all accounts user has access to
 */
async function GET(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select(`*, user_roles!user_id(roles!role_id(id, name, permissions, department_id))`)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        const canViewAccounts = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ACCOUNTS, undefined, admin);
        if (!canViewAccounts) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view accounts' }, { status: 403 });
        }
        const { data: accounts, error } = await admin
            .from('accounts')
            .select('*')
            .order('name');
        if (error) {
            debug_logger_1.logger.error('Failed to fetch accounts', { action: 'list_accounts' }, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true, accounts }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/accounts', { action: 'list_accounts' }, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/accounts - Create a new account
 */
async function POST(request) {
    try {
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            debug_logger_1.logger.warn('Unauthorized account creation attempt', { action: 'create_account' });
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin) {
            debug_logger_1.logger.error('Failed to create Supabase client', { action: 'create_account' });
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select(`*, user_roles!user_id(roles!role_id(id, name, permissions, department_id))`)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            debug_logger_1.logger.error('User profile not found', { action: 'create_account', userId: user.id });
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        const canManageAccounts = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_ACCOUNTS, undefined, admin);
        if (!canManageAccounts) {
            debug_logger_1.logger.warn('Insufficient permissions to create account', { action: 'create_account', userId: user.id });
            return server_1.NextResponse.json({ error: 'Insufficient permissions to create accounts' }, { status: 403 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.createAccountSchema, body);
        if (!validation.success) {
            debug_logger_1.logger.warn('Invalid account creation data', { action: 'create_account', userId: user.id, error: validation.error });
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        const { data: account, error } = await admin
            .from('accounts')
            .insert({
            name: validation.data.name,
            description: validation.data.description || null,
            primary_contact_name: validation.data.primary_contact_name || null,
            primary_contact_email: validation.data.primary_contact_email || null,
            status: validation.data.status || 'active',
            account_manager_id: validation.data.account_manager_id || user.id,
            created_at: new Date().toISOString()
        })
            .select()
            .single();
        if (error) {
            if (error.code === '23505') {
                return server_1.NextResponse.json({ error: 'An account with this name already exists' }, { status: 409 });
            }
            debug_logger_1.logger.error('Failed to create account in database', { action: 'create_account', userId: user.id }, error);
            return server_1.NextResponse.json({
                error: 'Failed to create account',
                ...(config_1.config.errors.exposeDetails && { details: error.message })
            }, { status: 500 });
        }
        debug_logger_1.logger.info('Account created successfully', { action: 'create_account', userId: user.id, accountId: account.id });
        return server_1.NextResponse.json({ success: true, account }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/accounts', { action: 'create_account' }, error);
        return server_1.NextResponse.json({
            error: 'Internal server error',
            ...(config_1.config.errors.exposeDetails && { details: error.message })
        }, { status: 500 });
    }
}
