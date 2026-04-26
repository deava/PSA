"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.PUT = PUT;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const permissions_1 = require("@/lib/permissions");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
const zod_1 = require("zod");
const updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Project name is required').max(500, 'Project name too long').optional(),
    description: zod_1.z.string().max(5000).optional().nullable(),
    status: zod_1.z.enum(['planning', 'in_progress', 'review', 'complete', 'on_hold']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    start_date: zod_1.z.string().optional().nullable(),
    end_date: zod_1.z.string().optional().nullable(),
    estimated_hours: zod_1.z.number().min(0).max(100000).optional().nullable(),
    budget: zod_1.z.number().min(0).optional().nullable(),
    assigned_user_id: zod_1.z.string().uuid().optional().nullable(),
    notes: zod_1.z.string().max(50000).optional().nullable(),
}).refine((data) => {
    if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
    }
    return true;
}, { message: 'End date cannot be before start date', path: ['end_date'] });
/**
 * GET /api/projects/[projectId]
 * Get a single project's details
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
        // Get the project
        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('*')
            .eq('id', projectId)
            .single();
        if (projectError || !project) {
            return server_1.NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        // Check if user can view this project
        // Superadmins can view all projects
        if (!(0, rbac_1.isSuperadmin)(userProfile)) {
            // Check VIEW_PROJECTS permission
            const canView = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_PROJECTS, {
                projectId,
                accountId: project.account_id
            }, admin);
            if (!canView) {
                // Also check if user is assigned to the project
                const { data: assignment } = await admin
                    .from('project_assignments')
                    .select('id')
                    .eq('user_id', user.id)
                    .eq('project_id', projectId)
                    .is('removed_at', null)
                    .single();
                if (!assignment && project.created_by !== user.id && project.assigned_user_id !== user.id) {
                    return server_1.NextResponse.json({ error: 'Insufficient permissions to view project' }, { status: 403 });
                }
            }
        }
        return server_1.NextResponse.json({ success: true, project });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/projects/[projectId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * PUT /api/projects/[projectId]
 * Update a project (used by Kanban, Gantt, Table views)
 */
async function PUT(request, { params }) {
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
        // Get the project to check permissions
        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('id, account_id, assigned_user_id')
            .eq('id', projectId)
            .single();
        if (projectError || !project) {
            return server_1.NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        // Check MANAGE_PROJECTS permission with project context (consolidated from EDIT_PROJECT)
        const canManageProjects = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_PROJECTS, {
            projectId,
            accountId: project.account_id
        }, admin);
        if (!canManageProjects) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to edit project' }, { status: 403 });
        }
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate input
        const parseResult = updateProjectSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            return server_1.NextResponse.json({ error: `${firstError.path.join('.')}: ${firstError.message}` }, { status: 400 });
        }
        const body = parseResult.data;
        // Build update object with only provided fields
        const updates = {};
        if (body.name !== undefined)
            updates.name = body.name;
        if (body.description !== undefined)
            updates.description = body.description;
        if (body.status !== undefined)
            updates.status = body.status;
        if (body.priority !== undefined)
            updates.priority = body.priority;
        if (body.start_date !== undefined)
            updates.start_date = body.start_date;
        if (body.end_date !== undefined)
            updates.end_date = body.end_date;
        if (body.estimated_hours !== undefined)
            updates.estimated_hours = body.estimated_hours;
        if (body.budget !== undefined)
            updates.budget = body.budget;
        if (body.assigned_user_id !== undefined)
            updates.assigned_user_id = body.assigned_user_id;
        if (body.notes !== undefined)
            updates.notes = body.notes;
        if (Object.keys(updates).length === 0) {
            return server_1.NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }
        // Update the project
        const { data: updatedProject, error: updateError } = await admin
            .from('projects')
            .update(updates)
            .eq('id', projectId)
            .select()
            .single();
        if (updateError) {
            debug_logger_1.logger.error('Error updating project:', {}, updateError);
            return server_1.NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
        }
        // Add user as project collaborator if they made a meaningful update (notes, description)
        if (body.notes !== undefined || body.description !== undefined) {
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
        }
        return server_1.NextResponse.json({ success: true, project: updatedProject });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in PUT /api/projects/[projectId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
/**
 * PATCH /api/projects/[projectId]
 * Partial update for a project (e.g., notes)
 */
async function PATCH(request, { params }) {
    // PATCH uses the same logic as PUT for partial updates
    return PUT(request, { params });
}
/**
 * DELETE /api/projects/[projectId]
 * Delete a project
 */
async function DELETE(request, { params }) {
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_project');
        if (blocked)
            return blocked;
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
        // Get the project to check permissions
        const { data: project, error: projectError } = await admin
            .from('projects')
            .select('id, account_id')
            .eq('id', projectId)
            .single();
        if (projectError || !project) {
            return server_1.NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }
        // Check MANAGE_PROJECTS permission with project context (consolidated from DELETE_PROJECT)
        const canManageProjects = await (0, rbac_1.hasPermission)(userProfile, permissions_1.Permission.MANAGE_PROJECTS, {
            projectId,
            accountId: project.account_id
        }, admin);
        if (!canManageProjects) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to delete project' }, { status: 403 });
        }
        // Delete the project
        const { error: deleteError } = await admin
            .from('projects')
            .delete()
            .eq('id', projectId);
        if (deleteError) {
            debug_logger_1.logger.error('Error deleting project:', {}, deleteError);
            return server_1.NextResponse.json({ error: 'Failed to delete project' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/projects/[projectId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
