"use strict";
/**
 * API Route: My Accounts Dashboard
 * Returns accounts the user is a member of with project counts
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const debug_logger_1 = require("@/lib/debug-logger");
exports.dynamic = 'force-dynamic';
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const userId = userProfile.id;
        // Get accounts user is a member of
        const { data: memberships, error: membershipError } = await supabase
            .from('account_members')
            .select(`
        account_id,
        accounts(
          id,
          name,
          status
        )
      `)
            .eq('user_id', userId);
        if (membershipError) {
            debug_logger_1.logger.error('Error fetching account memberships', {}, membershipError);
            return server_1.NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 });
        }
        // Also check for accounts where user manages them
        const { data: managedAccounts } = await supabase
            .from('accounts')
            .select('id, name, status')
            .eq('account_manager_id', userId);
        // Combine unique accounts
        const accountMap = new Map();
        memberships?.forEach((m) => {
            const account = Array.isArray(m.accounts) ? m.accounts[0] : m.accounts;
            if (account) {
                accountMap.set(account.id, account);
            }
        });
        managedAccounts?.forEach((account) => {
            if (!accountMap.has(account.id)) {
                accountMap.set(account.id, account);
            }
        });
        // Also check project assignments for additional accounts
        const { data: projectAssignments } = await supabase
            .from('project_assignments')
            .select(`
        projects(
          account_id,
          accounts(id, name, status)
        )
      `)
            .eq('user_id', userId)
            .is('removed_at', null);
        projectAssignments?.forEach((pa) => {
            const project = Array.isArray(pa.projects) ? pa.projects[0] : pa.projects;
            if (project?.accounts) {
                const account = Array.isArray(project.accounts) ? project.accounts[0] : project.accounts;
                if (account && !accountMap.has(account.id)) {
                    accountMap.set(account.id, account);
                }
            }
        });
        const accountIds = Array.from(accountMap.keys());
        if (accountIds.length === 0) {
            return server_1.NextResponse.json({
                success: true,
                data: {
                    accounts: [],
                    totalAccounts: 0,
                },
            });
        }
        // Get project counts per account
        const { data: projects } = await supabase
            .from('projects')
            .select('id, account_id, status, updated_at')
            .in('account_id', accountIds);
        // Build account data with project counts
        const accountsWithProjects = [];
        for (const account of accountMap.values()) {
            const accountProjects = projects?.filter((p) => p.account_id === account.id) || [];
            const activeProjects = accountProjects.filter((p) => ['planning', 'in_progress', 'review'].includes(p.status));
            // Find most recent activity
            const sortedByActivity = [...accountProjects].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
            accountsWithProjects.push({
                id: account.id,
                name: account.name,
                status: account.status,
                projectCount: accountProjects.length,
                activeProjectCount: activeProjects.length,
                lastActivity: sortedByActivity[0]?.updated_at,
            });
        }
        // Sort by active project count, then by name
        accountsWithProjects.sort((a, b) => {
            if (b.activeProjectCount !== a.activeProjectCount) {
                return b.activeProjectCount - a.activeProjectCount;
            }
            return a.name.localeCompare(b.name);
        });
        return server_1.NextResponse.json({
            success: true,
            data: {
                accounts: accountsWithProjects,
                totalAccounts: accountsWithProjects.length,
            },
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/dashboard/my-accounts', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
