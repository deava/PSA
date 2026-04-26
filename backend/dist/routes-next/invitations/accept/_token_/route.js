"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const mailer_1 = require("@/lib/email/mailer");
const welcome_1 = require("@/lib/email/templates/welcome");
const debug_logger_1 = require("@/lib/debug-logger");
// GET - Get invitation details (public, no auth required)
async function GET(_request, { params }) {
    try {
        const { token } = await params;
        if (!token || typeof token !== 'string') {
            return server_1.NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
        }
        const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!adminSupabase) {
            return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        // Look up invitation by token with joined data
        const { data: invitation, error } = await adminSupabase
            .from('user_invitations')
            .select(`
        id,
        email,
        name,
        status,
        expires_at,
        role_id,
        department_id,
        roles:role_id(id, name),
        departments:department_id(id, name),
        inviter:invited_by(id, name, email)
      `)
            .eq('token', token)
            .single();
        if (error || !invitation) {
            return server_1.NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        // Check if invitation is still pending
        if (invitation.status !== 'pending') {
            return server_1.NextResponse.json({ error: `This invitation has already been ${invitation.status}` }, { status: 410 });
        }
        // Check if invitation has expired
        if (new Date(invitation.expires_at) < new Date()) {
            // Update status to expired
            await adminSupabase
                .from('user_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);
            return server_1.NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
        }
        // Return safe invitation details (no token or internal IDs)
        return server_1.NextResponse.json({
            invitation: {
                email: invitation.email,
                name: invitation.name,
                roleName: invitation.roles?.name || 'Unknown Role',
                departmentName: invitation.departments?.name || null,
                inviterName: invitation.inviter?.name || invitation.inviter?.email || 'An administrator',
            },
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error fetching invitation details', {}, error);
        return server_1.NextResponse.json({ error: 'Failed to load invitation' }, { status: 500 });
    }
}
// POST - Accept invitation and create account
async function POST(request, { params }) {
    try {
        const { token } = await params;
        if (!token || typeof token !== 'string') {
            return server_1.NextResponse.json({ error: 'Invalid invitation link' }, { status: 400 });
        }
        const body = await request.json();
        const { password } = body;
        // Validate password
        if (!password || typeof password !== 'string' || password.length < 8) {
            return server_1.NextResponse.json({ error: 'Password must be at least 8 characters long' }, { status: 400 });
        }
        const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!adminSupabase) {
            return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        // Look up invitation
        const { data: invitation, error: inviteError } = await adminSupabase
            .from('user_invitations')
            .select(`
        *,
        roles:role_id(id, name),
        departments:department_id(id, name)
      `)
            .eq('token', token)
            .single();
        if (inviteError || !invitation) {
            return server_1.NextResponse.json({ error: 'Invitation not found' }, { status: 404 });
        }
        // Check status
        if (invitation.status !== 'pending') {
            return server_1.NextResponse.json({ error: `This invitation has already been ${invitation.status}` }, { status: 410 });
        }
        // Check expiration
        if (new Date(invitation.expires_at) < new Date()) {
            await adminSupabase
                .from('user_invitations')
                .update({ status: 'expired' })
                .eq('id', invitation.id);
            return server_1.NextResponse.json({ error: 'This invitation has expired' }, { status: 410 });
        }
        // 1. Create auth user
        const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
            email: invitation.email,
            password,
            email_confirm: true,
            user_metadata: {
                name: invitation.name,
            },
        });
        if (authError) {
            debug_logger_1.logger.error('Failed to create auth user', { error: authError.message });
            if (authError.message?.includes('already been registered') || authError.message?.includes('already exists')) {
                return server_1.NextResponse.json({ error: 'An account with this email already exists. Please log in instead.' }, { status: 409 });
            }
            return server_1.NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
        }
        const userId = authData.user.id;
        // 2. Upsert user profile
        const { error: profileError } = await adminSupabase
            .from('user_profiles')
            .upsert({
            id: userId,
            email: invitation.email,
            name: invitation.name,
            has_completed_onboarding: false,
            invited_by: invitation.invited_by,
            invitation_id: invitation.id,
        }, { onConflict: 'id' });
        if (profileError) {
            debug_logger_1.logger.error('Failed to create user profile', { error: profileError.message, userId });
            // Attempt cleanup of auth user on failure
            await adminSupabase.auth.admin.deleteUser(userId);
            return server_1.NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 });
        }
        // 3. Assign role
        const { error: roleError } = await adminSupabase
            .from('user_roles')
            .insert({
            user_id: userId,
            role_id: invitation.role_id,
            assigned_by: invitation.invited_by,
        });
        if (roleError) {
            debug_logger_1.logger.error('Failed to assign role', { error: roleError.message, userId, roleId: invitation.role_id });
            // Non-fatal: user can be assigned role later by admin
        }
        // 4. Update invitation status
        const { error: updateError } = await adminSupabase
            .from('user_invitations')
            .update({
            status: 'accepted',
            accepted_at: new Date().toISOString(),
        })
            .eq('id', invitation.id);
        if (updateError) {
            debug_logger_1.logger.error('Failed to update invitation status', { error: updateError.message, invitationId: invitation.id });
        }
        // 5. Create onboarding state
        const { error: onboardingError } = await adminSupabase
            .from('onboarding_state')
            .insert({
            user_id: userId,
            tutorial_completed: false,
            tutorial_step: 0,
            tutorial_data: {},
        });
        if (onboardingError) {
            debug_logger_1.logger.error('Failed to create onboarding state', { error: onboardingError.message, userId });
            // Non-fatal: onboarding state can be created later
        }
        // 6. Send welcome email (auto-detect domain from request)
        const proto = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const appUrl = `${proto}://${host}`;
        const roleName = invitation.roles?.name || 'Team Member';
        const emailContent = (0, welcome_1.welcomeEmailTemplate)({
            userName: invitation.name,
            roleName,
            loginUrl: `${appUrl}/login`,
        });
        const emailResult = await (0, mailer_1.sendEmail)({
            to: invitation.email,
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        });
        if (!emailResult.success) {
            debug_logger_1.logger.error('Failed to send welcome email', { error: emailResult.error });
        }
        return server_1.NextResponse.json({
            success: true,
            message: 'Account created successfully',
            loginUrl: `${appUrl}/login`,
        }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error accepting invitation', {}, error);
        return server_1.NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }
}
