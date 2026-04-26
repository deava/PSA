"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountKanbanConfigService = exports.DEFAULT_KANBAN_COLUMNS = void 0;
const supabase_1 = require("./supabase");
const debug_logger_1 = require("./debug-logger");
// Default Kanban columns
exports.DEFAULT_KANBAN_COLUMNS = [
    { id: 'planned', name: 'Planned', color: '#6B7280', order: 1 },
    { id: 'in-progress', name: 'In Progress', color: '#3B82F6', order: 2 },
    { id: 'review', name: 'Review', color: '#F59E0B', order: 3 },
    { id: 'complete', name: 'Complete', color: '#10B981', order: 4 },
];
class AccountKanbanConfigService {
    getSupabase() {
        const supabase = (0, supabase_1.createClientSupabase)();
        if (!supabase) {
            throw new Error('Supabase client not available');
        }
        return supabase;
    }
    // Test function to verify database access
    async testDatabaseAccess() {
        try {
            const supabase = this.getSupabase();
            debug_logger_1.logger.debug('Testing database access...', {});
            // Test basic table access
            const { error } = await supabase
                .from('account_kanban_configs')
                .select('count')
                .limit(1);
            if (error) {
                debug_logger_1.logger.error('Database access test failed', { error });
                return false;
            }
            debug_logger_1.logger.debug('Database access test successful', {});
            return true;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in database access test', {}, error);
            return false;
        }
    }
    async getAccountKanbanConfig(accountId) {
        try {
            const supabase = this.getSupabase();
            debug_logger_1.logger.debug('Fetching kanban config for account', { accountId });
            const { data, error } = await supabase
                .from('account_kanban_configs')
                .select('*')
                .eq('account_id', accountId)
                .single();
            if (error) {
                if (error.code === 'PGRST116') {
                    // No config found, return default
                    debug_logger_1.logger.debug('No kanban config found in database for account', { accountId });
                    return null;
                }
                debug_logger_1.logger.error('Error fetching account kanban config', { error });
                return null;
            }
            debug_logger_1.logger.debug('Successfully loaded kanban config from database', {
                id: data.id,
                account_id: data.account_id,
                columns: data.columns,
                columnCount: data.columns?.length || 0
            });
            return data;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getAccountKanbanConfig', {}, error);
            return null;
        }
    }
    async createAccountKanbanConfig(accountId, columns) {
        try {
            const supabase = this.getSupabase();
            const { data, error } = await supabase
                .from('account_kanban_configs')
                .insert([{
                    account_id: accountId,
                    columns: columns,
                }])
                .select()
                .single();
            if (error) {
                // This error is expected and OK - it happens when:
                // 1. RLS policies prevent the insert (user doesn't have permission)
                // 2. A config already exists (duplicate key)
                // We handle this gracefully by using an in-memory fallback config
                debug_logger_1.logger.debug('Could not create kanban config in database (using fallback instead)', {
                    code: error.code,
                    reason: error.code === '42501' ? 'RLS policy' : error.code === '23505' ? 'Already exists' : 'Other'
                });
                return null;
            }
            return data;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in createAccountKanbanConfig', {}, error);
            return null;
        }
    }
    async updateAccountKanbanConfig(accountId, columns) {
        try {
            const supabase = this.getSupabase();
            debug_logger_1.logger.debug('Updating kanban config for account', { accountId });
            debug_logger_1.logger.debug('Columns to save', { columns });
            // First, let's try to check if we can read from the table
            debug_logger_1.logger.debug('Testing table access...', {});
            const { error: testError } = await supabase
                .from('account_kanban_configs')
                .select('*')
                .limit(1);
            if (testError) {
                debug_logger_1.logger.error('Table access test failed', { error: testError });
                return null;
            }
            debug_logger_1.logger.debug('Table access test successful, proceeding with upsert...', {});
            // Check if record exists first, then update or insert accordingly
            const { data: existingRecord } = await supabase
                .from('account_kanban_configs')
                .select('id')
                .eq('account_id', accountId)
                .single();
            let data = null;
            let error = null;
            if (existingRecord) {
                debug_logger_1.logger.debug('Record exists, updating...', {});
                const result = await supabase
                    .from('account_kanban_configs')
                    .update({
                    columns: columns,
                    updated_at: new Date().toISOString(),
                })
                    .eq('account_id', accountId)
                    .select()
                    .single();
                data = result.data;
                error = result.error;
            }
            else {
                debug_logger_1.logger.debug('No existing record, inserting...', {});
                const result = await supabase
                    .from('account_kanban_configs')
                    .insert([{
                        account_id: accountId,
                        columns: columns,
                    }])
                    .select()
                    .single();
                data = result.data;
                error = result.error;
            }
            if (error) {
                debug_logger_1.logger.error('Supabase error updating account kanban config', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                return null;
            }
            debug_logger_1.logger.debug('Successfully updated kanban config', { data });
            return data;
        }
        catch (error) {
            debug_logger_1.logger.error('Exception in updateAccountKanbanConfig', {}, error);
            return null;
        }
    }
    async getOrCreateAccountKanbanConfig(accountId) {
        try {
            let config = await this.getAccountKanbanConfig(accountId);
            debug_logger_1.logger.debug('Loaded kanban config from database', { config });
            if (!config) {
                // Create default config
                debug_logger_1.logger.debug('No kanban config found, creating default config for account', { accountId });
                config = await this.createAccountKanbanConfig(accountId, exports.DEFAULT_KANBAN_COLUMNS);
                if (config) {
                    debug_logger_1.logger.debug('Successfully created default kanban config', {});
                }
                else {
                    debug_logger_1.logger.warn('Failed to create kanban config in database (this is OK - may already exist or RLS issue)', {});
                }
            }
            if (!config) {
                // Fallback to default config in memory - this is OK and normal
                debug_logger_1.logger.debug('Using in-memory fallback kanban config (database insert failed but this is fine)', {});
                return {
                    id: 'default',
                    account_id: accountId,
                    columns: exports.DEFAULT_KANBAN_COLUMNS,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                };
            }
            debug_logger_1.logger.debug('Final kanban config being returned', {
                id: config.id,
                account_id: config.account_id,
                columns: config.columns,
                columnCount: config.columns.length
            });
            return config;
        }
        catch (error) {
            debug_logger_1.logger.error('Error in getOrCreateAccountKanbanConfig', {}, error);
            // Return fallback config
            return {
                id: 'default',
                account_id: accountId,
                columns: exports.DEFAULT_KANBAN_COLUMNS,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
        }
    }
    // Helper function to map project status to kanban column
    getKanbanColumnForStatus(status, columns, _customAssignments) {
        const statusToColumnMap = {
            'planning': 'planned',
            'in_progress': 'in-progress',
            'review': 'review',
            'complete': 'complete',
            'on_hold': 'planned', // Default on_hold to planned
        };
        const defaultColumn = statusToColumnMap[status] || 'planned';
        // Check if the mapped column exists in the account's columns
        const columnExists = columns.some((col) => col.id === defaultColumn);
        if (columnExists) {
            return defaultColumn;
        }
        // If not, return the first column
        return columns[0]?.id || 'planned';
    }
    // Helper function to map kanban column to project status
    getStatusForKanbanColumn(columnId, columns) {
        debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping column to status', {
            columnId,
            columns: columns.map((col) => ({ id: col.id, name: col.name }))
        });
        const columnToStatusMap = {
            'planned': 'planning',
            'in-progress': 'in_progress',
            'review': 'review',
            'complete': 'complete',
        };
        // Check if this is a custom column
        const customColumn = columns.find((col) => col.id === columnId);
        debug_logger_1.logger.debug('[KANBAN CONFIG] Custom column found', { customColumn });
        if (customColumn && !columnToStatusMap[columnId]) {
            // For custom columns, map to the closest valid database status
            // This ensures we only use valid database status values
            const customColumnName = customColumn.name.toLowerCase();
            debug_logger_1.logger.debug('[KANBAN CONFIG] Custom column name', { customColumnName });
            if (customColumnName.includes('review') && !customColumnName.includes('approved')) {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to review status', {});
                return 'review'; // Map review columns to review status
            }
            else if (customColumnName.includes('approved') || customColumnName.includes('approval')) {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to review status for approved (visual only)', {});
                return 'review'; // Map approved columns to review status (approved is visual only)
            }
            else if (customColumnName.includes('pending')) {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to review status for pending', {});
                return 'review'; // Map pending columns to review status
            }
            else if (customColumnName.includes('blocked') || customColumnName.includes('hold')) {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to on_hold status', {});
                return 'on_hold'; // Map blocked/hold columns to on_hold status
            }
            else if (customColumnName.includes('done') || customColumnName.includes('finished')) {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to complete status', {});
                return 'complete'; // Map done/finished columns to complete status
            }
            else {
                debug_logger_1.logger.debug('[KANBAN CONFIG] Mapping to planning status (default)', {});
                return 'planning'; // Default custom columns to planning status
            }
        }
        const mappedStatus = columnToStatusMap[columnId] || 'planning';
        debug_logger_1.logger.debug('[KANBAN CONFIG] Final mapped status', { mappedStatus });
        return mappedStatus;
    }
}
exports.accountKanbanConfigService = new AccountKanbanConfigService();
