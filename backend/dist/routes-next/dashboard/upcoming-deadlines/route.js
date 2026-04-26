"use strict";
/**
 * API Route: Upcoming Deadlines
 * Returns tasks with due dates in the next 14 days
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.dynamic = void 0;
exports.GET = GET;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const date_fns_1 = require("date-fns");
const debug_logger_1 = require("@/lib/debug-logger");
const permission_checker_1 = require("@/lib/permission-checker");
const permissions_1 = require("@/lib/permissions");
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
        const now = new Date();
        const _twoWeeksFromNow = (0, date_fns_1.addDays)(now, 14);
        // Get tasks assigned to user with due dates (including overdue - no max date filter)
        const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select(`
        id,
        name,
        due_date,
        status,
        priority,
        project_id,
        projects(id, name)
      `)
            .eq('assigned_to', userId)
            .not('status', 'eq', 'done')
            .not('due_date', 'is', null)
            .order('due_date', { ascending: true })
            .limit(20);
        if (tasksError) {
            debug_logger_1.logger.error('Error fetching task deadlines', {}, tasksError);
        }
        // Check if user can see all projects
        const canViewAll = await (0, permission_checker_1.checkPermissionHybrid)(userProfile, permissions_1.Permission.VIEW_ALL_PROJECTS, undefined, admin);
        let projects = [];
        if (canViewAll) {
            // User has VIEW_ALL_PROJECTS — show all project deadlines
            const { data: projectData, error: projectsError } = await supabase
                .from('projects')
                .select('id, name, end_date, status, priority, account_id, accounts(name)')
                .not('status', 'eq', 'complete')
                .not('end_date', 'is', null)
                .order('end_date', { ascending: true })
                .limit(20);
            if (projectsError) {
                debug_logger_1.logger.error('Error fetching project deadlines', {}, projectsError);
            }
            else {
                projects = projectData || [];
            }
        }
        else {
            // Get projects the user can see: assigned via project_assignments, assigned_user_id, or created_by
            const { data: assignments } = await supabase
                .from('project_assignments')
                .select('project_id')
                .eq('user_id', userId)
                .is('removed_at', null);
            const assignedProjectIds = new Set(assignments?.map((a) => a.project_id) || []);
            const { data: ownedProjects } = await supabase
                .from('projects')
                .select('id')
                .or(`assigned_user_id.eq.${userId},created_by.eq.${userId}`)
                .not('status', 'eq', 'complete');
            (ownedProjects || []).forEach((p) => assignedProjectIds.add(p.id));
            const projectIds = Array.from(assignedProjectIds);
            if (projectIds.length > 0) {
                const { data: projectData, error: projectsError } = await supabase
                    .from('projects')
                    .select('id, name, end_date, status, priority, account_id, accounts(name)')
                    .in('id', projectIds)
                    .not('status', 'eq', 'complete')
                    .not('end_date', 'is', null)
                    .order('end_date', { ascending: true })
                    .limit(20);
                if (projectsError) {
                    debug_logger_1.logger.error('Error fetching project deadlines', {}, projectsError);
                }
                else {
                    projects = projectData || [];
                }
            }
        }
        const deadlines = [];
        // Add task deadlines
        (tasks || []).forEach((task) => {
            const dueDate = new Date(task.due_date);
            const daysUntil = (0, date_fns_1.differenceInDays)(dueDate, now);
            const project = Array.isArray(task.projects) ? task.projects[0] : task.projects;
            let dueDateLabel = (0, date_fns_1.format)(dueDate, 'MMM d');
            if ((0, date_fns_1.isToday)(dueDate)) {
                dueDateLabel = 'Today';
            }
            else if ((0, date_fns_1.isPast)(dueDate)) {
                dueDateLabel = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
            }
            else if (daysUntil === 1) {
                dueDateLabel = 'Tomorrow';
            }
            else if (daysUntil <= 7) {
                dueDateLabel = `In ${daysUntil} days`;
            }
            deadlines.push({
                id: task.id,
                name: task.name,
                dueDate: task.due_date,
                dueDateLabel,
                projectName: project?.name || 'No Project',
                projectId: task.project_id,
                status: task.status,
                priority: task.priority,
                isOverdue: (0, date_fns_1.isPast)(dueDate) && !(0, date_fns_1.isToday)(dueDate),
                isDueToday: (0, date_fns_1.isToday)(dueDate),
                daysUntilDue: daysUntil,
            });
        });
        // Add project deadlines
        projects.forEach((project) => {
            const dueDate = new Date(project.end_date);
            const daysUntil = (0, date_fns_1.differenceInDays)(dueDate, now);
            const account = Array.isArray(project.accounts) ? project.accounts[0] : project.accounts;
            let dueDateLabel = (0, date_fns_1.format)(dueDate, 'MMM d');
            if ((0, date_fns_1.isToday)(dueDate)) {
                dueDateLabel = 'Today';
            }
            else if ((0, date_fns_1.isPast)(dueDate)) {
                dueDateLabel = `${Math.abs(daysUntil)} day${Math.abs(daysUntil) !== 1 ? 's' : ''} overdue`;
            }
            else if (daysUntil === 1) {
                dueDateLabel = 'Tomorrow';
            }
            else if (daysUntil <= 7) {
                dueDateLabel = `In ${daysUntil} days`;
            }
            deadlines.push({
                id: `project-${project.id}`,
                name: `📁 ${project.name}`,
                dueDate: project.end_date,
                dueDateLabel,
                projectName: account?.name || 'No Account',
                projectId: project.id,
                status: project.status,
                priority: project.priority || 'medium',
                isOverdue: (0, date_fns_1.isPast)(dueDate) && !(0, date_fns_1.isToday)(dueDate),
                isDueToday: (0, date_fns_1.isToday)(dueDate),
                daysUntilDue: daysUntil,
            });
        });
        // Sort by due date (overdue first, then by date)
        deadlines.sort((a, b) => {
            // Overdue items first
            if (a.isOverdue && !b.isOverdue)
                return -1;
            if (!a.isOverdue && b.isOverdue)
                return 1;
            // Then by due date
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        // Count by urgency
        const overdueCount = deadlines.filter(d => d.isOverdue).length;
        const dueTodayCount = deadlines.filter(d => d.isDueToday).length;
        const thisWeekCount = deadlines.filter(d => !d.isOverdue && !d.isDueToday && d.daysUntilDue <= 7).length;
        return server_1.NextResponse.json({
            success: true,
            data: {
                deadlines,
                overdueCount,
                dueTodayCount,
                thisWeekCount,
                totalCount: deadlines.length,
            },
        });
    }
    catch (error) {
        debug_logger_1.logger.error('Error in GET /api/dashboard/upcoming-deadlines', {}, error);
        return server_1.NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
