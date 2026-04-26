"use strict";
/**
 * API Route: Workflow Analytics
 * Returns workflow efficiency and completion metrics
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
        // Require analytics permission to view workflow analytics
        const hasAnalytics = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.VIEW_ALL_ANALYTICS, undefined, admin);
        const hasWorkflowManage = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.MANAGE_WORKFLOWS, undefined, admin);
        if (!hasAnalytics && !hasWorkflowManage) {
            return server_1.NextResponse.json({ error: 'Insufficient permissions to view workflow analytics' }, { status: 403 });
        }
        const { searchParams } = new URL(request.url);
        const dateRange = (searchParams.get('dateRange') || '30d');
        const { start } = getDateRange(dateRange);
        const startStr = (0, date_fns_1.format)(start, 'yyyy-MM-dd');
        // Fetch workflow data
        const [templatesData, instancesData, historyData, nodesData] = await Promise.all([
            admin.from('workflow_templates').select('id, name, is_active'),
            admin.from('workflow_instances').select('id, workflow_template_id, status, started_at, completed_at'),
            supabase
                .from('workflow_history')
                .select('id, workflow_instance_id, from_node_id, to_node_id, created_at')
                .gte('created_at', startStr),
            admin.from('workflow_nodes').select('id, workflow_template_id, node_type, label'),
        ]);
        const templates = templatesData.data || [];
        const instances = instancesData.data || [];
        const history = historyData.data || [];
        const nodes = nodesData.data || [];
        // Calculate summary metrics
        const activeInstances = instances.filter((i) => i.status === 'active');
        const completedInstances = instances.filter((i) => i.status === 'completed' &&
            i.completed_at &&
            new Date(i.completed_at) >= start);
        const cancelledInstances = instances.filter((i) => i.status === 'cancelled' &&
            i.started_at &&
            new Date(i.started_at) >= start);
        // Calculate average completion time
        let avgCompletionDays = 0;
        const completedWithTimes = completedInstances.filter((i) => i.started_at && i.completed_at);
        if (completedWithTimes.length > 0) {
            const totalDays = completedWithTimes.reduce((sum, i) => {
                const days = (0, date_fns_1.differenceInDays)(new Date(i.completed_at), new Date(i.started_at));
                return sum + Math.max(1, days);
            }, 0);
            avgCompletionDays = Math.round(totalDays / completedWithTimes.length);
        }
        // Status distribution
        const statusCounts = {
            active: activeInstances.length,
            completed: completedInstances.length,
            cancelled: cancelledInstances.length,
        };
        const statusDistribution = [
            { status: 'Active', count: statusCounts.active, color: '#3b82f6' },
            { status: 'Completed', count: statusCounts.completed, color: '#22c55e' },
            { status: 'Cancelled', count: statusCounts.cancelled, color: '#ef4444' },
        ].filter(s => s.count > 0);
        // Calculate template usage
        const templateUsage = [];
        templates.forEach((template) => {
            const usageCount = instances.filter((i) => i.workflow_template_id === template.id &&
                i.started_at &&
                new Date(i.started_at) >= start).length;
            if (usageCount > 0 || template.is_active) {
                templateUsage.push({
                    name: template.name.length > 20 ? template.name.substring(0, 17) + '...' : template.name,
                    count: usageCount,
                });
            }
        });
        templateUsage.sort((a, b) => b.count - a.count);
        // Calculate bottleneck nodes (nodes with most time spent)
        const nodeTimeMap = new Map();
        // Group history by instance
        const instanceHistory = new Map();
        history.forEach((h) => {
            if (!instanceHistory.has(h.workflow_instance_id)) {
                instanceHistory.set(h.workflow_instance_id, []);
            }
            instanceHistory.get(h.workflow_instance_id).push(h);
        });
        // Calculate time at each node
        instanceHistory.forEach((transitions, _instanceId) => {
            transitions.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
            for (let i = 0; i < transitions.length - 1; i++) {
                const nodeId = transitions[i].to_node_id;
                const startTime = new Date(transitions[i].created_at);
                const endTime = new Date(transitions[i + 1].created_at);
                const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
                if (!nodeTimeMap.has(nodeId)) {
                    nodeTimeMap.set(nodeId, { totalTime: 0, count: 0 });
                }
                const nodeData = nodeTimeMap.get(nodeId);
                nodeData.totalTime += durationHours;
                nodeData.count += 1;
            }
        });
        // Get bottleneck nodes with labels
        const bottleneckNodes = Array.from(nodeTimeMap.entries())
            .map(([nodeId, data]) => {
            const node = nodes.find((n) => n.id === nodeId);
            return {
                id: nodeId,
                name: node?.label || 'Unknown',
                type: node?.node_type || 'unknown',
                avgHours: data.count > 0 ? Math.round((data.totalTime / data.count) * 10) / 10 : 0,
                totalTransitions: data.count,
            };
        })
            .filter(n => n.avgHours > 0)
            .sort((a, b) => b.avgHours - a.avgHours)
            .slice(0, 5);
        // Calculate completion rate
        const totalStartedInRange = instances.filter((i) => i.started_at && new Date(i.started_at) >= start).length;
        const completionRate = totalStartedInRange > 0
            ? Math.round((completedInstances.length / totalStartedInRange) * 100)
            : 0;
        return server_1.NextResponse.json({
            success: true,
            data: {
                summary: {
                    totalTemplates: templates.filter((t) => t.is_active).length,
                    activeInstances: activeInstances.length,
                    completedThisMonth: completedInstances.length,
                    avgCompletionDays,
                    completionRate,
                },
                statusDistribution,
                templateUsage: templateUsage.slice(0, 10),
                bottleneckNodes,
            },
            dateRange,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/analytics/workflows', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
