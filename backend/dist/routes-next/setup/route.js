"use strict";
/**
 * First-Time Setup API
 *
 * This endpoint allows the first superadmin to be created when:
 * 1. No superadmins exist in the database
 * 2. The correct SETUP_SECRET is provided
 * 3. The user is authenticated
 *
 * Security:
 * - Only works when zero superadmins exist
 * - Requires matching SETUP_SECRET env var
 * - Automatically disabled after first superadmin
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const debug_logger_1 = require("@/lib/debug-logger");
// GET - Check if setup is available
async function GET(request) {
    try {
        const supabase = createApiSupabaseClient(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Check if any superadmins exist
        const { data: superadmins, error: countError } = await admin
            .from('user_profiles')
            .select('id')
            .eq('is_superadmin', true)
            .limit(1);
        if (countError) {
            debug_logger_1.logger.error('Error checking superadmins', {}, countError);
            return server_1.NextResponse.json({ error: 'Failed to check setup status' }, { status: 500 });
        }
        const hasSuperadmin = superadmins && superadmins.length > 0;
        const setupSecretConfigured = !!process.env.SETUP_SECRET;
        // Only expose whether setup is available, not internal details
        return server_1.NextResponse.json({
            setupAvailable: !hasSuperadmin && setupSecretConfigured,
            message: !hasSuperadmin && setupSecretConfigured
                ? 'Setup available. Provide the correct secret key to become superadmin.'
                : 'Setup is not available.'
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/setup', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
// POST - Promote current user to superadmin
async function POST(request) {
    try {
        const supabase = createApiSupabaseClient(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        // Get the setup secret from request body
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { setupSecret } = body;
        // Validate setup secret
        const expectedSecret = process.env.SETUP_SECRET;
        if (!expectedSecret) {
            return server_1.NextResponse.json({
                error: 'SETUP_SECRET environment variable not configured. Add it to your environment variables.'
            }, { status: 400 });
        }
        if (!setupSecret || setupSecret !== expectedSecret) {
            return server_1.NextResponse.json({
                error: 'Invalid setup secret. Check your SETUP_SECRET environment variable.'
            }, { status: 401 });
        }
        // Check if any superadmins already exist
        const { data: existingSuperadmins, error: checkError } = await admin
            .from('user_profiles')
            .select('id, email')
            .eq('is_superadmin', true)
            .limit(1);
        if (checkError) {
            debug_logger_1.logger.error('Error checking existing superadmins', {}, checkError);
            return server_1.NextResponse.json({ error: 'Failed to check existing superadmins' }, { status: 500 });
        }
        if (existingSuperadmins && existingSuperadmins.length > 0) {
            return server_1.NextResponse.json({
                error: 'Setup already completed. A superadmin already exists.'
            }, { status: 400 });
        }
        // Get current authenticated user
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (authError || !user) {
            return server_1.NextResponse.json({
                error: 'You must be logged in to complete setup. Please sign up first.'
            }, { status: 401 });
        }
        // Check if user profile exists
        const { data: profile, error: profileError } = await admin
            .from('user_profiles')
            .select('id, email, name')
            .eq('id', user.id)
            .single();
        if (profileError || !profile) {
            return server_1.NextResponse.json({
                error: 'User profile not found. Please ensure you have signed up.'
            }, { status: 404 });
        }
        // Promote user to superadmin
        const { error: updateError } = await admin
            .from('user_profiles')
            .update({ is_superadmin: true })
            .eq('id', user.id);
        if (updateError) {
            debug_logger_1.logger.error('Error promoting to superadmin', {}, updateError);
            return server_1.NextResponse.json({ error: 'Failed to promote to superadmin' }, { status: 500 });
        }
        // Also assign the Superadmin role if it exists
        const { data: superadminRole } = await admin
            .from('roles')
            .select('id')
            .eq('name', 'Superadmin')
            .single();
        if (superadminRole) {
            // Check if user already has this role
            const { data: existingRole } = await admin
                .from('user_roles')
                .select('id')
                .eq('user_id', user.id)
                .eq('role_id', superadminRole.id)
                .single();
            if (!existingRole) {
                await admin
                    .from('user_roles')
                    .insert({
                    user_id: user.id,
                    role_id: superadminRole.id,
                    assigned_by: user.id
                });
            }
        }
        debug_logger_1.logger.info(`User ${profile.email} promoted to superadmin`, { userId: profile.id });
        return server_1.NextResponse.json({
            success: true,
            message: `Congratulations! ${profile.name || profile.email} is now a superadmin.`,
            user: {
                id: profile.id,
                email: profile.email,
                name: profile.name
            }
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/setup', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
