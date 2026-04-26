"use strict";
/**
 * API Route: Capacity Metrics
 * Endpoints for retrieving capacity analytics and metrics
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const capacity_service_1 = require("@/lib/services/capacity-service");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
const debug_logger_1 = require("@/lib/debug-logger");
/**
 * GET /api/capacity
 * Get capacity metrics
 * Query params: type (user|department|project|org), id, weekStartDate
 */
async function GET(request) {
    try {
        const supabase = (0, supabase_server_1.createApiSupabaseClient)(request);
        if (!supabase) {
            return server_1.NextResponse.json({ error: 'Database connection not available' }, { status: 500 });
        }
        // Get current user
        const userProfile = await (0, supabase_server_1.getUserProfileFromRequest)(supabase);
        if (!userProfile) {
            return server_1.NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type') ?? 'user';
        const id = searchParams.get('id');
        // Get Monday of current week as default
        const getWeekStartDate = (date = new Date()) => {
            const d = new Date(date);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            return monday.toISOString().split('T')[0];
        };
        const weekStartDate = searchParams.get('weekStartDate') ?? getWeekStartDate();
        let metrics = null;
        switch (type) {
            case 'user': {
                const userId = id ?? userProfile.id;
                // Permission check
                const isOwnData = userId === userProfile.id;
                if (!isOwnData) {
                    const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
                    const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
                    if (!canViewTeam && !canViewAll) {
                        return server_1.NextResponse.json({ error: 'Insufficient permissions to view other users\' capacity' }, { status: 403 });
                    }
                }
                metrics = await capacity_service_1.capacityService.getUserCapacityMetrics(userId, weekStartDate, admin);
                break;
            }
            case 'department': {
                if (!id) {
                    return server_1.NextResponse.json({ error: 'Department ID required' }, { status: 400 });
                }
                // Permission check
                const canViewTeam = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_TEAM_CAPACITY, undefined, admin);
                const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
                if (!canViewTeam && !canViewAll) {
                    return server_1.NextResponse.json({ error: 'Insufficient permissions to view department capacity' }, { status: 403 });
                }
                metrics = await capacity_service_1.capacityService.getDepartmentCapacityMetrics(id, weekStartDate, admin);
                break;
            }
            case 'project': {
                if (!id) {
                    return server_1.NextResponse.json({ error: 'Project ID required' }, { status: 400 });
                }
                // Check if user can view this project
                const canView = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_PROJECTS, { projectId: id }, admin);
                if (!canView) {
                    return server_1.NextResponse.json({ error: 'Insufficient permissions to view project capacity' }, { status: 403 });
                }
                metrics = await capacity_service_1.capacityService.getProjectCapacityMetrics(id, weekStartDate, admin);
                break;
            }
            case 'org': {
                // Permission check: VIEW_ALL_CAPACITY required
                const canViewAll = await (0, permission_checker_1.hasPermission)(userProfile, permissions_1.Permission.VIEW_ALL_CAPACITY, undefined, admin);
                if (!canViewAll) {
                    return server_1.NextResponse.json({ error: 'Insufficient permissions to view organization capacity' }, { status: 403 });
                }
                metrics = await capacity_service_1.capacityService.getOrgCapacityMetrics(weekStartDate, admin);
                break;
            }
            default:
                return server_1.NextResponse.json({ error: 'Invalid type parameter. Must be: user, department, project, or org' }, { status: 400 });
        }
        if (!metrics) {
            return server_1.NextResponse.json({ error: 'Failed to retrieve capacity metrics' }, { status: 500 });
        }
        return server_1.NextResponse.json({
            success: true,
            metrics,
        });
    }
    catch (error) {
        const err = error;
        debug_logger_1.logger.error('Error in GET /api/capacity', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
