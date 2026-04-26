"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.taskServiceDB = void 0;
const supabase_1 = require("./supabase");
const debug_logger_1 = require("./debug-logger");
class TaskServiceDB {
    getSupabase() {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase) {
            throw new Error('Supabase client not available');
        }
        return supabase;
    }
    /**
     * Get all tasks for a specific project
     * Calculates actual_hours from time_entries instead of using stored value
     */
    async getTasksByProject(projectId) {
        // Guard against invalid projectId
        if (!projectId || typeof projectId !== 'string') {
            debug_logger_1.logger.warn('getTasksByProject called with invalid projectId', { projectId });
            return [];
        }
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('tasks')
                .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
                .eq('project_id', projectId)
                .order('created_at', { ascending: false });
            if (error) {
                debug_logger_1.logger.error('Error fetching tasks', {
                    message: error.message,
                    code: error.code,
                    details: error.details,
                    hint: error.hint,
                    projectId
                });
                throw error;
            }
            if (!data || data.length === 0) {
                return [];
            }
            // Get task IDs to fetch time entries
            const taskIds = data.map((t) => t.id);
            // Fetch time entries for all tasks in this project
            const { data: timeEntries, error: timeError } = await supabase
                .from('time_entries')
                .select('task_id, hours_logged')
                .in('task_id', taskIds);
            if (timeError) {
                debug_logger_1.logger.error('Error fetching time entries', {
                    message: timeError.message,
                    code: timeError.code,
                    details: timeError.details,
                    hint: timeError.hint,
                    taskCount: taskIds.length
                });
                // Continue without time entries - use stored actual_hours
                return data.map(this.mapTaskRowToTask);
            }
            // Calculate sum of hours per task
            const hoursPerTask = new Map();
            if (timeEntries) {
                for (const entry of timeEntries) {
                    const typedEntry = entry;
                    if (typedEntry.task_id) {
                        const current = hoursPerTask.get(typedEntry.task_id) || 0;
                        hoursPerTask.set(typedEntry.task_id, current + (typedEntry.hours_logged || 0));
                    }
                }
            }
            // Map tasks and override actual_hours with calculated value
            return data.map((row) => {
                const task = this.mapTaskRowToTask(row);
                // Use calculated hours from time entries
                task.actual_hours = hoursPerTask.get(task.id) || 0;
                return task;
            });
        }
        catch (error) {
            const err = error;
            debug_logger_1.logger.error('Error in getTasksByProject', {
                message: err?.message || 'Unknown error',
                code: err?.code,
                projectId
            }, error);
            return [];
        }
    }
    /**
     * Get a single task by ID
     */
    async getTaskById(taskId) {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('tasks')
                .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
                .eq('id', taskId)
                .single();
            if (error) {
                debug_logger_1.logger.error('Error fetching task', { error });
                return null;
            }
            return data ? this.mapTaskRowToTask(data) : null;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getTaskById', {}, error);
            return null;
        }
    }
    /**
     * Create a new task
     */
    async createTask(data) {
        try {
            const supabase = this.getSupabase();
            // Verify user session
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError || !user) {
                debug_logger_1.logger.error('Auth check failed in createTask', {
                    authError,
                    hasUser: !!user
                });
                throw new Error('User not authenticated');
            }
            debug_logger_1.logger.debug('Creating task with user', { userId: user.id });
            debug_logger_1.logger.debug('Task creation data input', { data });
            const taskData = {
                name: data.name,
                description: data.description || null,
                project_id: data.project_id,
                status: data.status || 'backlog',
                priority: data.priority || 'medium',
                start_date: data.start_date || null,
                due_date: data.due_date || null,
                estimated_hours: data.estimated_hours !== undefined ? data.estimated_hours : null,
                remaining_hours: data.estimated_hours !== undefined ? data.estimated_hours : null, // Initialize remaining_hours to estimated_hours
                actual_hours: 0,
                created_by: data.created_by,
                assigned_to: data.assigned_to || null,
            };
            debug_logger_1.logger.debug('Task data being inserted', { taskData });
            // Type assertion needed due to complex joined query
            const result = await supabase
                .from('tasks')
                .insert([taskData])
                .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
                .single();
            const { data: newTask, error } = result;
            if (error) {
                debug_logger_1.logger.error('Error creating task', {
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    code: error.code
                });
                throw error;
            }
            debug_logger_1.logger.debug('New task from database', { newTask });
            const mappedTask = newTask ? this.mapTaskRowToTask(newTask) : null;
            debug_logger_1.logger.debug('Mapped new task', { mappedTask });
            return mappedTask;
        }
        catch (error) {
            const err = error;
            debug_logger_1.logger.error('Error in createTask', {
                message: err?.message,
                details: err?.details,
                hint: err?.hint,
                code: err?.code,
                name: err?.name
            }, error);
            return null;
        }
    }
    /**
     * Update an existing task
     */
    async updateTask(data) {
        try {
            const supabase = this.getSupabase();
            const updateData = {
                ...(data.name !== undefined && { name: data.name }),
                ...(data.description !== undefined && { description: data.description }),
                ...(data.status !== undefined && { status: data.status }),
                ...(data.priority !== undefined && { priority: data.priority }),
                ...(data.start_date !== undefined && { start_date: data.start_date }),
                ...(data.due_date !== undefined && { due_date: data.due_date }),
                ...(data.estimated_hours !== undefined && { estimated_hours: data.estimated_hours }),
                ...(data.actual_hours !== undefined && { actual_hours: data.actual_hours }),
                ...(data.remaining_hours !== undefined && { remaining_hours: data.remaining_hours }),
                ...(data.assigned_to !== undefined && { assigned_to: data.assigned_to }),
                updated_at: new Date().toISOString(),
            };
            // If status is being set to 'done', calculate and set actual_hours
            if (data.status === 'done') {
                // First fetch current task to get estimated and remaining hours
                const { data: currentTask } = await supabase
                    .from('tasks')
                    .select('estimated_hours, remaining_hours')
                    .eq('id', data.id)
                    .single();
                if (currentTask) {
                    const typedTask = currentTask;
                    const estimated = typedTask.estimated_hours || 0;
                    const remaining = typedTask.remaining_hours ?? estimated;
                    // actual_hours = estimated - remaining (how much work was done)
                    updateData.actual_hours = Math.max(0, estimated - remaining);
                    // Also set remaining to 0 since task is complete
                    updateData.remaining_hours = 0;
                    debug_logger_1.logger.info(`Task marked done`, { taskId: data.id, actual_hours: updateData.actual_hours, estimated, remaining });
                }
            }
            // Type assertion needed due to complex joined query
            const result = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', data.id)
                .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
                .single();
            const { data: updatedTask, error } = result;
            if (error) {
                debug_logger_1.logger.error('Error updating task', { error });
                throw error;
            }
            return updatedTask ? this.mapTaskRowToTask(updatedTask) : null;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in updateTask', {}, error);
            return null;
        }
    }
    /**
     * Update remaining hours for a task
     * Automatically sets status to 'done' if remaining_hours is 0
     */
    async updateRemainingHours(taskId, remainingHours, estimatedHours) {
        try {
            const supabase = this.getSupabase();
            debug_logger_1.logger.debug('updateRemainingHours called with', {
                taskId,
                remainingHours,
                estimatedHours
            });
            // Validate remaining hours doesn't exceed estimated hours
            if (estimatedHours !== null && remainingHours > estimatedHours) {
                throw new Error(`Remaining hours (${remainingHours}) cannot exceed estimated hours (${estimatedHours})`);
            }
            // Prepare update data
            const updateData = {
                remaining_hours: remainingHours,
            };
            // If remaining hours is 0, automatically set status to 'done' and log actual hours
            if (remainingHours === 0) {
                updateData.status = 'done';
                // actual_hours = estimated - remaining (since remaining is 0, actual = estimated)
                updateData.actual_hours = estimatedHours || 0;
                debug_logger_1.logger.info('Task auto-completed', { taskId, actual_hours: updateData.actual_hours });
            }
            debug_logger_1.logger.debug('Updating task with data', { updateData });
            // Type assertion needed due to complex joined query
            const result = await supabase
                .from('tasks')
                .update(updateData)
                .eq('id', taskId)
                .select(`
          *,
          created_by_user:user_profiles!created_by(id, name, email),
          assigned_to_user:user_profiles!assigned_to(id, name, email),
          project:projects(id, name)
        `)
                .single();
            const { data: updatedTask, error } = result;
            if (error) {
                debug_logger_1.logger.error('Error updating remaining hours', { error });
                throw error;
            }
            debug_logger_1.logger.debug('Updated task from database', { updatedTask });
            const mappedTask = updatedTask ? this.mapTaskRowToTask(updatedTask) : null;
            debug_logger_1.logger.debug('Mapped task result', { mappedTask });
            return mappedTask;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in updateRemainingHours', {}, error);
            throw error;
        }
    }
    /**
     * Delete a task
     */
    async deleteTask(taskId) {
        try {
            const supabase = this.getSupabase();
            const { error } = await supabase
                .from('tasks')
                .delete()
                .eq('id', taskId);
            if (error) {
                debug_logger_1.logger.error('Error deleting task', { error });
                throw error;
            }
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in deleteTask', {}, error);
            return false;
        }
    }
    /**
     * Map database row to Task interface
     */
    mapTaskRowToTask(row) {
        return {
            id: row.id,
            name: row.name,
            description: row.description,
            project_id: row.project_id,
            status: row.status,
            priority: row.priority,
            start_date: row.start_date,
            due_date: row.due_date,
            estimated_hours: row.estimated_hours,
            remaining_hours: row.remaining_hours,
            actual_hours: row.actual_hours,
            created_by: row.created_by,
            assigned_to: row.assigned_to || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
            created_by_user: row.created_by_user,
            assigned_to_user: row.assigned_to_user,
            project: row.project,
        };
    }
}
// Export singleton instance
exports.taskServiceDB = new TaskServiceDB();
