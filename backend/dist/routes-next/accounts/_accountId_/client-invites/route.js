"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
// GET /api/accounts/[id]/client-invites - List client invitations for an account
async function GET(request, { params }) {
    try {
        const { accountId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(accountId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get user profile with roles
        const { data: userProfile } = await admin
            .from('user_profiles')
            .select(`
        *,
        user_roles!user_id(
          roles!role_id(
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'User profile not found' }, { status: 404 });
        }
        // Check MANAGE_CLIENT_INVITES permission
        const canManageInvites = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_CLIENT_INVITES, undefined, admin);
        if (!canManageInvites) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view client invitations' }, { status: 403 });
        }
        // Verify user has access to this account
        const hasAccess = await (0, access_control_server_1.hasAccountAccessServer)(supabase, user.id, accountId);
        if (!hasAccess) {
            return server_1.NextResponse.json({
                error: 'You do not have access to this account'
            }, { status: 403 });
        }
        // Query invitations directly using the API supabase client (with proper auth context)
        // instead of delegating to a service that creates its own server-side client.
        // The client_portal_invitations table has: id, account_id, email, invited_by, status, created_at, expires_at
        const { data: invitationsRaw, error: invitationsError } = await admin
            .from('client_portal_invitations')
            .select(`
        *,
        invited_by_user:user_profiles (
          name,
          email
        )
      `)
            .eq('account_id', accountId)
            .order('created_at', { ascending: false });
        if (invitationsError) {
            debug_logger_1.logger.error('Error fetching invitations', {}, invitationsError);
            // If the table doesn't exist, return empty array gracefully
            if (invitationsError.code === 'PGRST116' || invitationsError.code === '42P01' || invitationsError.message?.includes('does not exist')) {
                return server_1.NextResponse.json({ success: true, invitations: [] }, { status: 200 });
            }
            return server_1.NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
        }
        // Map the data to match the frontend's expected format
        // DB columns: id, account_id, email, invited_by, status, created_at, expires_at
        // Frontend expects: id, email, status, created_at, expires_at, accepted_at, invited_by_user
        const invitations = (invitationsRaw || []).map((inv) => ({
            id: inv.id,
            email: inv.email,
            status: inv.status,
            created_at: inv.created_at,
            expires_at: inv.expires_at,
            accepted_at: inv.accepted_at || null,
            invited_by_user: inv.invited_by_user || null,
        }));
        return server_1.NextResponse.json({ success: true, invitations }, { status: 200 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/accounts/[id]/client-invites', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
