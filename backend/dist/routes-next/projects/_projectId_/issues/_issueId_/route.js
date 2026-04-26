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
 * PUT /api/projects/[projectId]/issues/[issueId]
 * Update an issue (content or status)
 */
async function PUT(request, { params }) {
    try {
        const { projectId, issueId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId) || !(0, validation_helpers_1.isValidUUID)(issueId)) {
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
        // Check project access - if user has access to the project, they can edit issues
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to edit issues' }, { status: 403 });
        }
        const body = await request.json();
        const { content, status } = body;
        // Build update object
        const updates = {};
        if (content !== undefined) {
            if (!content.trim()) {
                return server_1.NextResponse.json({ error: 'Issue content cannot be empty' }, { status: 400 });
            }
            updates.content = content.trim();
        }
        if (status !== undefined) {
            if (!['open', 'in_progress', 'resolved'].includes(status)) {
                return server_1.NextResponse.json({ error: 'Invalid status' }, { status: 400 });
            }
            updates.status = status;
            // Handle resolved metadata
            if (status === 'resolved') {
                updates.resolved_at = new Date().toISOString();
                updates.resolved_by = user.id;
            }
            else {
                updates.resolved_at = null;
                updates.resolved_by = null;
            }
        }
        // Update issue
        const { data: issue, error } = await admin
            .from('project_issues')
            .update(updates)
            .eq('id', issueId)
            .eq('project_id', projectId)
            .select(`
        *,
        user_profiles:created_by(id, name, email, image),
        resolver_profiles:resolved_by(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating issue:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to update issue' }, { status: 500 });
        }
        // Add user as project collaborator if not already assigned
        const { data: existingAssignment } = await admin
            .from('project_assignments')
            .select('id, removed_at')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();
        if (!existingAssignment) {
            // Insert new assignment
            await admin.from('project_assignments').insert({
                project_id: projectId,
                user_id: user.id,
                role_in_project: 'collaborator',
                assigned_by: user.id,
                source_type: 'manual'
            });
        }
        else if (existingAssignment.removed_at) {
            // Reactivate removed assignment
            await admin
                .from('project_assignments')
                .update({ removed_at: null, role_in_project: 'collaborator', source_type: 'manual' })
                .eq('id', existingAssignment.id);
        }
        return server_1.NextResponse.json({ success: true, issue });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PUT /api/projects/[projectId]/issues/[issueId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * DELETE /api/projects/[projectId]/issues/[issueId]
 * Delete an issue
 */
async function DELETE(request, { params }) {
    try {
        const { projectId, issueId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId) || !(0, validation_helpers_1.isValidUUID)(issueId)) {
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
        // Check project access - if user has access to the project, they can delete issues
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to delete issues' }, { status: 403 });
        }
        // Only the creator can delete their issue (or superadmin via RLS)
        const { error } = await admin
            .from('project_issues')
            .delete()
            .eq('id', issueId)
            .eq('project_id', projectId)
            .eq('created_by', user.id);
        if (error) {
            debug_logger_1.logger.error('Error deleting issue:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to delete issue' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/projects/[projectId]/issues/[issueId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
