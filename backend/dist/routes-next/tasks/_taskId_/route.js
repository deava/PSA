"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PUT = PUT;
exports.PATCH = PATCH;
exports.DELETE = DELETE;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const api_demo_guard_1 = require("@/lib/api-demo-guard");
const debug_logger_1 = require("@/lib/debug-logger");
const validation_helpers_1 = require("@/lib/validation-helpers");
const zod_1 = require("zod");
const updateTaskSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Task name is required').max(500).optional(),
    description: zod_1.z.string().max(5000).optional().nullable(),
    status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    start_date: zod_1.z.string().optional().nullable(),
    due_date: zod_1.z.string().optional().nullable(),
    estimated_hours: zod_1.z.number().min(0).max(10000).optional().nullable(),
    actual_hours: zod_1.z.number().min(0).max(10000).optional().nullable(),
    remaining_hours: zod_1.z.number().min(0).max(10000).optional().nullable(),
    assigned_to: zod_1.z.string().uuid().optional().nullable(),
    display_order: zod_1.z.number().min(0).optional(),
}).refine((data) => {
    if (data.start_date && data.due_date) {
        return data.due_date >= data.start_date;
    }
    return true;
}, { message: 'Due date cannot be before start date', path: ['due_date'] });
// Helper function to get task's project info
async function getTaskProject(supabase, taskId) {
    const { data: task } = await admin
        .from('tasks')
        .select('project_id, projects!inner(status)')
        .eq('id', taskId)
        .single();
    if (!task?.project_id)
        return null;
    const projects = task.projects;
    const projectData = Array.isArray(projects) ? projects[0] : projects;
    return {
        project_id: task.project_id,
        status: projectData?.status || 'unknown'
    };
}
// PUT /api/tasks/[taskId] - Update a task
// NOTE: Task permissions are now inherited from project access
async function PUT(request, { params }) {
    const { taskId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(taskId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: { user } } = await admin.auth.getUser();
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
        // Get the task's project to check access
        const taskProject = await getTaskProject(supabase, taskId);
        if (!taskProject) {
            return server_1.NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, taskProject.project_id, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
        }
        // Check if project is completed (read-only mode)
        if (taskProject.status === 'complete') {
            return server_1.NextResponse.json({
                error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
            }, { status: 400 });
        }
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate input with Zod
        const parseResult = updateTaskSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            return server_1.NextResponse.json({ error: `${firstError.path.join('.')}: ${firstError.message}` }, { status: 400 });
        }
        const body = parseResult.data;
        const updateData = {
            id: taskId,
            ...(body.name !== undefined && { name: body.name }),
            ...(body.description !== undefined && { description: body.description }),
            ...(body.status !== undefined && { status: body.status }),
            ...(body.priority !== undefined && { priority: body.priority }),
            ...(body.start_date !== undefined && { start_date: body.start_date }),
            ...(body.due_date !== undefined && { due_date: body.due_date }),
            ...(body.estimated_hours !== undefined && { estimated_hours: body.estimated_hours }),
            ...(body.actual_hours !== undefined && { actual_hours: body.actual_hours }),
            ...(body.remaining_hours !== undefined && { remaining_hours: body.remaining_hours }),
            ...(body.assigned_to !== undefined && { assigned_to: body.assigned_to })
        };
        // Use authenticated supabase client directly (not taskServiceDB which uses browser client)
        const { id, ...fieldsToUpdate } = updateData;
        const { data: task, error: updateError } = await admin
            .from('tasks')
            .update({ ...fieldsToUpdate, updated_at: new Date().toISOString() })
            .eq('id', taskId)
            .select()
            .single();
        if (updateError) {
            if (updateError.code === 'PGRST116') {
                return server_1.NextResponse.json({ error: 'Task not found' }, { status: 404 });
            }
            debug_logger_1.logger.error('Failed to update task:', { taskId, userId: user.id }, updateError);
            return server_1.NextResponse.json({
                error: 'Failed to update task. You may not have permission to modify this task.'
            }, { status: 403 });
        }
        return server_1.NextResponse.json({ success: true, task });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in PUT /api/tasks/[taskId]:', {}, err);
        return server_1.NextResponse.json({
            error: 'Failed to update task'
        }, { status: 500 });
    }
}
// PATCH /api/tasks/[taskId] - Partially update a task (e.g., status change from Kanban)
async function PATCH(request, { params }) {
    const { taskId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(taskId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: { user } } = await admin.auth.getUser();
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
        // Get the task's project to check access
        const taskProject = await getTaskProject(supabase, taskId);
        if (!taskProject) {
            return server_1.NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, taskProject.project_id, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
        }
        // Check if project is completed (read-only mode)
        if (taskProject.status === 'complete') {
            return server_1.NextResponse.json({
                error: 'Cannot modify tasks in a completed project. The project is in read-only mode.'
            }, { status: 400 });
        }
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate input with Zod
        const parseResult = updateTaskSchema.safeParse(rawBody);
        if (!parseResult.success) {
            const firstError = parseResult.error.issues[0];
            return server_1.NextResponse.json({ error: `${firstError.path.join('.')}: ${firstError.message}` }, { status: 400 });
        }
        const body = parseResult.data;
        // Build update object with only provided fields
        const updateFields = {};
        if (body.status !== undefined)
            updateFields.status = body.status;
        if (body.name !== undefined)
            updateFields.name = body.name;
        if (body.description !== undefined)
            updateFields.description = body.description;
        if (body.priority !== undefined)
            updateFields.priority = body.priority;
        if (body.start_date !== undefined)
            updateFields.start_date = body.start_date;
        if (body.due_date !== undefined)
            updateFields.due_date = body.due_date;
        if (body.estimated_hours !== undefined)
            updateFields.estimated_hours = body.estimated_hours;
        if (body.actual_hours !== undefined)
            updateFields.actual_hours = body.actual_hours;
        if (body.remaining_hours !== undefined)
            updateFields.remaining_hours = body.remaining_hours;
        if (body.assigned_to !== undefined)
            updateFields.assigned_to = body.assigned_to;
        if (body.display_order !== undefined)
            updateFields.display_order = body.display_order;
        if (Object.keys(updateFields).length === 0) {
            return server_1.NextResponse.json({ error: 'No fields to update' }, { status: 400 });
        }
        // Update the task directly with Supabase
        const { data: task, error: updateError } = await admin
            .from('tasks')
            .update(updateFields)
            .eq('id', taskId)
            .select(`
        *,
        created_by_user:user_profiles!created_by(id, name, email),
        assigned_to_user:user_profiles!assigned_to(id, name, email),
        project:projects(id, name)
      `)
            .single();
        if (updateError) {
            debug_logger_1.logger.error('Error updating task:', {}, updateError);
            // Check for specific error types
            if (updateError.code === 'PGRST116') {
                return server_1.NextResponse.json({ error: 'Task not found' }, { status: 404 });
            }
            if (updateError.code === '42501' || updateError.message?.includes('permission')) {
                return server_1.NextResponse.json({
                    error: 'You do not have permission to update this task'
                }, { status: 403 });
            }
            // Check for foreign key violation (e.g., invalid assignee ID)
            if (updateError.code === '23503') {
                return server_1.NextResponse.json({
                    error: 'Invalid assignee. The selected user does not exist.'
                }, { status: 400 });
            }
            return server_1.NextResponse.json({
                error: 'Failed to update task'
            }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true, task });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in PATCH /api/tasks/[taskId]:', {}, err);
        return server_1.NextResponse.json({
            error: 'Failed to update task'
        }, { status: 500 });
    }
}
// DELETE /api/tasks/[taskId] - Delete a task
// NOTE: Task permissions are now inherited from project access
async function DELETE(request, { params }) {
    const { taskId } = await params;
    if (!(0, validation_helpers_1.isValidUUID)(taskId)) {
        return server_1.NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }
    try {
        // Block in demo mode
        const blocked = (0, api_demo_guard_1.checkDemoModeForDestructiveAction)('delete_task');
        if (blocked)
            return blocked;
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
        }
        const { data: { user } } = await admin.auth.getUser();
        if (!user) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
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
        // Get the task's project to check access
        const taskProject = await getTaskProject(supabase, taskId);
        if (!taskProject) {
            return server_1.NextResponse.json({ error: 'Task not found' }, { status: 404 });
        }
        const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, taskProject.project_id, admin);
        if (!hasAccess) {
            return server_1.NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
        }
        // Check if project is completed (read-only mode)
        if (taskProject.status === 'complete') {
            return server_1.NextResponse.json({
                error: 'Cannot delete tasks in a completed project. The project is in read-only mode.'
            }, { status: 400 });
        }
        // Use authenticated supabase client directly (not taskServiceDB which uses browser client)
        const { error: deleteError } = await admin
            .from('tasks')
            .delete()
            .eq('id', taskId);
        if (deleteError) {
            debug_logger_1.logger.error('Failed to delete task:', { taskId }, deleteError);
            return server_1.NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
        }
        return server_1.NextResponse.json({ success: true });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in DELETE /api/tasks/[taskId]:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
