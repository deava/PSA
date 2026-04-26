"use strict";
/**
 * User Availability Service
 * Manages weekly user work capacity and availability schedules
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.availabilityService = void 0;
const supabase_1 = require("../supabase");
const debug_logger_1 = require("../debug-logger");
class AvailabilityService {
    /**
     * Get Monday of the week for a given date
     */
    getWeekStartDate(date = new Date()) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
        const monday = new Date(d.setDate(diff));
        return monday.toISOString().split('T')[0];
    }
    /**
     * Get user availability for a specific week
     */
    async getUserAvailability(userId, weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        const targetWeek = weekStartDate || this.getWeekStartDate();
        const { data, error } = await supabase
            .from('user_availability')
            .select('*')
            .eq('user_id', userId)
            .eq('week_start_date', targetWeek)
            .single();
        if (error) {
            if (error.code === 'PGRST116') {
                // No record found - return default
                return null;
            }
            debug_logger_1.logger.error('Error fetching user availability', {}, error);
            return null;
        }
        return data;
    }
    /**
     * Get user availability for multiple weeks
     */
    async getUserAvailabilityRange(userId, startWeek, endWeek) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return [];
        const { data, error } = await supabase
            .from('user_availability')
            .select('*')
            .eq('user_id', userId)
            .gte('week_start_date', startWeek)
            .lte('week_start_date', endWeek)
            .order('week_start_date', { ascending: true });
        if (error) {
            debug_logger_1.logger.error('Error fetching user availability range', {}, error);
            return [];
        }
        return data || [];
    }
    /**
     * Set or update user availability for a week
     */
    async setUserAvailability(userId, weekStartDate, availableHours, scheduleData, notes, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return null;
        // Check if record exists
        const existing = await this.getUserAvailability(userId, weekStartDate, supabase);
        if (existing) {
            // Update existing record
            const { data, error } = await supabase
                .from('user_availability')
                .update({
                available_hours: availableHours,
                schedule_data: (scheduleData || existing.schedule_data),
                notes: notes !== undefined ? notes : existing.notes,
            })
                .eq('id', existing.id)
                .select()
                .single();
            if (error) {
                debug_logger_1.logger.error('Error updating user availability', {}, error);
                return null;
            }
            return data;
        }
        else {
            // Insert new record
            const insertData = {
                user_id: userId,
                week_start_date: weekStartDate,
                available_hours: availableHours,
                schedule_data: scheduleData || null,
                notes: notes || null,
            };
            const { data, error } = await supabase
                .from('user_availability')
                .insert([insertData])
                .select()
                .single();
            if (error) {
                debug_logger_1.logger.error('Error inserting user availability', {}, error);
                return null;
            }
            return data;
        }
    }
    /**
     * Delete user availability for a week
     */
    async deleteUserAvailability(userId, weekStartDate, supabaseClient) {
        const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return false;
        const { error } = await supabase
            .from('user_availability')
            .delete()
            .eq('user_id', userId)
            .eq('week_start_date', weekStartDate);
        if (error) {
            debug_logger_1.logger.error('Error deleting user availability', {}, error);
            return false;
        }
        return true;
    }
    /**
     * Copy availability to multiple weeks (for recurring patterns)
     */
    async copyAvailabilityToWeeks(userId, sourceWeek, targetWeeks) {
        const source = await this.getUserAvailability(userId, sourceWeek);
        if (!source)
            return false;
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return false;
        const insertData = targetWeeks.map((week) => ({
            user_id: userId,
            week_start_date: week,
            available_hours: source.available_hours,
            schedule_data: source.schedule_data,
            notes: source.notes,
        }));
        const { error } = await supabase
            .from('user_availability')
            .upsert(insertData);
        if (error) {
            debug_logger_1.logger.error('Error copying availability', {}, error);
            return false;
        }
        return true;
    }
    /**
     * Calculate total hours from schedule data
     */
    calculateTotalHours(schedule) {
        return Object.values(schedule).reduce((sum, hours) => sum + (hours || 0), 0);
    }
    /**
     * Get team availability for a department
     */
    async getDepartmentAvailability(departmentId, weekStartDate) {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase)
            return [];
        // Get all users in the department
        const { data: userRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id, roles!inner(department_id)')
            .eq('roles.department_id', departmentId);
        if (rolesError || !userRoles) {
            debug_logger_1.logger.error('Error fetching department users', {}, rolesError);
            return [];
        }
        const userIds = [...new Set(userRoles.map((ur) => ur.user_id))];
        const { data, error } = await supabase
            .from('user_availability')
            .select('*')
            .in('user_id', userIds)
            .eq('week_start_date', weekStartDate);
        if (error) {
            debug_logger_1.logger.error('Error fetching department availability', {}, error);
            return [];
        }
        return data || [];
    }
}
// Export singleton instance
exports.availabilityService = new AvailabilityService();
