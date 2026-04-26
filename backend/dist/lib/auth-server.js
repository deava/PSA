"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCurrentUserServer = getCurrentUserServer;
exports.getCurrentUserProfileServer = getCurrentUserProfileServer;
exports.isAuthenticatedServer = isAuthenticatedServer;
exports.getCurrentSessionServer = getCurrentSessionServer;
const supabase_server_1 = require("./supabase-server");
const debug_logger_1 = require("./debug-logger");
// Server-side authentication helper functions
/**
 * Get the current authenticated user (server-side only)
 * @returns The current user or null if not authenticated
 */
async function getCurrentUserServer() {
    try {
        const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!supabase)
            return null;
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            debug_logger_1.logger.error('Error getting current user', {}, error);
            return null;
        }
        return user;
    }
    catch (error) {
        debug_logger_1.logger.error('Error in getCurrentUserServer', {}, error);
        return null;
    }
}
/**
 * Get the current user's profile with roles (server-side only)
 * @returns The user profile with roles or null if not found
 */
async function getCurrentUserProfileServer() {
    try {
        const user = await getCurrentUserServer();
        if (!user)
            return null;
        const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!supabase)
            return null;
        const { data: profile, error } = await supabase
            .from('user_profiles')
            .select(`
        *,
        user_roles!user_id(
          id,
          user_id,
          role_id,
          assigned_at,
          assigned_by,
          roles!role_id(
            id,
            name,
            department_id,
            permissions,
            is_system_role,
            departments (
              id,
              name,
              description
            )
          )
        )
      `)
            .eq('id', user.id)
            .single();
        if (error) {
            debug_logger_1.logger.error('Error getting user profile', {}, error);
            return null;
        }
        return profile;
    }
    catch (error) {
        debug_logger_1.logger.error('Error in getCurrentUserProfileServer', {}, error);
        return null;
    }
}
/**
 * Check if user is authenticated (server-side only)
 * @returns True if user is authenticated, false otherwise
 */
async function isAuthenticatedServer() {
    try {
        const user = await getCurrentUserServer();
        return !!user;
    }
    catch (error) {
        debug_logger_1.logger.error('Error in isAuthenticatedServer', {}, error);
        return false;
    }
}
/**
 * Get the current session (server-side only)
 * @returns Current session or null
 */
async function getCurrentSessionServer() {
    try {
        const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
        if (!supabase)
            return null;
        const { data: { session }, error } = await supabase.auth.getSession();
        if (error) {
            debug_logger_1.logger.error('Error getting session', {}, error);
            return null;
        }
        return session;
    }
    catch (error) {
        debug_logger_1.logger.error('Error in getCurrentSessionServer', {}, error);
        return null;
    }
}
