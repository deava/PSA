"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouter = createRouter;
const express_1 = require("express");
const adapter_1 = require("./adapter");
// -- Accounts --------------------------------------------------------------
const accounts = __importStar(require("./routes-next/accounts/route"));
const accountsMembers = __importStar(require("./routes-next/accounts/members/route"));
const accountById = __importStar(require("./routes-next/accounts/_accountId_/route"));
const accountMembers = __importStar(require("./routes-next/accounts/_accountId_/members/route"));
const accountMemberById = __importStar(require("./routes-next/accounts/_accountId_/members/_userId_/route"));
const accountClientFeedback = __importStar(require("./routes-next/accounts/_accountId_/client-feedback/route"));
const accountClientInvites = __importStar(require("./routes-next/accounts/_accountId_/client-invites/route"));
const accountInviteClient = __importStar(require("./routes-next/accounts/_accountId_/invite-client/route"));
const accountKanbanConfig = __importStar(require("./routes-next/accounts/_accountId_/kanban-config/route"));
// -- Projects --------------------------------------------------------------
const projects = __importStar(require("./routes-next/projects/route"));
const projectById = __importStar(require("./routes-next/projects/_projectId_/route"));
const projectAssignments = __importStar(require("./routes-next/projects/_projectId_/assignments/route"));
const projectComplete = __importStar(require("./routes-next/projects/_projectId_/complete/route"));
const projectReopen = __importStar(require("./routes-next/projects/_projectId_/reopen/route"));
const projectIssues = __importStar(require("./routes-next/projects/_projectId_/issues/route"));
const projectIssueById = __importStar(require("./routes-next/projects/_projectId_/issues/_issueId_/route"));
const projectStakeholders = __importStar(require("./routes-next/projects/_projectId_/stakeholders/route"));
const projectUpdates = __importStar(require("./routes-next/projects/_projectId_/updates/route"));
const projectUpdateById = __importStar(require("./routes-next/projects/_projectId_/updates/_updateId_/route"));
const projectUpdatesFeed = __importStar(require("./routes-next/project-updates/route"));
// -- Tasks -----------------------------------------------------------------
const tasks = __importStar(require("./routes-next/tasks/route"));
const taskById = __importStar(require("./routes-next/tasks/_taskId_/route"));
// -- Roles -----------------------------------------------------------------
const roles = __importStar(require("./routes-next/roles/route"));
const rolesReorder = __importStar(require("./routes-next/roles/reorder/route"));
const roleById = __importStar(require("./routes-next/roles/_roleId_/route"));
const roleUsers = __importStar(require("./routes-next/roles/_roleId_/users/route"));
const roleAssignUser = __importStar(require("./routes-next/roles/_roleId_/assign-user/route"));
const roleUnassignUser = __importStar(require("./routes-next/roles/_roleId_/unassign-user/route"));
const roleRemoveUser = __importStar(require("./routes-next/roles/_roleId_/remove-user/_userId_/route"));
// -- Departments -----------------------------------------------------------
const departments = __importStar(require("./routes-next/departments/route"));
const orgDepartments = __importStar(require("./routes-next/org-structure/departments/route"));
const orgRoles = __importStar(require("./routes-next/org-structure/roles/route"));
// -- Users -----------------------------------------------------------------
const users = __importStar(require("./routes-next/users/route"));
const usersApprove = __importStar(require("./routes-next/users/approve/route"));
const usersPending = __importStar(require("./routes-next/users/pending/route"));
const profile = __importStar(require("./routes-next/profile/route"));
// -- Time & Clock ----------------------------------------------------------
const timeEntries = __importStar(require("./routes-next/time-entries/route"));
const clock = __importStar(require("./routes-next/clock/route"));
const clockOut = __importStar(require("./routes-next/clock/out/route"));
const clockDiscard = __importStar(require("./routes-next/clock/discard/route"));
const availability = __importStar(require("./routes-next/availability/route"));
// -- Workflows -------------------------------------------------------------
const workflowsStart = __importStar(require("./routes-next/workflows/start/route"));
const workflowsProgress = __importStar(require("./routes-next/workflows/progress/route"));
const workflowsMyProjects = __importStar(require("./routes-next/workflows/my-projects/route"));
const workflowsMyApprovals = __importStar(require("./routes-next/workflows/my-approvals/route"));
const workflowsMyPipeline = __importStar(require("./routes-next/workflows/my-pipeline/route"));
const workflowsMyPastProjects = __importStar(require("./routes-next/workflows/my-past-projects/route"));
const workflowInstancesStart = __importStar(require("./routes-next/workflows/instances/start/route"));
const workflowInstanceById = __importStar(require("./routes-next/workflows/instances/_id_/route"));
const workflowInstanceActiveSteps = __importStar(require("./routes-next/workflows/instances/_id_/active-steps/route"));
const workflowInstanceHandoff = __importStar(require("./routes-next/workflows/instances/_id_/handoff/route"));
const workflowInstanceHistory = __importStar(require("./routes-next/workflows/instances/_id_/history/route"));
const workflowInstanceNextNodes = __importStar(require("./routes-next/workflows/instances/_id_/next-nodes/route"));
const workflowFormResponses = __importStar(require("./routes-next/workflows/forms/responses/route"));
const workflowFormResponseById = __importStar(require("./routes-next/workflows/forms/responses/_id_/route"));
const workflowHistoryForm = __importStar(require("./routes-next/workflows/history/_historyId_/form/route"));
const workflowStepAssignments = __importStar(require("./routes-next/workflows/steps/assignments/route"));
// -- Admin Workflows -------------------------------------------------------
const adminWorkflowTemplates = __importStar(require("./routes-next/admin/workflows/templates/route"));
const adminWorkflowTemplateById = __importStar(require("./routes-next/admin/workflows/templates/_id_/route"));
const adminWorkflowTemplateConnections = __importStar(require("./routes-next/admin/workflows/templates/_id_/connections/route"));
const adminWorkflowTemplateNodes = __importStar(require("./routes-next/admin/workflows/templates/_id_/nodes/route"));
const adminWorkflowTemplateSteps = __importStar(require("./routes-next/admin/workflows/templates/_id_/steps/route"));
const adminWorkflowConnectionById = __importStar(require("./routes-next/admin/workflows/connections/_connectionId_/route"));
const adminWorkflowNodeById = __importStar(require("./routes-next/admin/workflows/nodes/_nodeId_/route"));
// -- Analytics -------------------------------------------------------------
const analyticsOverview = __importStar(require("./routes-next/analytics/overview/route"));
const analyticsAccounts = __importStar(require("./routes-next/analytics/accounts/route"));
const analyticsProjects = __importStar(require("./routes-next/analytics/projects/route"));
const analyticsTeam = __importStar(require("./routes-next/analytics/team/route"));
const analyticsTime = __importStar(require("./routes-next/analytics/time/route"));
const analyticsWorkflows = __importStar(require("./routes-next/analytics/workflows/route"));
const analyticsNetwork = __importStar(require("./routes-next/analytics/network/route"));
// -- Dashboard -------------------------------------------------------------
const dashMyAccounts = __importStar(require("./routes-next/dashboard/my-accounts/route"));
const dashMyAnalytics = __importStar(require("./routes-next/dashboard/my-analytics/route"));
const dashMyCollaborators = __importStar(require("./routes-next/dashboard/my-collaborators/route"));
const dashMyWorkflows = __importStar(require("./routes-next/dashboard/my-workflows/route"));
const dashPreferences = __importStar(require("./routes-next/dashboard/preferences/route"));
const dashRecentActivity = __importStar(require("./routes-next/dashboard/recent-activity/route"));
const dashTaskCompletionTrend = __importStar(require("./routes-next/dashboard/task-completion-trend/route"));
const dashTimeByProject = __importStar(require("./routes-next/dashboard/time-by-project/route"));
const dashUpcomingDeadlines = __importStar(require("./routes-next/dashboard/upcoming-deadlines/route"));
// -- Capacity --------------------------------------------------------------
const capacity = __importStar(require("./routes-next/capacity/route"));
const capacityAccount = __importStar(require("./routes-next/capacity/account/route"));
const capacityDepartment = __importStar(require("./routes-next/capacity/department/route"));
const capacityHistory = __importStar(require("./routes-next/capacity/history/route"));
const capacityOrganization = __importStar(require("./routes-next/capacity/organization/route"));
// -- Invitations -----------------------------------------------------------
const invitations = __importStar(require("./routes-next/invitations/route"));
const invitationById = __importStar(require("./routes-next/invitations/_id_/route"));
const invitationResend = __importStar(require("./routes-next/invitations/_id_/resend/route"));
const invitationAccept = __importStar(require("./routes-next/invitations/accept/_token_/route"));
// -- Client Portal ---------------------------------------------------------
const clientAcceptInvite = __importStar(require("./routes-next/client/accept-invite/_token_/route"));
const clientPortalProjects = __importStar(require("./routes-next/client/portal/projects/route"));
const clientPortalProjectById = __importStar(require("./routes-next/client/portal/projects/_id_/route"));
const clientPortalProjectApprove = __importStar(require("./routes-next/client/portal/projects/_id_/approve/route"));
const clientPortalProjectFeedback = __importStar(require("./routes-next/client/portal/projects/_id_/feedback/route"));
const clientPortalProjectReject = __importStar(require("./routes-next/client/portal/projects/_id_/reject/route"));
// -- Admin -----------------------------------------------------------------
const adminClientFeedback = __importStar(require("./routes-next/admin/client-feedback/route"));
const adminMoveSystemRoles = __importStar(require("./routes-next/admin/move-system-roles/route"));
const adminRbacDiagnostics = __importStar(require("./routes-next/admin/rbac-diagnostics/route"));
const adminRbacDiagnosticsTest = __importStar(require("./routes-next/admin/rbac-diagnostics/test/route"));
const adminTimeEntries = __importStar(require("./routes-next/admin/time-entries/route"));
const adminTimeEntryById = __importStar(require("./routes-next/admin/time-entries/_id_/route"));
// -- Onboarding ------------------------------------------------------------
const onboardingCheckFirstRun = __importStar(require("./routes-next/onboarding/check-first-run/route"));
const onboardingCompleteSetup = __importStar(require("./routes-next/onboarding/complete-setup/route"));
const onboardingSetupToken = __importStar(require("./routes-next/onboarding/setup-token/route"));
const onboardingTutorialProgress = __importStar(require("./routes-next/onboarding/tutorial-progress/route"));
const onboardingTutorialCheckAction = __importStar(require("./routes-next/onboarding/tutorial-progress/check-action/route"));
// -- Misc ------------------------------------------------------------------
const authPermissions = __importStar(require("./routes-next/auth/permissions/route"));
const setup = __importStar(require("./routes-next/setup/route"));
const bugReports = __importStar(require("./routes-next/bug-reports/route"));
const cronResetDemoData = __importStar(require("./routes-next/cron/reset-demo-data/route"));
// Helper to mount a route module
function mount(router, path, mod, params) {
    if (mod.GET)
        router.get(path, (0, adapter_1.adaptRoute)(mod.GET, params));
    if (mod.POST)
        router.post(path, (0, adapter_1.adaptRoute)(mod.POST, params));
    if (mod.PUT)
        router.put(path, (0, adapter_1.adaptRoute)(mod.PUT, params));
    if (mod.PATCH)
        router.patch(path, (0, adapter_1.adaptRoute)(mod.PATCH, params));
    if (mod.DELETE)
        router.delete(path, (0, adapter_1.adaptRoute)(mod.DELETE, params));
}
function createRouter() {
    const router = (0, express_1.Router)();
    // -- Accounts ----------------------------------------------------------
    mount(router, '/accounts', accounts);
    mount(router, '/accounts/members', accountsMembers);
    mount(router, '/accounts/:accountId', accountById);
    mount(router, '/accounts/:accountId/members', accountMembers);
    mount(router, '/accounts/:accountId/members/:userId', accountMemberById);
    mount(router, '/accounts/:accountId/client-feedback', accountClientFeedback);
    mount(router, '/accounts/:accountId/client-invites', accountClientInvites);
    mount(router, '/accounts/:accountId/invite-client', accountInviteClient);
    mount(router, '/accounts/:accountId/kanban-config', accountKanbanConfig);
    // -- Projects ----------------------------------------------------------
    mount(router, '/projects', projects);
    mount(router, '/projects/:projectId', projectById);
    mount(router, '/projects/:projectId/assignments', projectAssignments);
    mount(router, '/projects/:projectId/complete', projectComplete);
    mount(router, '/projects/:projectId/reopen', projectReopen);
    mount(router, '/projects/:projectId/issues', projectIssues);
    mount(router, '/projects/:projectId/issues/:issueId', projectIssueById);
    mount(router, '/projects/:projectId/stakeholders', projectStakeholders);
    mount(router, '/projects/:projectId/updates', projectUpdates);
    mount(router, '/projects/:projectId/updates/:updateId', projectUpdateById);
    mount(router, '/project-updates', projectUpdatesFeed);
    // -- Tasks -------------------------------------------------------------
    mount(router, '/tasks', tasks);
    mount(router, '/tasks/:taskId', taskById);
    // -- Roles -------------------------------------------------------------
    mount(router, '/roles', roles);
    mount(router, '/roles/reorder', rolesReorder);
    mount(router, '/roles/:roleId', roleById);
    mount(router, '/roles/:roleId/users', roleUsers);
    mount(router, '/roles/:roleId/assign-user', roleAssignUser);
    mount(router, '/roles/:roleId/unassign-user', roleUnassignUser);
    mount(router, '/roles/:roleId/remove-user/:userId', roleRemoveUser);
    // -- Departments -------------------------------------------------------
    mount(router, '/departments', departments);
    mount(router, '/org-structure/departments', orgDepartments);
    mount(router, '/org-structure/roles', orgRoles);
    // -- Users -------------------------------------------------------------
    mount(router, '/users', users);
    mount(router, '/users/approve', usersApprove);
    mount(router, '/users/pending', usersPending);
    mount(router, '/profile', profile);
    // -- Time & Clock ------------------------------------------------------
    mount(router, '/time-entries', timeEntries);
    mount(router, '/clock', clock);
    mount(router, '/clock/out', clockOut);
    mount(router, '/clock/discard', clockDiscard);
    mount(router, '/availability', availability);
    // -- Workflows ---------------------------------------------------------
    mount(router, '/workflows/start', workflowsStart);
    mount(router, '/workflows/progress', workflowsProgress);
    mount(router, '/workflows/my-projects', workflowsMyProjects);
    mount(router, '/workflows/my-approvals', workflowsMyApprovals);
    mount(router, '/workflows/my-pipeline', workflowsMyPipeline);
    mount(router, '/workflows/my-past-projects', workflowsMyPastProjects);
    mount(router, '/workflows/instances/start', workflowInstancesStart);
    mount(router, '/workflows/instances/:id', workflowInstanceById);
    mount(router, '/workflows/instances/:id/active-steps', workflowInstanceActiveSteps);
    mount(router, '/workflows/instances/:id/handoff', workflowInstanceHandoff);
    mount(router, '/workflows/instances/:id/history', workflowInstanceHistory);
    mount(router, '/workflows/instances/:id/next-nodes', workflowInstanceNextNodes);
    mount(router, '/workflows/forms/responses', workflowFormResponses);
    mount(router, '/workflows/forms/responses/:id', workflowFormResponseById);
    mount(router, '/workflows/history/:historyId/form', workflowHistoryForm);
    mount(router, '/workflows/steps/assignments', workflowStepAssignments);
    // -- Admin Workflows ---------------------------------------------------
    mount(router, '/admin/workflows/templates', adminWorkflowTemplates);
    mount(router, '/admin/workflows/templates/:id', adminWorkflowTemplateById);
    mount(router, '/admin/workflows/templates/:id/connections', adminWorkflowTemplateConnections);
    mount(router, '/admin/workflows/templates/:id/nodes', adminWorkflowTemplateNodes);
    mount(router, '/admin/workflows/templates/:id/steps', adminWorkflowTemplateSteps);
    mount(router, '/admin/workflows/connections/:connectionId', adminWorkflowConnectionById);
    mount(router, '/admin/workflows/nodes/:nodeId', adminWorkflowNodeById);
    // -- Analytics ---------------------------------------------------------
    mount(router, '/analytics/overview', analyticsOverview);
    mount(router, '/analytics/accounts', analyticsAccounts);
    mount(router, '/analytics/projects', analyticsProjects);
    mount(router, '/analytics/team', analyticsTeam);
    mount(router, '/analytics/time', analyticsTime);
    mount(router, '/analytics/workflows', analyticsWorkflows);
    mount(router, '/analytics/network', analyticsNetwork);
    // -- Dashboard ---------------------------------------------------------
    mount(router, '/dashboard/my-accounts', dashMyAccounts);
    mount(router, '/dashboard/my-analytics', dashMyAnalytics);
    mount(router, '/dashboard/my-collaborators', dashMyCollaborators);
    mount(router, '/dashboard/my-workflows', dashMyWorkflows);
    mount(router, '/dashboard/preferences', dashPreferences);
    mount(router, '/dashboard/recent-activity', dashRecentActivity);
    mount(router, '/dashboard/task-completion-trend', dashTaskCompletionTrend);
    mount(router, '/dashboard/time-by-project', dashTimeByProject);
    mount(router, '/dashboard/upcoming-deadlines', dashUpcomingDeadlines);
    // -- Capacity ----------------------------------------------------------
    mount(router, '/capacity', capacity);
    mount(router, '/capacity/account', capacityAccount);
    mount(router, '/capacity/department', capacityDepartment);
    mount(router, '/capacity/history', capacityHistory);
    mount(router, '/capacity/organization', capacityOrganization);
    // -- Invitations -------------------------------------------------------
    mount(router, '/invitations', invitations);
    mount(router, '/invitations/accept/:token', invitationAccept);
    mount(router, '/invitations/:id', invitationById);
    mount(router, '/invitations/:id/resend', invitationResend);
    // -- Client Portal -----------------------------------------------------
    mount(router, '/client/accept-invite/:token', clientAcceptInvite);
    mount(router, '/client/portal/projects', clientPortalProjects);
    mount(router, '/client/portal/projects/:id', clientPortalProjectById);
    mount(router, '/client/portal/projects/:id/approve', clientPortalProjectApprove);
    mount(router, '/client/portal/projects/:id/feedback', clientPortalProjectFeedback);
    mount(router, '/client/portal/projects/:id/reject', clientPortalProjectReject);
    // -- Admin -------------------------------------------------------------
    mount(router, '/admin/client-feedback', adminClientFeedback);
    mount(router, '/admin/move-system-roles', adminMoveSystemRoles);
    mount(router, '/admin/rbac-diagnostics', adminRbacDiagnostics);
    mount(router, '/admin/rbac-diagnostics/test', adminRbacDiagnosticsTest);
    mount(router, '/admin/time-entries', adminTimeEntries);
    mount(router, '/admin/time-entries/:id', adminTimeEntryById);
    // -- Onboarding --------------------------------------------------------
    mount(router, '/onboarding/check-first-run', onboardingCheckFirstRun);
    mount(router, '/onboarding/complete-setup', onboardingCompleteSetup);
    mount(router, '/onboarding/setup-token', onboardingSetupToken);
    mount(router, '/onboarding/tutorial-progress', onboardingTutorialProgress);
    mount(router, '/onboarding/tutorial-progress/check-action', onboardingTutorialCheckAction);
    // -- Misc --------------------------------------------------------------
    mount(router, '/auth/permissions', authPermissions);
    mount(router, '/setup', setup);
    mount(router, '/bug-reports', bugReports);
    mount(router, '/cron/reset-demo-data', cronResetDemoData);
    return router;
}
