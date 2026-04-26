"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accountService = void 0;
const supabase_1 = require("./supabase");
// Helper functions for status mapping
const getStatusDisplayName = (status) => {
    const statusMap = {
        'planning': 'Planning',
        'in_progress': 'In Progress',
        'review': 'Review',
        'complete': 'Complete',
        'on_hold': 'On Hold'
    };
    return statusMap[status] || 'Planning';
};
const getStatusColor = (status) => {
    const colorMap = {
        'planning': '#6B7280',
        'in_progress': '#3B82F6',
        'review': '#F59E0B',
        'complete': '#10B981',
        'on_hold': '#EF4444'
    };
    return colorMap[status] || '#6B7280';
};
class AccountService {
    // Get account by ID with related data
    async getAccountById(accountId, userMap, supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return null;
            }
            const { data: account, error: accountError } = await supabase
                .from('accounts')
                .select(`
          *,
          user_profiles(*)
        `)
                .eq('id', accountId)
                .single();
            if (accountError) {
                return null;
            }
            if (!account)
                return null;
            const typedAccount = account;
            // Get projects for this account
            const projects = await this.getAccountProjects(accountId, userMap, supabase);
            return {
                ...typedAccount,
                projects,
                account_manager: typedAccount.user_profiles,
            };
        }
        catch {
            return null;
        }
    }
    // Get all accounts
    async getAllAccounts(supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return [];
            }
            const { data, error } = await supabase
                .from('accounts')
                .select('*')
                .order('name');
            if (error) {
                return [];
            }
            return data || [];
        }
        catch {
            return [];
        }
    }
    // Check if a user can edit a specific project
    async canUserEditProject(userId, projectId, supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return false;
            }
            // First, check if user is superadmin (bypasses all permission checks)
            const { data: userProfile } = await supabase
                .from('user_profiles')
                .select('is_superadmin')
                .eq('id', userId)
                .single();
            if (userProfile?.is_superadmin) {
                return true;
            }
            // Check if user has EDIT_ALL_PROJECTS permission or is Superadmin role
            // Get user's roles and permissions
            const { data: userRoles, error: rolesError } = await supabase
                .from('user_roles')
                .select(`
          role_id,
          roles(id, name, permissions, is_system_role)
        `)
                .eq('user_id', userId);
            if (!rolesError && userRoles) {
                const typedUserRoles = userRoles;
                for (const ur of typedUserRoles) {
                    const role = ur.roles;
                    if (!role)
                        continue;
                    // Check if role is a system superadmin role
                    if (role.is_system_role === true && role.name?.toLowerCase() === 'superadmin') {
                        return true;
                    }
                    const permissions = role.permissions;
                    if (!permissions)
                        continue;
                    // Check for MANAGE_ALL_PROJECTS permission (consolidated from edit_all_projects in Phase 8-9)
                    if (permissions.manage_all_projects === true || permissions.edit_all_projects === true) {
                        return true;
                    }
                }
            }
            const { data: project, error: projectError } = await supabase
                .from('projects')
                .select(`
          id,
          created_by,
          assigned_user_id,
          account_id
        `)
                .eq('id', projectId)
                .single();
            if (projectError || !project) {
                return false;
            }
            const typedProject = project;
            // Check if user is the project creator
            if (typedProject.created_by === userId) {
                return true;
            }
            // Check if user is the assigned_user_id on the project (legacy field)
            if (typedProject.assigned_user_id === userId) {
                return true;
            }
            // Check if user is the account manager (separate query to avoid RLS issues)
            if (typedProject.account_id) {
                const { data: account } = await supabase
                    .from('accounts')
                    .select('account_manager_id')
                    .eq('id', typedProject.account_id)
                    .maybeSingle();
                if (account?.account_manager_id === userId) {
                    return true;
                }
            }
            // Check if user has EDIT_PROJECT permission AND is assigned to this project
            if (userRoles) {
                const typedUserRoles = userRoles;
                for (const ur of typedUserRoles) {
                    const role = ur.roles;
                    if (!role)
                        continue;
                    const permissions = role.permissions;
                    if (!permissions)
                        continue;
                    if (permissions.edit_project === true || permissions.manage_projects === true) {
                        // Check if user is actively assigned to this project via project_assignments
                        const { data: assignment } = await supabase
                            .from('project_assignments')
                            .select('id')
                            .eq('project_id', projectId)
                            .eq('user_id', userId)
                            .is('removed_at', null)
                            .maybeSingle();
                        if (assignment) {
                            return true;
                        }
                    }
                }
            }
            // Stakeholders have read-only access, not edit access
            return false;
        }
        catch {
            return false;
        }
    }
    // Check if a user can access a specific account
    async canUserAccessAccount(userId, accountId, supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return false;
            }
            // Check if user is the account manager
            const { data: managedAccount, error: managedError } = await supabase
                .from('accounts')
                .select('id')
                .eq('id', accountId)
                .eq('account_manager_id', userId)
                .single();
            if (managedError && managedError.code !== 'PGRST116') {
                return false;
            }
            if (managedAccount) {
                return true;
            }
            // Check if user is a member of this account (via account_members table)
            const { data: accountMember, error: memberError } = await supabase
                .from('account_members')
                .select('id')
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .single();
            if (memberError && memberError.code !== 'PGRST116' && memberError.code !== '42P01') {
                // Continue checking other access methods
            }
            if (accountMember) {
                return true;
            }
            // Check if user has projects in this account (as creator or assignee)
            const { data: projectAccess, error: projectError } = await supabase
                .from('projects')
                .select('id')
                .eq('account_id', accountId)
                .or(`created_by.eq.${userId},assigned_user_id.eq.${userId}`)
                .limit(1);
            if (projectError) {
                return false;
            }
            // Also check if user is a stakeholder on any project in this account
            if (!projectAccess || projectAccess.length === 0) {
                const { data: stakeholderAccess, error: stakeholderError } = await supabase
                    .from('project_stakeholders')
                    .select('project_id, projects!inner(account_id)')
                    .eq('user_id', userId)
                    .eq('projects.account_id', accountId)
                    .limit(1);
                if (stakeholderError) {
                    return false;
                }
                return (stakeholderAccess && stakeholderAccess.length > 0);
            }
            return (projectAccess && projectAccess.length > 0);
        }
        catch {
            return false;
        }
    }
    // Check if user has FULL (edit) access to account (not just read-only via project stakeholder)
    async hasFullAccountAccess(userId, accountId, supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return false;
            }
            // Check if user is the account manager
            const { data: managedAccount, error: managedError } = await supabase
                .from('accounts')
                .select('id')
                .eq('id', accountId)
                .eq('account_manager_id', userId)
                .single();
            if (managedError && managedError.code !== 'PGRST116') {
                return false;
            }
            if (managedAccount) {
                return true;
            }
            // Check if user is a member of this account (via account_members table)
            // Account members have full access to their assigned accounts
            const { data: accountMember, error: memberError } = await supabase
                .from('account_members')
                .select('id')
                .eq('account_id', accountId)
                .eq('user_id', userId)
                .single();
            if (memberError && memberError.code !== 'PGRST116' && memberError.code !== '42P01') {
                // Continue - don't fail the check
            }
            if (accountMember) {
                return true;
            }
            return false;
        }
        catch {
            return false;
        }
    }
    // Get accounts that a user has access to (through projects, membership, or as account manager)
    async getUserAccounts(userId, supabaseClient) {
        try {
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return [];
            }
            // Get accounts where user is the account manager
            const { data: managedAccounts, error: managedError } = await supabase
                .from('accounts')
                .select('*')
                .eq('account_manager_id', userId)
                .order('name');
            if (managedError) {
                return [];
            }
            // Get accounts where user is a member (via account_members table)
            let memberAccounts = [];
            const { data: accountMemberships, error: membershipError } = await supabase
                .from('account_members')
                .select('account_id')
                .eq('user_id', userId);
            if (membershipError && membershipError.code !== '42P01') {
                // Continue - don't fail the whole query
            }
            else if (accountMemberships && accountMemberships.length > 0) {
                const typedMemberships = accountMemberships;
                const memberAccountIds = typedMemberships.map((am) => am.account_id);
                // Fetch the actual account data
                const { data: memberAccountData, error: memberAccountDataError } = await supabase
                    .from('accounts')
                    .select('*')
                    .in('id', memberAccountIds);
                if (!memberAccountDataError && memberAccountData) {
                    memberAccounts = memberAccountData;
                }
            }
            let createdProjectAccountIds = [];
            const { data: createdProjects, error: createdProjectError } = await supabase
                .from('projects')
                .select('account_id')
                .eq('created_by', userId);
            if (!createdProjectError && createdProjects) {
                const typedProjects = createdProjects;
                createdProjectAccountIds = typedProjects.map((p) => p.account_id).filter(Boolean);
            }
            // Get accounts where user is assigned to projects (as assignee)
            let assignedProjectAccountIds = [];
            const { data: assignedProjects, error: assignedProjectError } = await supabase
                .from('projects')
                .select('account_id')
                .eq('assigned_user_id', userId);
            if (!assignedProjectError && assignedProjects) {
                const typedAssigned = assignedProjects;
                assignedProjectAccountIds = typedAssigned.map((p) => p.account_id).filter(Boolean);
            }
            // Get accounts via projects the user is assigned to
            // First get project IDs from assignments, then query projects with account join
            // This works because PM has VIEW_PROJECTS permission
            let projectAssignmentAccounts = [];
            const { data: projectAssignments, error: projectAssignmentsError } = await supabase
                .from('project_assignments')
                .select('project_id')
                .eq('user_id', userId)
                .is('removed_at', null);
            if (!projectAssignmentsError && projectAssignments && projectAssignments.length > 0) {
                const projectIds = projectAssignments.map((pa) => pa.project_id).filter(Boolean);
                // Now query projects directly - PM has VIEW_PROJECTS permission
                // The accounts join should work from projects table
                const { data: projects, error: projectsError } = await supabase
                    .from('projects')
                    .select(`
            id,
            account_id,
            accounts(id, name, description, status, primary_contact_email, primary_contact_name, account_manager_id, service_tier, created_at, updated_at)
          `)
                    .in('id', projectIds);
                if (!projectsError && projects && projects.length > 0) {
                    // Extract account objects from projects
                    const accountsFromProjects = projects
                        .map((p) => {
                        const account = Array.isArray(p.accounts) ? p.accounts[0] : p.accounts;
                        return account;
                    })
                        .filter((a) => a && a.id);
                    // Deduplicate by account ID
                    const seenIds = new Set();
                    projectAssignmentAccounts = accountsFromProjects.filter((a) => {
                        if (seenIds.has(a.id))
                            return false;
                        seenIds.add(a.id);
                        return true;
                    });
                }
            }
            // Combine all accounts - use full account objects where available
            const managedAccountsList = (managedAccounts || []);
            const memberAccountsList = (memberAccounts || []);
            // Start with accounts we already have as full objects
            const allAccounts = [
                ...managedAccountsList,
                ...memberAccountsList,
                ...projectAssignmentAccounts
            ];
            // Get IDs of accounts we still need to fetch (from created/assigned project refs)
            const existingIds = new Set(allAccounts.map(a => a.id));
            const idsToFetch = [...createdProjectAccountIds, ...assignedProjectAccountIds]
                .filter(id => id && !existingIds.has(id));
            // Fetch remaining accounts if needed (may be blocked by RLS but try anyway)
            if (idsToFetch.length > 0) {
                const { data: additionalAccounts } = await supabase
                    .from('accounts')
                    .select('*')
                    .in('id', idsToFetch);
                if (additionalAccounts) {
                    allAccounts.push(...additionalAccounts);
                }
            }
            // Remove duplicates based on account ID
            const uniqueAccounts = allAccounts.filter((account, index, self) => index === self.findIndex((a) => a.id === account.id));
            return uniqueAccounts;
        }
        catch {
            return [];
        }
    }
    // Get projects for a specific account
    // Pass a supabase client to ensure proper auth context (server or client)
    async getAccountProjects(accountId, userMap, supabaseClient) {
        try {
            // Use provided client, or fall back to singleton (less reliable)
            const supabase = supabaseClient || (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return [];
            }
            const { data, error } = await supabase
                .from('projects')
                .select('*')
                .eq('account_id', accountId)
                .order('created_at', { ascending: false });
            if (error) {
                return [];
            }
            const typedProjects = (data || []);
            // Fetch assigned user data separately for projects that have assigned users
            const projectsWithAssignedUsers = typedProjects.filter((p) => p.assigned_user_id);
            const assignedUserIds = projectsWithAssignedUsers.map((p) => p.assigned_user_id);
            let assignedUsersMap = {};
            if (assignedUserIds.length > 0) {
                // If userMap is provided, use it instead of querying the database
                if (userMap) {
                    assignedUsersMap = assignedUserIds.reduce((acc, userId) => {
                        if (userMap[userId]) {
                            acc[userId] = userMap[userId];
                        }
                        return acc;
                    }, {});
                }
                else {
                    // Use the same authenticated supabase client that was passed in
                    if (!supabase) {
                        return [];
                    }
                    // Try the same approach as auth system
                    const { data: singleUserData, error: singleUserError } = await supabase
                        .from('user_profiles')
                        .select('id, name, email, image')
                        .eq('id', assignedUserIds[0])
                        .single();
                    // Try the original approach
                    const { data: usersData, error: usersError } = await supabase
                        .from('user_profiles')
                        .select('id, name, email, image')
                        .in('id', assignedUserIds);
                    // Prefer multiple user lookup (gets all users), fall back to single user lookup
                    if (!usersError && usersData && usersData.length > 0) {
                        const typedUsers = usersData;
                        assignedUsersMap = typedUsers.reduce((acc, user) => {
                            acc[user.id] = user;
                            return acc;
                        }, {});
                    }
                    else if (!singleUserError && singleUserData) {
                        assignedUsersMap[assignedUserIds[0]] = singleUserData;
                    }
                }
            }
            // Get departments for each project via project_assignments
            const projectIds = typedProjects.map((p) => p.id);
            const departmentsByProject = {};
            // Fetch workflow steps for projects
            const workflowSteps = {};
            if (projectIds.length > 0) {
                const { data: workflowData, error: workflowError } = await supabase
                    .from('workflow_instances')
                    .select(`
            project_id,
            current_node_id,
            workflow_nodes (
              label
            )
          `)
                    .in('project_id', projectIds)
                    .eq('status', 'active');
                if (!workflowError && workflowData) {
                    const typedWorkflow = workflowData;
                    typedWorkflow.forEach((instance) => {
                        const nodes = instance.workflow_nodes;
                        if (instance.project_id && nodes && typeof nodes.label === 'string') {
                            workflowSteps[instance.project_id] = nodes.label;
                        }
                    });
                }
            }
            if (projectIds.length > 0) {
                const { data: assignments, error: assignmentsError } = await supabase
                    .from('project_assignments')
                    .select(`
            project_id,
            user_id,
            user_roles!user_id(
              role_id,
              roles!role_id(
                department_id,
                departments (
                  id,
                  name
                )
              )
            )
          `)
                    .in('project_id', projectIds)
                    .is('removed_at', null);
                if (!assignmentsError && assignments) {
                    const typedAssignments = assignments;
                    // Build a map of project_id -> unique departments
                    typedAssignments.forEach((assignment) => {
                        const projectId = assignment.project_id;
                        if (!departmentsByProject[projectId]) {
                            departmentsByProject[projectId] = [];
                        }
                        // Extract departments from user roles
                        const userRoles = assignment.user_roles || [];
                        userRoles.forEach((userRole) => {
                            const role = userRole.roles;
                            if (role && role.departments) {
                                const dept = role.departments;
                                // Check if department already exists for this project
                                const exists = departmentsByProject[projectId].some((d) => d.id === dept.id);
                                if (!exists) {
                                    departmentsByProject[projectId].push(dept);
                                }
                            }
                        });
                    });
                }
            }
            const mappedProjects = typedProjects.map((project) => {
                const projectId = project.id;
                const assignedUserId = project.assigned_user_id;
                const assignedUsers = assignedUserId && assignedUsersMap[assignedUserId]
                    ? [assignedUsersMap[assignedUserId]]
                    : [];
                const status = project.status;
                return {
                    ...project,
                    departments: departmentsByProject[projectId] || [],
                    assigned_users: assignedUsers,
                    status_info: {
                        id: status,
                        name: getStatusDisplayName(status),
                        color: getStatusColor(status)
                    },
                    workflow_step: workflowSteps[projectId] || null,
                };
            });
            return mappedProjects;
        }
        catch {
            return [];
        }
    }
    // Get account metrics
    async getAccountMetrics(accountId, supabaseClient) {
        try {
            const projects = await this.getAccountProjects(accountId, undefined, supabaseClient);
            const now = new Date();
            const activeProjects = projects.filter((p) => p.status_info.name !== 'Complete' && p.status_info.name !== 'Cancelled').length;
            const completedProjects = projects.filter((p) => p.status_info.name === 'Complete').length;
            const totalProjects = projects.length;
            // Upcoming deadlines - only count non-completed projects with deadlines in next 7 days
            const upcomingDeadlines = projects.filter((p) => {
                if (!p.end_date)
                    return false;
                // IMPORTANT: Exclude completed projects from deadline counts
                if (p.status_info.name === 'Complete' || p.status_info.name === 'Cancelled')
                    return false;
                const endDate = new Date(p.end_date);
                const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                return daysUntilDeadline > 0 && daysUntilDeadline <= 7;
            }).length;
            // Overdue projects - only count non-completed projects that are past due
            const overdueProjects = projects.filter((p) => {
                if (!p.end_date)
                    return false;
                // IMPORTANT: Exclude completed projects from overdue counts
                if (p.status_info.name === 'Complete' || p.status_info.name === 'Cancelled')
                    return false;
                const endDate = new Date(p.end_date);
                return endDate < now;
            }).length;
            // Count actual pending approvals from workflow instances for this account's projects
            let pendingApprovals = 0;
            if (supabaseClient && projects.length > 0) {
                const supabase = supabaseClient;
                const projectIds = projects.map((p) => p.id);
                // Query workflow instances for account's projects that are waiting on approval/form nodes
                const { data: workflowInstances, error: workflowError } = await supabase
                    .from('workflow_instances')
                    .select(`
            id,
            project_id,
            workflow_nodes(node_type)
          `)
                    .in('project_id', projectIds)
                    .eq('status', 'active');
                if (!workflowError && workflowInstances) {
                    const typedInstances = workflowInstances;
                    // Count instances where current node is an approval or form type
                    pendingApprovals = typedInstances.filter((instance) => {
                        const nodes = instance.workflow_nodes;
                        const nodeType = nodes?.node_type;
                        return nodeType === 'approval' || nodeType === 'form';
                    }).length;
                }
            }
            // Calculate health score based on various factors
            let healthScore = 100;
            if (overdueProjects > 0)
                healthScore -= overdueProjects * 20;
            if (upcomingDeadlines > 3)
                healthScore -= (upcomingDeadlines - 3) * 5;
            if (pendingApprovals > 3)
                healthScore -= (pendingApprovals - 3) * 10;
            healthScore = Math.max(0, healthScore);
            return {
                activeProjects,
                completedProjects,
                totalProjects,
                upcomingDeadlines,
                overdueProjects,
                pendingApprovals,
                healthScore,
            };
        }
        catch {
            return {
                activeProjects: 0,
                completedProjects: 0,
                totalProjects: 0,
                upcomingDeadlines: 0,
                overdueProjects: 0,
                pendingApprovals: 0,
                healthScore: 0,
            };
        }
    }
    // Get urgent items for an account
    async getUrgentItems(accountId, supabaseClient) {
        try {
            const projects = await this.getAccountProjects(accountId, undefined, supabaseClient);
            const now = new Date();
            const urgentItems = [];
            projects.forEach((project) => {
                // Check for projects marked as URGENT priority
                if (project.priority === 'urgent' && project.status_info.name !== 'Complete') {
                    urgentItems.push({
                        id: `urgent-${project.id}`,
                        type: 'project',
                        title: `URGENT: ${project.name}`,
                        description: project.description || 'High priority project requiring immediate attention',
                        priority: 'high',
                        dueDate: project.end_date ? new Date(project.end_date) : new Date(),
                        projectId: project.id,
                    });
                }
                // Check for overdue projects
                if (project.end_date) {
                    const endDate = new Date(project.end_date);
                    const daysOverdue = Math.ceil((now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysOverdue > 0 && project.status_info.name !== 'Complete') {
                        urgentItems.push({
                            id: `overdue-${project.id}`,
                            type: 'project',
                            title: `Overdue: ${project.name}`,
                            description: `Project is ${daysOverdue} days overdue`,
                            priority: 'high',
                            dueDate: endDate,
                            projectId: project.id,
                        });
                    }
                }
                // Check for projects due soon
                if (project.end_date) {
                    const endDate = new Date(project.end_date);
                    const daysUntilDeadline = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    if (daysUntilDeadline > 0 && daysUntilDeadline <= 3 && project.status_info.name !== 'Complete') {
                        urgentItems.push({
                            id: `due-soon-${project.id}`,
                            type: 'project',
                            title: `Due Soon: ${project.name}`,
                            description: `Project due in ${daysUntilDeadline} days`,
                            priority: daysUntilDeadline === 1 ? 'high' : 'medium',
                            dueDate: endDate,
                            projectId: project.id,
                        });
                    }
                }
            });
            // Sort by priority and due date
            return urgentItems.sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                    return priorityOrder[a.priority] - priorityOrder[b.priority];
                }
                return a.dueDate.getTime() - b.dueDate.getTime();
            });
        }
        catch {
            return [];
        }
    }
    // Create a new project for an account
    async createProject(accountId, projectData, createdBy) {
        try {
            const supabase = (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return null;
            }
            const insertData = {
                name: projectData.name,
                description: projectData.description || null,
                account_id: accountId,
                priority: 'medium',
                start_date: projectData.start_date || null,
                end_date: projectData.end_date || null,
                status: (projectData.status || 'planning'),
                created_by: createdBy || null,
                assigned_user_id: projectData.assigned_user_id || null,
            };
            const { data, error } = await supabase
                .from('projects')
                .insert(insertData)
                .select()
                .single();
            if (error) {
                return null;
            }
            const typedData = data;
            return typedData;
        }
        catch {
            return null;
        }
    }
    // Update project
    async updateProject(projectId, updates) {
        try {
            const supabase = (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return null;
            }
            // First, let's check if the project exists
            const { error: fetchError } = await supabase
                .from('projects')
                .select('*')
                .eq('id', projectId)
                .single();
            if (fetchError) {
                return null;
            }
            // Convert updates to proper type, allowing partial updates
            const updateData = {};
            const updateKeys = Object.keys(updates);
            for (const key of updateKeys) {
                const value = updates[key];
                if (value !== undefined) {
                    updateData[key] = value;
                }
            }
            const { data, error } = await supabase
                .from('projects')
                .update(updateData)
                .eq('id', projectId)
                .select()
                .single();
            if (error) {
                return null;
            }
            return data;
        }
        catch {
            return null;
        }
    }
    // Delete project
    async deleteProject(projectId) {
        try {
            const supabase = (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return false;
            }
            const { error } = await supabase
                .from('projects')
                .delete()
                .eq('id', projectId);
            if (error) {
                return false;
            }
            return true;
        }
        catch {
            return false;
        }
    }
    // Get all users for assignment
    async getAllUsers() {
        try {
            const supabase = (0, supabase_1.createClientSupabase)();
            if (!supabase) {
                return [];
            }
            // Get all users with their roles, account memberships, and department memberships
            const { data: users, error: usersError } = await supabase
                .from('user_profiles')
                .select(`
          *,
          user_roles!user_id(
            role_id,
            roles!role_id(
              id,
              name,
              department_id
            )
          ),
          account_members(
            account_id
          )
        `)
                .order('name');
            // If the complex query fails, fall back to a simpler approach with manual filtering
            if (usersError || !users) {
                const { data: simpleUsers, error: simpleError } = await supabase
                    .from('user_profiles')
                    .select('*')
                    .order('name');
                if (simpleError) {
                    return [];
                }
                // Now manually check each user for roles, account memberships, and department memberships
                const filteredUsers = [];
                const typedSimpleUsers = (simpleUsers || []);
                for (const user of typedSimpleUsers) {
                    // Check if user has any roles
                    const { data: userRoles } = await supabase
                        .from('user_roles')
                        .select('role_id, roles:role_id(id, name, department_id)')
                        .eq('user_id', user.id);
                    // Check if user has any account memberships
                    const { data: accountMembers } = await supabase
                        .from('account_members')
                        .select('account_id')
                        .eq('user_id', user.id);
                    const typedUserRoles = (userRoles || []);
                    const hasRoles = typedUserRoles.length > 0;
                    const hasAccountMemberships = accountMembers && accountMembers.length > 0;
                    const hasDepartmentMemberships = typedUserRoles.some((ur) => {
                        const roles = ur.roles;
                        return roles && roles.department_id;
                    });
                    const hasAnyMembership = hasRoles || hasAccountMemberships || hasDepartmentMemberships;
                    if (hasAnyMembership) {
                        filteredUsers.push(user);
                    }
                }
                return filteredUsers;
            }
            if (usersError) {
                return [];
            }
            if (!users || users.length === 0) {
                return [];
            }
            const typedUsers = users;
            // Filter users who have at least one role, account membership, or department membership
            const filteredUsers = typedUsers.filter((user) => {
                const userRoles = user.user_roles;
                const accountMembers = user.account_members;
                // Check if user has any roles
                const hasRoles = userRoles && userRoles.length > 0;
                // Check if user has any account memberships
                const hasAccountMemberships = accountMembers && accountMembers.length > 0;
                // Check if user has any department memberships through roles
                const hasDepartmentMemberships = userRoles?.some((ur) => {
                    const roles = ur.roles;
                    return roles && roles.department_id;
                }) || false;
                // User must have at least one of: roles, account memberships, or department memberships
                return hasRoles || hasAccountMemberships || hasDepartmentMemberships;
            });
            // Clean up the data structure to match the expected User interface
            const cleanedUsers = filteredUsers.map((user) => ({
                id: user.id,
                name: user.name,
                email: user.email,
                image: user.image,
                bio: user.bio,
                skills: user.skills,
                workload_sentiment: user.workload_sentiment,
                is_superadmin: user.is_superadmin,
                created_at: user.created_at,
                updated_at: user.updated_at
            }));
            return cleanedUsers;
        }
        catch {
            return [];
        }
    }
}
// Export singleton instance
exports.accountService = new AccountService();
