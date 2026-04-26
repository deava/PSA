"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
/**
 * GET /api/projects/[projectId]/updates
 * Get all updates for a project
 */
async function GET(request, { params }) {
    try {
        const { projectId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId)) {
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
        // Check project access - if user has access to the project, they can view updates
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view project updates' }, { status: 403 });
        }
        // Get updates with user info
        // Note: workflow_history relationship is optional and fetched separately if needed
        const { data: updates, error } = await admin
            .from('project_updates')
            .select(`
        id,
        project_id,
        content,
        created_by,
        workflow_history_id,
        created_at,
        updated_at,
        user_profiles:created_by(id, name, email, image)
      `)
            .eq('project_id', projectId)
            .order('created_at', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching updates:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to fetch updates' }, { status: 500 });
        }
        return server_1.NextResponse.json({ updates: updates || [] });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/projects/[projectId]/updates:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * POST /api/projects/[projectId]/updates
 * Create a new update for a project
 */
async function POST(request, { params }) {
    try {
        const { projectId } = await params;
        if (!(0, validation_helpers_1.isValidUUID)(projectId)) {
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
        // Check project access - if user has access to the project, they can create updates
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, projectId, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to create updates' }, { status: 403 });
        }
        // Check if project is completed (read-only mode)
        const { data: project } = await admin
            .from('projects')
            .select('status')
            .eq('id', projectId)
            .single();
        if (project?.status === 'complete') {
            return server_1.NextResponse.json({
                error: 'Cannot add updates to a completed project. The project is in read-only mode.'
            }, { status: 400 });
        }
        let body;
        try {
            body = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        const { content } = body;
        if (!content || !content.trim()) {
            return server_1.NextResponse.json({ error: 'Update content is required' }, { status: 400 });
        }
        if (content.length > 5000) {
            return server_1.NextResponse.json({ error: 'Update content must be 5000 characters or less' }, { status: 400 });
        }
        // Create update
        const { data: update, error } = await admin
            .from('project_updates')
            .insert({
            project_id: projectId,
            content: content.trim(),
            created_by: user.id
        })
            .select(`
        *,
        user_profiles:user_profiles(id, name, email, image)
      `)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error creating update:', {}, error);
            return server_1.NextResponse.json({ error: 'Failed to create update' }, { status: 500 });
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
        return server_1.NextResponse.json({ success: true, update }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/projects/[projectId]/updates:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
