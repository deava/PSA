"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = PUT;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * PUT /api/projects/[projectId]/updates/[updateId]
 * Update a project update
 */
async function PUT(request, { params }) {
    try {
        const { projectId, updateId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId) || !(0, validation_helpers_1.isValidUUID)(updateId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get user profile
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
        // Check project access - if user has access to the project, they can edit updates
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to edit updates' }, { status: 403 });
        }
        const body = await request.json();
        const { content } = body;
        if (!content?.trim()) {
            return server_1.NextResponse.json({ error: 'Update content cannot be empty' }, { status: 400 });
        }
        // Only the creator can edit their update (or superadmin via RLS)
        const { data: update, error } = await admin
            .from('project_updates')
            .update({
            content: content.trim(),
            updated_at: new Date().toISOString()
        })
            .eq('id', updateId)
            .eq('project_id', projectId)
            .eq('created_by', user.id)
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating update:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to update update' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true, update });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PUT /api/projects/[projectId]/updates/[updateId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/projects/[projectId]/updates/[updateId]
 * Delete a project update
 */
async function DELETE(request, { params }) {
    try {
        const { projectId, updateId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId) || !(0, validation_helpers_1.isValidUUID)(updateId)) {
            return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
        }
        const user = await (0, supabase_server_1.getUserFromRequest)(request);
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const admin = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!admin)
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        // Get user profile
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
        // Check project access - if user has access to the project, they can delete updates
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to delete updates' }, { status: 403 });
        }
        // Only the creator can delete their update (or superadmin via RLS)
        const { error } = await admin
            .from('project_updates')
            .delete()
            .eq('id', updateId)
            .eq('project_id', projectId)
            .eq('created_by', user.id);
        if (error) {
            debug_logger_1.logger.error('Error deleting update:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to delete update' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/projects/[projectId]/updates/[updateId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
