"use strict";
/**
 * API Route: Account Analytics
 * Returns detailed account/client insights
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.revalidate = exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const date_fns_1 = require("date-fns");
const debug_logger_1 = require("@/lib/debug-logger");
function getDateRange(range) {
    const now = new Date();
    const end = now;
    switch (range) {
        case '7d':
            return { start: (0, date_fns_1.subDays)(now, 7), end };
        case '30d':
            return { start: (0, date_fns_1.subDays)(now, 30), end };
        case '90d':
            return { start: (0, date_fns_1.subDays)(now, 90), end };
        case 'ytd':
            return { start: new Date(now.getFullYear(), 0, 1), end };
        case 'all':
            return { start: new Date(2020, 0, 1), end };
        default:
            return { start: (0, date_fns_1.subDays)(now, 30), end };
    }
}
exports.dynamic = 'force-dynamic';
exports.revalidate = 60;
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
        // Require account analytics or general analytics permission
        const hasAnalytics = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.VIEW_ALL_ACCOUNT_ANALYTICS, undefined, admin);
        const hasAllAnalytics = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.VIEW_ALL_ANALYTICS, undefined, admin);
        if (!hasAnalytics && !hasAllAnalytics) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view account analytics' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const dateRange = (searchParams.get('dateRange') || '30d');
        const { start, end } = getDateRange(dateRange);
        const startStr = (0, date_fns_1.format)(start, 'yyyy-MM-dd');
        const endStr = (0, date_fns_1.format)(end, 'yyyy-MM-dd');
        // Fetch all data in parallel
        const [accountsData, projectsData, timeEntriesData, accountMembersData] = await Promise.all([
            admin.from('accounts').select('id, name, status, created_at'),
            admin.from('projects').select('id, name, account_id, status, estimated_hours, actual_hours'),
            supabase
                .from('time_entries')
                .select('project_id, hours_logged')
                .gte('entry_date', startStr)
                .lte('entry_date', endStr),
            admin.from('account_members').select('account_id, user_id'),
        ]);
        const accounts = accountsData.data || [];
        const projects = projectsData.data || [];
        const timeEntries = timeEntriesData.data || [];
        const accountMembers = accountMembersData.data || [];
        // Calculate project hours from time entries
        const projectHoursMap = new Map();
        timeEntries.forEach((te) => {
            const current = projectHoursMap.get(te.project_id) || 0;
            projectHoursMap.set(te.project_id, current + (te.hours_logged || 0));
        });
        // Calculate account metrics
        const accountMetrics = [];
        accounts.forEach((account) => {
            const accountProjects = projects.filter((p) => p.account_id === account.id);
            const activeProjects = accountProjects.filter((p) => ['planning', 'in_progress', 'review'].includes(p.status));
            const completedProjects = accountProjects.filter((p) => p.status === 'complete');
            let hoursInvested = 0;
            accountProjects.forEach((p) => {
                hoursInvested += projectHoursMap.get(p.id) || 0;
            });
            const teamMembers = accountMembers.filter((am) => am.account_id === account.id);
            accountMetrics.push({
                id: account.id,
                name: account.name,
                status: account.status || 'active',
                projectCount: accountProjects.length,
                activeProjects: activeProjects.length,
                completedProjects: completedProjects.length,
                hoursInvested: Math.round(hoursInvested * 10) / 10,
                teamSize: new Set(teamMembers.map((tm) => tm.user_id)).size,
            });
        });
        // Sort by hours invested
        accountMetrics.sort((a, b) => b.hoursInvested - a.hoursInvested);
        // Calculate status distribution
        const statusCounts = {};
        accounts.forEach((a) => {
            const status = a.status || 'active';
            statusCounts[status] = (statusCounts[status] || 0) + 1;
        });
        const statusDistribution = [
            { status: 'active', count: statusCounts['active'] || 0, color: '#22c55e' },
            { status: 'inactive', count: statusCounts['inactive'] || 0, color: '#94a3b8' },
            { status: 'suspended', count: statusCounts['suspended'] || 0, color: '#ef4444' },
        ].filter(s => s.count > 0);
        // Top accounts by hours
        const topAccountsByHours = accountMetrics
            .slice(0, 10)
            .map(a => ({
            name: a.name.length > 15 ? a.name.substring(0, 12) + '...' : a.name,
            hours: a.hoursInvested,
        }));
        // Summary stats
        const activeAccounts = accounts.filter((a) => a.status === 'active').length;
        const totalHoursInvested = accountMetrics.reduce((sum, a) => sum + a.hoursInvested, 0);
        const totalProjects = projects.length;
        const avgProjectsPerAccount = accounts.length > 0
            ? Math.round((totalProjects / accounts.length) * 10) / 10
            : 0;
        return server_1.NextResponse.json({
            success: true,
            data: {
                summary: {
                    total: accounts.length,
                    active: activeAccounts,
                    totalHoursInvested: Math.round(totalHoursInvested * 10) / 10,
                    avgProjectsPerAccount,
                },
                statusDistribution,
                topAccountsByHours,
                accountDetails: accountMetrics.slice(0, 15),
            },
            dateRange,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/analytics/accounts', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
