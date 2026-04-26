"use strict";
/**
 * User Approval Service
 * Handles user approval workflow for new user registrations
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.userApprovalService = void 0;
const supabase_1 = require("./supabase");
const debug_logger_1 = require("./debug-logger");
class UserApprovalService {
    async getSupabase() {
        return (0, supabase_1.createClientSupabase)();
    }
    /**
     * Get all users pending approval
     */
    async getPendingUsers() {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getPendingUsers' });
                return [];
            }
            (0, debug_logger_1.databaseQuery)('SELECT', 'pending_user_approvals', { action: 'getPendingUsers' });
            const { data: pendingUsers, error } = await supabase
                .from('pending_user_approvals')
                .select('*')
                .order('approval_requested_at', { ascending: true });
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'pending_user_approvals', error, { action: 'getPendingUsers' });
                debug_logger_1.logger.error('Error fetching pending users', { action: 'getPendingUsers' }, error);
                return [];
            }
            debug_logger_1.logger.info(`Found ${pendingUsers?.length || 0} pending users`, {
                action: 'getPendingUsers',
                count: pendingUsers?.length || 0
            });
            return pendingUsers || [];
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in getPendingUsers', { action: 'getPendingUsers' }, error);
            return [];
        }
    }
    /**
     * Approve a user
     */
    async approveUser(userId, approvedBy, reason) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'approveUser', userId });
                return false;
            }
            (0, debug_logger_1.databaseQuery)('UPDATE', 'user_profiles', { action: 'approveUser', userId, approvedBy });
            const { error } = await supabase
                .from('user_profiles')
                .update({
                is_approved: true,
                approved_by: approvedBy,
                approved_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', userId)
                .eq('is_approved', false); // Only approve if not already approved
            if (error) {
                (0, debug_logger_1.databaseError)('UPDATE', 'user_profiles', error, { action: 'approveUser', userId });
                debug_logger_1.logger.error('Error approving user', { action: 'approveUser', userId }, error);
                return false;
            }
            (0, debug_logger_1.userAction)('approved', userId, { action: 'approveUser', approvedBy, reason });
            debug_logger_1.logger.info('User approved successfully', {
                action: 'approveUser',
                userId,
                approvedBy,
                reason
            });
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in approveUser', { action: 'approveUser', userId }, error);
            return false;
        }
    }
    /**
     * Reject a user (delete their account)
     */
    async rejectUser(userId, rejectedBy, reason) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'rejectUser', userId });
                return false;
            }
            // First, remove any role assignments
            (0, debug_logger_1.databaseQuery)('DELETE', 'user_roles', { action: 'rejectUser', userId });
            const { error: roleError } = await supabase
                .from('user_roles')
                .delete()
                .eq('user_id', userId);
            if (roleError) {
                (0, debug_logger_1.databaseError)('DELETE', 'user_roles', roleError, { action: 'rejectUser', userId });
                debug_logger_1.logger.warn('Error removing user roles during rejection', {
                    action: 'rejectUser',
                    userId
                });
            }
            // Then delete the user profile
            (0, debug_logger_1.databaseQuery)('DELETE', 'user_profiles', { action: 'rejectUser', userId });
            const { error } = await supabase
                .from('user_profiles')
                .delete()
                .eq('id', userId)
                .eq('is_approved', false); // Only delete if not approved
            if (error) {
                (0, debug_logger_1.databaseError)('DELETE', 'user_profiles', error, { action: 'rejectUser', userId });
                debug_logger_1.logger.error('Error rejecting user', { action: 'rejectUser', userId }, error);
                return false;
            }
            (0, debug_logger_1.userAction)('rejected', userId, { action: 'rejectUser', rejectedBy, reason });
            debug_logger_1.logger.info('User rejected successfully', {
                action: 'rejectUser',
                userId,
                rejectedBy,
                reason
            });
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in rejectUser', { action: 'rejectUser', userId }, error);
            return false;
        }
    }
    /**
     * Request approval for a user (usually called on signup)
     */
    async requestApproval(userId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'requestApproval', userId });
                return false;
            }
            (0, debug_logger_1.databaseQuery)('UPDATE', 'user_profiles', { action: 'requestApproval', userId });
            const { error } = await supabase
                .from('user_profiles')
                .update({
                is_approved: false,
                approval_requested_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            })
                .eq('id', userId);
            if (error) {
                (0, debug_logger_1.databaseError)('UPDATE', 'user_profiles', error, { action: 'requestApproval', userId });
                debug_logger_1.logger.error('Error requesting approval', { action: 'requestApproval', userId }, error);
                return false;
            }
            (0, debug_logger_1.userAction)('approval_requested', userId, { action: 'requestApproval' });
            debug_logger_1.logger.info('Approval requested successfully', { action: 'requestApproval', userId });
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in requestApproval', { action: 'requestApproval', userId }, error);
            return false;
        }
    }
    /**
     * Check if a user is approved
     */
    async isUserApproved(userId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'isUserApproved', userId });
                return false;
            }
            (0, debug_logger_1.databaseQuery)('SELECT', 'user_profiles', { action: 'isUserApproved', userId });
            const { data: user, error } = await supabase
                .from('user_profiles')
                .select('is_approved')
                .eq('id', userId)
                .single();
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'user_profiles', error, { action: 'isUserApproved', userId });
                debug_logger_1.logger.error('Error checking user approval status', { action: 'isUserApproved', userId }, error);
                return false;
            }
            const isApproved = user?.is_approved || false;
            debug_logger_1.logger.debug('User approval status checked', {
                action: 'isUserApproved',
                userId,
                isApproved
            });
            return isApproved;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in isUserApproved', { action: 'isUserApproved', userId }, error);
            return false;
        }
    }
    /**
     * Get approval statistics
     */
    async getApprovalStats() {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getApprovalStats' });
                return {
                    total_pending: 0,
                    total_approved: 0,
                    total_rejected: 0,
                    pending_by_date: {},
                };
            }
            (0, debug_logger_1.databaseQuery)('SELECT', 'user_profiles', { action: 'getApprovalStats' });
            const { data: users, error } = await supabase
                .from('user_profiles')
                .select('is_approved, approval_requested_at, created_at');
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'user_profiles', error, { action: 'getApprovalStats' });
                debug_logger_1.logger.error('Error fetching approval stats', { action: 'getApprovalStats' }, error);
                return {
                    total_pending: 0,
                    total_approved: 0,
                    total_rejected: 0,
                    pending_by_date: {},
                };
            }
            const stats = {
                total_pending: 0,
                total_approved: 0,
                total_rejected: 0,
                pending_by_date: {},
            };
            users?.forEach((user) => {
                if (user.is_approved) {
                    stats.total_approved++;
                }
                else {
                    stats.total_pending++;
                    // Group pending by date
                    const date = new Date((user.approval_requested_at || user.created_at)).toISOString().split('T')[0];
                    stats.pending_by_date[date] = (stats.pending_by_date[date] || 0) + 1;
                }
            });
            debug_logger_1.logger.info('Approval stats retrieved', {
                action: 'getApprovalStats',
                ...stats
            });
            return stats;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in getApprovalStats', { action: 'getApprovalStats' }, error);
            return {
                total_pending: 0,
                total_approved: 0,
                total_rejected: 0,
                pending_by_date: {},
            };
        }
    }
    /**
     * Bulk approve multiple users
     */
    async bulkApproveUsers(userIds, approvedBy, reason) {
        try {
            debug_logger_1.logger.info(`Starting bulk approval for ${userIds.length} users`, {
                action: 'bulkApproveUsers',
                count: userIds.length,
                approvedBy
            });
            const results = {
                successful: [],
                failed: [],
            };
            // Process approvals in parallel with limited concurrency
            const batchSize = 5;
            for (let i = 0; i < userIds.length; i += batchSize) {
                const batch = userIds.slice(i, i + batchSize);
                const batchPromises = batch.map(async (userId) => {
                    const success = await this.approveUser(userId, approvedBy, reason);
                    if (success) {
                        results.successful.push(userId);
                    }
                    else {
                        results.failed.push(userId);
                    }
                });
                await Promise.all(batchPromises);
            }
            debug_logger_1.logger.info('Bulk approval completed', {
                action: 'bulkApproveUsers',
                successful: results.successful.length,
                failed: results.failed.length,
                approvedBy
            });
            return results;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in bulkApproveUsers', { action: 'bulkApproveUsers' }, error);
            return {
                successful: [],
                failed: userIds,
            };
        }
    }
    /**
     * Get user approval history
     */
    async getUserApprovalHistory(userId) {
        try {
            const supabase = await this.getSupabase();
            if (!supabase) {
                debug_logger_1.logger.error('Supabase client not available', { action: 'getUserApprovalHistory', userId });
                return null;
            }
            (0, debug_logger_1.databaseQuery)('SELECT', 'user_profiles', { action: 'getUserApprovalHistory', userId });
            const { data: user, error } = await supabase
                .from('user_profiles')
                .select(`
          approval_requested_at,
          approved_at,
          approved_by,
          approver:approved_by(name)
        `)
                .eq('id', userId)
                .single();
            if (error) {
                (0, debug_logger_1.databaseError)('SELECT', 'user_profiles', error, { action: 'getUserApprovalHistory', userId });
                debug_logger_1.logger.error('Error fetching user approval history', { action: 'getUserApprovalHistory', userId }, error);
                return null;
            }
            const history = {
                approval_requested_at: user?.approval_requested_at || null,
                approved_at: user?.approved_at || null,
                approved_by: user?.approved_by || null,
                approver_name: user?.approver?.name || null,
            };
            debug_logger_1.logger.debug('User approval history retrieved', {
                action: 'getUserApprovalHistory',
                userId,
                hasApproval: !!history.approved_at
            });
            return history;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in getUserApprovalHistory', { action: 'getUserApprovalHistory', userId }, error);
            return null;
        }
    }
}
// Export singleton instance
exports.userApprovalService = new UserApprovalService();
