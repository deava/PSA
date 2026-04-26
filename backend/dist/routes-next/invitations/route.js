"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
exports.GET = GET;
const server_1 = require("next/server");
const crypto_1 = __importDefault(require("crypto"));
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const permissions_1 = require("@/lib/permissions");
const mailer_1 = require("@/lib/email/mailer");
const invitation_1 = require("@/lib/email/templates/invitation");
const debug_logger_1 = require("@/lib/debug-logger");
// POST - Create a new invitation and send email
async function POST(request) {
    try {
        // Auth + permission check
        const user = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        await (0, server_guards_1.requirePermission)(user, permissions_1.Permission.MANAGE_USER_ROLES, {}, admin);
        const body = await request.json();
        const { email, name, roleId, departmentId } = body;
        // Validate inputs
        if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return server_1.NextResponse.json({ error: 'A valid email address is required' }, { status: 400 });
        }
        if (!name || typeof name !== 'string' || !name.trim()) {
            return server_1.NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }
        if (!roleId || typeof roleId !== 'string') {
            return server_1.NextResponse.json({ error: 'Role ID is required' }, { status: 400 });
        }
        // Verify role exists
        const adminSupabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!adminSupabase) {
            return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }
        const { data: role, error: roleError } = await adminSupabase
            .from('roles')
            .select('id, name, department_id, departments(id, name)')
            .eq('id', roleId)
            .single();
        if (roleError || !role) {
            return server_1.NextResponse.json({ error: 'Invalid role ID' }, { status: 400 });
        }
        // Check for existing pending invitation for this email
        const { data: existingInvite } = await adminSupabase
            .from('user_invitations')
            .select('id, status')
            .eq('email', email.trim().toLowerCase())
            .eq('status', 'pending')
            .single();
        if (existingInvite) {
            return server_1.NextResponse.json({ error: 'A pending invitation already exists for this email address' }, { status: 409 });
        }
        // Check if user already exists
        const { data: existingUser } = await adminSupabase
            .from('user_profiles')
            .select('id')
            .eq('email', email.trim().toLowerCase())
            .single();
        if (existingUser) {
            return server_1.NextResponse.json({ error: 'A user with this email address already exists' }, { status: 409 });
        }
        // Generate secure token
        const token = crypto_1.default.randomBytes(32).toString('hex');
        // Set expiration to 7 days from now
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);
        // Insert invitation using admin client (service role bypasses RLS)
        const { data: invitation, error: insertError } = await adminSupabase
            .from('user_invitations')
            .insert({
            email: email.trim().toLowerCase(),
            name: name.trim(),
            role_id: roleId,
            department_id: departmentId || null,
            invited_by: user.id,
            token,
            status: 'pending',
            expires_at: expiresAt.toISOString(),
        })
            .select()
            .single();
        if (insertError) {
            debug_logger_1.logger.error('Failed to create invitation', { error: insertError.message });
            return server_1.NextResponse.json({ error: 'Failed to create invitation' }, { status: 500 });
        }
        // Build accept URL from the incoming request (auto-detects domain)
        const proto = request.headers.get('x-forwarded-proto') || 'http';
        const host = request.headers.get('host') || 'localhost:3000';
        const appUrl = `${proto}://${host}`;
        const acceptUrl = `${appUrl}/invite/${token}`;
        // Determine department name
        const deptName = departmentId
            ? (role.departments?.name || undefined)
            : undefined;
        // Send invitation email
        const emailContent = (0, invitation_1.invitationEmailTemplate)({
            recipientName: name.trim(),
            inviterName: user.name || user.email || 'An administrator',
            roleName: role.name,
            departmentName: deptName,
            acceptUrl,
            expiresIn: '7 days',
        });
        const emailResult = await (0, mailer_1.sendEmail)({
            to: email.trim().toLowerCase(),
            subject: emailContent.subject,
            html: emailContent.html,
            text: emailContent.text,
        });
        if (!emailResult.success) {
            debug_logger_1.logger.error('Failed to send invitation email', { error: emailResult.error });
            // Don't fail the request - invitation was created, email can be resent
        }
        return server_1.NextResponse.json({
            invitation,
            emailSent: emailResult.success,
        }, { status: 201 });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
// GET - List all invitations
async function GET(request) {
    try {
        // Auth + permission check
        const user = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        await (0, server_guards_1.requirePermission)(user, permissions_1.Permission.MANAGE_USER_ROLES, {}, admin);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: invitations, error } = await supabase
            .from('user_invitations')
            .select(`
        *,
        roles:role_id(id, name),
        departments:department_id(id, name),
        inviter:invited_by(id, name, email)
      `)
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Failed to fetch invitations', { error: error.message });
            return server_1.NextResponse.json({ error: 'Failed to fetch invitations' }, { status: 500 });
        }
        return server_1.NextResponse.json({ invitations: invitations || [] });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
