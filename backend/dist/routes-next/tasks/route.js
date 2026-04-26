"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const rbac_1 = require("@/lib/rbac");
const debug_logger_1 = require("@/lib/debug-logger");
const zod_1 = require("zod");
const createTaskSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Task name is required').max(500),
    description: zod_1.z.string().max(5000).optional().nullable(),
    project_id: zod_1.z.string().uuid('Invalid project ID'),
    status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    start_date: zod_1.z.string().optional().nullable(),
    due_date: zod_1.z.string().optional().nullable(),
    estimated_hours: zod_1.z.number().min(0).max(10000).optional().nullable(),
    assigned_to: zod_1.z.string().uuid('Invalid assignee ID').optional().nullable(),
}).refine((data) => {
    if (data.start_date && data.due_date) {
        return data.due_date >= data.start_date;
    }
    return true;
}, { message: 'Due date cannot be before start date', path: ['due_date'] });
// POST /api/tasks - Create a new task
// NOTE: Task permissions are now inherited from project access
// If user has access to the project, they can create/edit/delete tasks within it
async function POST(request) {
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
        let rawBody;
        try {
            rawBody = await request.json();
        }
        catch {
            return server_1.NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
        }
        // Validate with Zod schema
        const parsed = createTaskSchema.safeParse(rawBody);
        if (!parsed.success) {
            const firstError = parsed.error.issues[0];
            return server_1.NextResponse.json({ error: firstError.message }, { status: 400 });
        }
        const body = parsed.data;
        // Task permissions are inherited from project access
        {
            const hasAccess = await (0, rbac_1.userHasProjectAccess)(userProfile, body.project_id, admin);
            if (!hasAccess) {
                return server_1.NextResponse.json({ error: 'You do not have access to this project' }, { status: 403 });
            }
            // Check if project is completed (read-only mode)
            const { data: project } = await admin
                .from('projects')
                .select('status')
                .eq('id', body.project_id)
                .single();
            if (project?.status === 'complete') {
                return server_1.NextResponse.json({
                    error: 'Cannot create tasks in a completed project. The project is in read-only mode.'
                }, { status: 400 });
            }
        }
        // Create task directly using the server-side Supabase client (not the client-side taskServiceDB)
        const taskInsert = {
            name: body.name,
            description: body.description || null,
            project_id: body.project_id,
            status: body.status || 'backlog',
            priority: body.priority || 'medium',
            start_date: body.start_date || null,
            due_date: body.due_date || null,
            estimated_hours: body.estimated_hours !== undefined ? body.estimated_hours : null,
            remaining_hours: body.estimated_hours !== undefined ? body.estimated_hours : null,
            actual_hours: 0,
            created_by: user.id,
            assigned_to: body.assigned_to || null
        };
        const { data: task, error: taskError } = await admin
            .from('tasks')
            .insert(taskInsert)
            .select(`
        *,
        created_by_user:user_profiles!created_by(id, name, email),
        assigned_to_user:user_profiles!assigned_to(id, name, email),
        project:projects(id, name)
      `)
            .single();
        if (taskError) {
            debug_logger_1.logger.error('Error creating task:', {}, taskError);
            return server_1.NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
        }
        // Add user as project collaborator if not already assigned
        if (body.project_id) {
            const { data: existingAssignment } = await admin
                .from('project_assignments')
                .select('id, removed_at')
                .eq('project_id', body.project_id)
                .eq('user_id', user.id)
                .single();
            if (!existingAssignment) {
                // Insert new assignment
                await admin.from('project_assignments').insert({
                    project_id: body.project_id,
                    user_id: user.id,
                    role_in_project: 'collaborator',
                    assigned_by: user.id
                });
            }
            else if (existingAssignment.removed_at) {
                // Reactivate removed assignment
                await admin
                    .from('project_assignments')
                    .update({ removed_at: null, role_in_project: 'collaborator' })
                    .eq('id', existingAssignment.id);
            }
        }
        return server_1.NextResponse.json({ success: true, task }, { status: 201 });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in POST /api/tasks:', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
