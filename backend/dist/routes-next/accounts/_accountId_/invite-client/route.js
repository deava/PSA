"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const client_portal_service_1 = require("@/lib/client-portal-service");
const validation_schemas_1 = require("@/lib/validation-schemas");
const access_control_server_1 = require("@/lib/access-control-server");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
const mailer_1 = require("@/lib/email/mailer");
const client_invitation_1 = require("@/lib/email/templates/client-invitation");
// POST /api/accounts/[id]/invite-client - Send client portal invitation
async function POST(request, { params }) {
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
        const canInvite = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_CLIENT_INVITES, undefined, admin);
        if (!canInvite) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to send client invitations' }, { status: 403 });
        }
        // Verify user has access to this account
        const hasAccess = await (0, access_control_server_1.hasAccountAccessServer)(supabase, user.id, accountId);
        if (!hasAccess) {
            return server_1.NextResponse.json({
                error: 'You do not have access to this account'
            }, { status: 403 });
        }
        // Validate request body
        const body = await request.json();
        const validation = (0, validation_schemas_1.validateRequestBody)(validation_schemas_1.sendClientInvitationSchema, body);
        if (!validation.success) {
            return server_1.NextResponse.json({ error: validation.error }, { status: 400 });
        }
        // Send invitation
        const invitation = await (0, client_portal_service_1.sendClientInvitation)({
            accountId: accountId,
            email: validation.data.email,
            invitedBy: user.id,
            expiresInDays: validation.data.expires_in_days
        });
        // Send invitation email
        const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/client-invite/${invitation.token}`;
        // Fetch account name for email
        const { data: account } = await admin
            .from('accounts')
            .select('name')
            .eq('id', accountId)
            .single();
        const emailResult = await (0, mailer_1.sendEmail)({
            to: invitation.email,
            subject: `You're invited to ${account?.name || 'a project'} on Worklo`,
            html: (0, client_invitation_1.clientInvitationEmailHtml)({
                accountName: account?.name || 'Your Account',
                inviteUrl,
                expiresInDays: 7,
            }),
            text: (0, client_invitation_1.clientInvitationEmailText)({
                accountName: account?.name || 'Your Account',
                inviteUrl,
                expiresInDays: 7,
            }),
        });
        if (!emailResult.success) {
            debug_logger_1.logger.warn('Failed to send client invitation email', { email: invitation.email, error: emailResult.error });
            // Don't fail the request — invitation is created, email can be resent
        }
        return server_1.NextResponse.json({ success: true, invitation }, { status: 201 });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in POST /api/accounts/[id]/invite-client', {}, err);
        if (err.message?.includes('pending invitation already exists')) {
            return server_1.NextResponse.json({ error: 'A pending invitation already exists for this email' }, { status: 409 });
        }
        if (err.message?.includes('internal user') || err.message?.includes('already exists')) {
            return server_1.NextResponse.json({ error: err.message }, { status: 400 });
        }
        return server_1.NextResponse.json({ error: 'Failed to send invitation' }, { status: 500 });
    }
}
