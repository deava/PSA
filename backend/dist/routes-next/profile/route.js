"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PATCH = PATCH;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const server_guards_1 = require("@/lib/server-guards");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/profile
 * Get current user's profile
 * All authenticated users can view their own profile, regardless of role
 */
async function GET(request) {
    try {
        // Check authentication only - all users should be able to view their own profile
        const userProfile = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'getProfile' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        // Fetch user profile (include client-specific fields)
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select('id, name, email, bio, skills, image, is_client, client_account_id, client_contact_name, client_company_position, created_at, updated_at')
            .eq('id', userProfile.id)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error fetching profile', { action: 'getProfile', userId: userProfile.id }, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
        }
        return server_1.NextResponse.json({ profile });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
/**
 * PATCH /api/profile
 * Update current user's profile
 * All authenticated users can edit their own profile, regardless of role
 */
async function PATCH(request) {
    try {
        // Check authentication only - all users should be able to edit their own profile
        const userProfile = await (0, server_guards_1.requireAuthentication)(request);
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            debug_logger_1.logger.error('Supabase not configured', { action: 'updateProfile' });
            return server_1.NextResponse.json({ error: 'Supabase not configured' }, { status: 500 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { name, bio, skills, client_company_position } = body;
        // Validate that user can only update their own profile
        if (body.id && body.id !== userProfile.id) {
            debug_logger_1.logger.warn('User attempted to update another user\'s profile', {
                action: 'updateProfile',
                userId: userProfile.id,
                attemptedId: body.id
            });
            return server_1.NextResponse.json({ error: 'You can only update your own profile' }, { status: 403 });
        }
        // Input validation
        if (name !== undefined) {
            if (typeof name !== 'string' || name.trim().length === 0) {
                return server_1.NextResponse.json({ error: 'Name must be a non-empty string' }, { status: 400 });
            }
            if (name.length > 200) {
                return server_1.NextResponse.json({ error: 'Name must be 200 characters or less' }, { status: 400 });
            }
        }
        if (bio !== undefined && bio !== null) {
            if (typeof bio !== 'string') {
                return server_1.NextResponse.json({ error: 'Bio must be a string' }, { status: 400 });
            }
            if (bio.length > 2000) {
                return server_1.NextResponse.json({ error: 'Bio must be 2000 characters or less' }, { status: 400 });
            }
        }
        if (skills !== undefined && skills !== null) {
            if (!Array.isArray(skills) || !skills.every((s) => typeof s === 'string')) {
                return server_1.NextResponse.json({ error: 'Skills must be an array of strings' }, { status: 400 });
            }
            if (skills.length > 50) {
                return server_1.NextResponse.json({ error: 'Maximum 50 skills allowed' }, { status: 400 });
            }
        }
        if (client_company_position !== undefined && client_company_position !== null) {
            if (typeof client_company_position !== 'string') {
                return server_1.NextResponse.json({ error: 'Company position must be a string' }, { status: 400 });
            }
            if (client_company_position.length > 200) {
                return server_1.NextResponse.json({ error: 'Company position must be 200 characters or less' }, { status: 400 });
            }
        }
        // Prepare update data (only whitelisted fields)
        const updateData = {
            updated_at: new Date().toISOString()
        };
        if (name !== undefined)
            updateData.name = name.trim();
        if (bio !== undefined)
            updateData.bio = bio;
        if (skills !== undefined)
            updateData.skills = skills;
        if (client_company_position !== undefined)
            updateData.client_company_position = client_company_position;
        debug_logger_1.logger.info('Updating user profile', {
            action: 'updateProfile',
            userId: userProfile.id,
            fields: Object.keys(updateData)
        });
        // Update the profile
        const { data: updatedProfile, error } = await supabase
            .from('user_profiles')
            .update(updateData)
            .eq('id', userProfile.id)
            .select('id, name, email, bio, skills, image, is_client, client_account_id, client_contact_name, client_company_position, created_at, updated_at')
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating profile', { action: 'updateProfile', userId: userProfile.id }, error);
            return server_1.NextResponse.json({ error: 'Failed to update profile' }, { status: 500 });
        }
        debug_logger_1.logger.info('Profile updated successfully', {
            action: 'updateProfile',
            userId: userProfile.id
        });
        return server_1.NextResponse.json({ profile: updatedProfile });
    }
    catch (error) {
        return (0, server_guards_1.handleGuardError)(error);
    }
}
