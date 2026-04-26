"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const crypto_1 = __importDefault(require("crypto"));
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const mailer_1 = require("@/lib/email/mailer");
const invitation_1 = require("@/lib/email/templates/invitation");
const debug_logger_1 = require("@/lib/debug-logger");
// POST - Resend an invitation email with a fresh token
async function POST(request, { params }) {
    try {
        const { id } = await params;
        // Auth + permission check
        const user = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        await (0, server_guards_1.requirePermission)(user, permissions_1.Permission.MANAGE_USER_ROLES, {}, admin);
        // Use admin client to bypass RLS
        const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!adminSupabase) {
            return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        // Fetch the invitation
        const { data: invitation, error: fetchError } = await adminSupabase
            .from('user_invitations')
            .select('*, roles:role_id(id, name, department_id, departments:department_id(id, name))')
            .eq('id', id)
            .single();
        if (fetchError || !invitation) {
            debug_logger_1.logger.error('Invitation not found for resend', { invitationId: id, error: fetchError?.message });
            return server_1.NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        if (invitation.status !== 'pending') {
            return server_1.NextResponse.json({ error: `Cannot resend an invitation with status "${invitation.status}". Only pending invitations can be resent.` }, { status: 400 });
        }
        // Generate a new token and extend expiration
        const newToken = crypto_1.default.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // Update the invitation with new token and expiration
        const { error: updateError } = await adminSupabase
            .from('user_invitations')
            .update({
            token: newToken,
            expires_at: expiresAt.toISOString(),
        })
            .eq('id', id);
        if (updateError) {
            debug_logger_1.logger.error('Failed to update invitation for resend', { error: updateError.message, invitationId: id });
            return server_1.NextResponse.json({ error: 'Failed to update invitation' }, { status: 500 });
        }
        // Build accept URL from the incoming request
        const proto = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const appUrl = `${proto}://${host}`;
        const acceptUrl = `${appUrl}/invite/${newToken}`;
        // Get role and department names
        const role = invitation.roles;
        const roleName = role?.name || 'Team Member';
        const deptName = role?.departments?.name || undefined;
        // Send the invitation email
        const emailContent = (0, invitation_1.invitationEmailTemplate)({
            recipientName: invitation.name,
            inviterName: user.name || user.email || 'An administrator',
            roleName,
            departmentName: deptName,
            acceptUrl,
            expiresIn: '7 days',
        });
        const emailResult = await (0, mailer_1.sendEmail)({
            to: invitation.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        });
        if (!emailResult.success) {
            debug_logger_1.logger.error('Failed to resend invitation email', { error: emailResult.error, invitationId: id });
            return server_1.NextResponse.json({ error: 'Invitation updated but email failed to send' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            emailSent: true,
        });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
