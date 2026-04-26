"use strict";
/**
 * Time Entry Service
 * Manages time logging on tasks and projects
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.timeEntryService = void 0;
const supabase_1 = require("../supabase");
const debug_logger_1 = require("../debug-logger");
class TimeEntryService {
    /**
     * Get Monday of the week for a given date
     */
    getWeekStartDate(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    }
    /**
     * Log time on a task
     */
    async logTime(taskId, userId, projectId, hoursLogged, entryDate, description) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        const weekStartDate = this.getWeekStartDate(new Date(entryDate));
        const insertData = {
            task_id: taskId,
            user_id: userId,
            project_id: projectId,
            hours_logged: hoursLogged,
            entry_date: entryDate,
            week_start_date: weekStartDate,
            description: description || null,
        };
        const { data, error } = await supabase
            .from('time_entries')
            .insert([insertData])
            .select()
            .single();
        if (error) {
            debug_logger_1.logger.error('Error logging time', {}, error);
            return null;
        }
        return data;
    }
    /**
     * Get time entries for a user
     */
    async getUserTimeEntries(userId, startDate, endDate) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return [];
        let query = supabase
            .from('time_entries')
            .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
            .eq('user_id', userId)
            .order('entry_date', { ascending: false });
        if (startDate) {
            query = query.gte('entry_date', startDate);
        }
        if (endDate) {
            query = query.lte('entry_date', endDate);
        }
        const { data, error } = await query;
        if (error) {
            debug_logger_1.logger.error('Error fetching user time entries', {}, error);
            return [];
        }
        return data || [];
    }
    /**
     * Get time entries for a task
     */
    async getTaskTimeEntries(taskId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return [];
        const { data, error } = await supabase
            .from('time_entries')
            .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
            .eq('task_id', taskId)
            .order('entry_date', { ascending: false });
        if (error) {
            debug_logger_1.logger.error('Error fetching task time entries', {}, error);
            return [];
        }
        return data || [];
    }
    /**
     * Get time entries for a project
     */
    async getProjectTimeEntries(projectId, weekStartDate) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return [];
        let query = supabase
            .from('time_entries')
            .select(`
        *,
        task:tasks(id, name),
        project:projects(id, name),
        user:user_profiles(id, name, email)
      `)
            .eq('project_id', projectId)
            .order('entry_date', { ascending: false });
        if (weekStartDate) {
            query = query.eq('week_start_date', weekStartDate);
        }
        const { data, error } = await query;
        if (error) {
            debug_logger_1.logger.error('Error fetching project time entries', {}, error);
            return [];
        }
        return data || [];
    }
    /**
     * Get weekly time summary for a user
     */
    async getUserWeeklySummary(userId, weekStartDate) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return { totalHours: 0, entriesCount: 0 };
        const { data, error } = await supabase
            .from('time_entries')
            .select('hours_logged')
            .eq('user_id', userId)
            .eq('week_start_date', weekStartDate);
        if (error) {
            debug_logger_1.logger.error('Error fetching weekly summary', {}, error);
            return { totalHours: 0, entriesCount: 0 };
        }
        const totalHours = data.reduce((sum, entry) => sum + (entry.hours_logged || 0), 0);
        return {
            totalHours,
            entriesCount: data.length,
        };
    }
    /**
     * Update a time entry
     */
    async updateTimeEntry(entryId, updates) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        const updateData = {};
        if (updates.hours_logged !== undefined) {
            updateData.hours_logged = updates.hours_logged;
        }
        if (updates.entry_date) {
            updateData.entry_date = updates.entry_date;
            updateData.week_start_date = this.getWeekStartDate(new Date(updates.entry_date));
        }
        if (updates.description !== undefined) {
            updateData.description = updates.description;
        }
        const { data, error } = await supabase
            .from('time_entries')
            .update(updateData)
            .eq('id', entryId)
            .select()
            .single();
        if (error) {
            debug_logger_1.logger.error('Error updating time entry', {}, error);
            return null;
        }
        return data;
    }
    /**
     * Delete a time entry
     */
    async deleteTimeEntry(entryId) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return false;
        const { error } = await supabase
            .from('time_entries')
            .delete()
            .eq('id', entryId);
        if (error) {
            debug_logger_1.logger.error('Error deleting time entry', {}, error);
            return false;
        }
        return true;
    }
    /**
     * Get time entries for multiple weeks (for charts/trends)
     */
    async getUserTimeEntriesByWeek(userId, numberOfWeeks = 8) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return {};
        // Calculate start date (X weeks ago)
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - (numberOfWeeks * 7));
        const { data, error } = await supabase
            .from('time_entries')
            .select('week_start_date, hours_logged')
            .eq('user_id', userId)
            .gte('entry_date', startDate.toISOString().split('T')[0])
            .lte('entry_date', endDate.toISOString().split('T')[0]);
        if (error) {
            debug_logger_1.logger.error('Error fetching time entries by week', {}, error);
            return {};
        }
        // Aggregate by week
        const weeklyHours = {};
        data.forEach((entry) => {
            const week = entry.week_start_date;
            weeklyHours[week] = (weeklyHours[week] || 0) + (entry.hours_logged || 0);
        });
        return weeklyHours;
    }
}
// Export singleton instance
exports.timeEntryService = new TimeEntryService();
