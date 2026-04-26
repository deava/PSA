"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getMilestones = getMilestones;
exports.createMilestone = createMilestone;
exports.updateMilestone = updateMilestone;
exports.deleteMilestone = deleteMilestone;
const supabase_1 = require("@/lib/supabase");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * Fetch all milestones from the database
 */
async function getMilestones() {
    const supabase = (0, supabase_1.createClientSupabase)();
    const { data, error } = await supabase
        .from('milestones')
        .select('*')
        .order('date', { ascending: true });
    if (error) {
        debug_logger_1.logger.error('Error fetching milestones', {}, error);
        throw new Error('Failed to fetch milestones');
    }
    return data || [];
}
/**
 * Create a new milestone
 */
async function createMilestone(input) {
    const supabase = (0, supabase_1.createClientSupabase)();
    const { data, error } = await supabase
        .from('milestones')
        .insert({
        name: input.name,
        description: input.description,
        date: input.date.toISOString(),
        color: input.color || '#3b82f6',
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error creating milestone', {}, error);
        throw new Error('Failed to create milestone');
    }
    return data;
}
/**
 * Update an existing milestone
 */
async function updateMilestone(id, input) {
    const supabase = (0, supabase_1.createClientSupabase)();
    const updateData = {};
    if (input.name !== undefined)
        updateData.name = input.name;
    if (input.description !== undefined)
        updateData.description = input.description;
    if (input.date !== undefined)
        updateData.date = input.date.toISOString();
    if (input.color !== undefined)
        updateData.color = input.color;
    const { data, error } = await supabase
        .from('milestones')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error updating milestone', {}, error);
        throw new Error('Failed to update milestone');
    }
    return data;
}
/**
 * Delete a milestone
 */
async function deleteMilestone(id) {
    const supabase = (0, supabase_1.createClientSupabase)();
    const { error } = await supabase
        .from('milestones')
        .delete()
        .eq('id', id);
    if (error) {
        debug_logger_1.logger.error('Error deleting milestone', {}, error);
        throw new Error('Failed to delete milestone');
    }
}
