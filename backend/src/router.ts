import { Router, Request, Response } from 'express';
import { adaptRoute } from './adapter';

// -- Accounts --------------------------------------------------------------
import * as accounts from './routes-next/accounts/route';
import * as accountsMembers from './routes-next/accounts/members/route';
import * as accountById from './routes-next/accounts/_accountId_/route';
import * as accountMembers from './routes-next/accounts/_accountId_/members/route';
import * as accountMemberById from './routes-next/accounts/_accountId_/members/_userId_/route';
import * as accountClientFeedback from './routes-next/accounts/_accountId_/client-feedback/route';
import * as accountClientInvites from './routes-next/accounts/_accountId_/client-invites/route';
import * as accountInviteClient from './routes-next/accounts/_accountId_/invite-client/route';
import * as accountKanbanConfig from './routes-next/accounts/_accountId_/kanban-config/route';

// -- Projects --------------------------------------------------------------
import * as projects from './routes-next/projects/route';
import * as projectById from './routes-next/projects/_projectId_/route';
import * as projectAssignments from './routes-next/projects/_projectId_/assignments/route';
import * as projectComplete from './routes-next/projects/_projectId_/complete/route';
import * as projectReopen from './routes-next/projects/_projectId_/reopen/route';
import * as projectIssues from './routes-next/projects/_projectId_/issues/route';
import * as projectIssueById from './routes-next/projects/_projectId_/issues/_issueId_/route';
import * as projectStakeholders from './routes-next/projects/_projectId_/stakeholders/route';
import * as projectUpdates from './routes-next/projects/_projectId_/updates/route';
import * as projectUpdateById from './routes-next/projects/_projectId_/updates/_updateId_/route';
import * as projectUpdatesFeed from './routes-next/project-updates/route';

// -- Tasks -----------------------------------------------------------------
import * as tasks from './routes-next/tasks/route';
import * as taskById from './routes-next/tasks/_taskId_/route';

// -- Roles -----------------------------------------------------------------
import * as roles from './routes-next/roles/route';
import * as rolesReorder from './routes-next/roles/reorder/route';
import * as roleById from './routes-next/roles/_roleId_/route';
import * as roleUsers from './routes-next/roles/_roleId_/users/route';
import * as roleAssignUser from './routes-next/roles/_roleId_/assign-user/route';
import * as roleUnassignUser from './routes-next/roles/_roleId_/unassign-user/route';
import * as roleRemoveUser from './routes-next/roles/_roleId_/remove-user/_userId_/route';

// -- Departments -----------------------------------------------------------
import * as departments from './routes-next/departments/route';
import * as orgDepartments from './routes-next/org-structure/departments/route';
import * as orgRoles from './routes-next/org-structure/roles/route';

// -- Users -----------------------------------------------------------------
import * as users from './routes-next/users/route';
import * as usersApprove from './routes-next/users/approve/route';
import * as usersPending from './routes-next/users/pending/route';
import * as profile from './routes-next/profile/route';

// -- Time & Clock ----------------------------------------------------------
import * as timeEntries from './routes-next/time-entries/route';
import * as clock from './routes-next/clock/route';
import * as clockOut from './routes-next/clock/out/route';
import * as clockDiscard from './routes-next/clock/discard/route';
import * as availability from './routes-next/availability/route';

// -- Workflows -------------------------------------------------------------
import * as workflowsStart from './routes-next/workflows/start/route';
import * as workflowsProgress from './routes-next/workflows/progress/route';
import * as workflowsMyProjects from './routes-next/workflows/my-projects/route';
import * as workflowsMyApprovals from './routes-next/workflows/my-approvals/route';
import * as workflowsMyPipeline from './routes-next/workflows/my-pipeline/route';
import * as workflowsMyPastProjects from './routes-next/workflows/my-past-projects/route';
import * as workflowInstancesStart from './routes-next/workflows/instances/start/route';
import * as workflowInstanceById from './routes-next/workflows/instances/_id_/route';
import * as workflowInstanceActiveSteps from './routes-next/workflows/instances/_id_/active-steps/route';
import * as workflowInstanceHandoff from './routes-next/workflows/instances/_id_/handoff/route';
import * as workflowInstanceHistory from './routes-next/workflows/instances/_id_/history/route';
import * as workflowInstanceNextNodes from './routes-next/workflows/instances/_id_/next-nodes/route';
import * as workflowFormResponses from './routes-next/workflows/forms/responses/route';
import * as workflowFormResponseById from './routes-next/workflows/forms/responses/_id_/route';
import * as workflowHistoryForm from './routes-next/workflows/history/_historyId_/form/route';
import * as workflowStepAssignments from './routes-next/workflows/steps/assignments/route';

// -- Admin Workflows -------------------------------------------------------
import * as adminWorkflowTemplates from './routes-next/admin/workflows/templates/route';
import * as adminWorkflowTemplateById from './routes-next/admin/workflows/templates/_id_/route';
import * as adminWorkflowTemplateConnections from './routes-next/admin/workflows/templates/_id_/connections/route';
import * as adminWorkflowTemplateNodes from './routes-next/admin/workflows/templates/_id_/nodes/route';
import * as adminWorkflowTemplateSteps from './routes-next/admin/workflows/templates/_id_/steps/route';
import * as adminWorkflowConnectionById from './routes-next/admin/workflows/connections/_connectionId_/route';
import * as adminWorkflowNodeById from './routes-next/admin/workflows/nodes/_nodeId_/route';

// -- Analytics -------------------------------------------------------------
import * as analyticsOverview from './routes-next/analytics/overview/route';
import * as analyticsAccounts from './routes-next/analytics/accounts/route';
import * as analyticsProjects from './routes-next/analytics/projects/route';
import * as analyticsTeam from './routes-next/analytics/team/route';
import * as analyticsTime from './routes-next/analytics/time/route';
import * as analyticsWorkflows from './routes-next/analytics/workflows/route';
import * as analyticsNetwork from './routes-next/analytics/network/route';

// -- Dashboard -------------------------------------------------------------
import * as dashMyAccounts from './routes-next/dashboard/my-accounts/route';
import * as dashMyAnalytics from './routes-next/dashboard/my-analytics/route';
import * as dashMyCollaborators from './routes-next/dashboard/my-collaborators/route';
import * as dashMyWorkflows from './routes-next/dashboard/my-workflows/route';
import * as dashPreferences from './routes-next/dashboard/preferences/route';
import * as dashRecentActivity from './routes-next/dashboard/recent-activity/route';
import * as dashTaskCompletionTrend from './routes-next/dashboard/task-completion-trend/route';
import * as dashTimeByProject from './routes-next/dashboard/time-by-project/route';
import * as dashUpcomingDeadlines from './routes-next/dashboard/upcoming-deadlines/route';

// -- Capacity --------------------------------------------------------------
import * as capacity from './routes-next/capacity/route';
import * as capacityAccount from './routes-next/capacity/account/route';
import * as capacityDepartment from './routes-next/capacity/department/route';
import * as capacityHistory from './routes-next/capacity/history/route';
import * as capacityOrganization from './routes-next/capacity/organization/route';

// -- Invitations -----------------------------------------------------------
import * as invitations from './routes-next/invitations/route';
import * as invitationById from './routes-next/invitations/_id_/route';
import * as invitationResend from './routes-next/invitations/_id_/resend/route';
import * as invitationAccept from './routes-next/invitations/accept/_token_/route';

// -- Client Portal ---------------------------------------------------------
import * as clientAcceptInvite from './routes-next/client/accept-invite/_token_/route';
import * as clientPortalProjects from './routes-next/client/portal/projects/route';
import * as clientPortalProjectById from './routes-next/client/portal/projects/_id_/route';
import * as clientPortalProjectApprove from './routes-next/client/portal/projects/_id_/approve/route';
import * as clientPortalProjectFeedback from './routes-next/client/portal/projects/_id_/feedback/route';
import * as clientPortalProjectReject from './routes-next/client/portal/projects/_id_/reject/route';

// -- Admin -----------------------------------------------------------------
import * as adminClientFeedback from './routes-next/admin/client-feedback/route';
import * as adminMoveSystemRoles from './routes-next/admin/move-system-roles/route';
import * as adminSuperadmin from './routes-next/admin/superadmin/route';
import * as adminRbacDiagnostics from './routes-next/admin/rbac-diagnostics/route';
import * as adminRbacDiagnosticsTest from './routes-next/admin/rbac-diagnostics/test/route';
import * as adminTimeEntries from './routes-next/admin/time-entries/route';
import * as adminTimeEntryById from './routes-next/admin/time-entries/_id_/route';

// -- Onboarding ------------------------------------------------------------
import * as onboardingCheckFirstRun from './routes-next/onboarding/check-first-run/route';
import * as onboardingCompleteSetup from './routes-next/onboarding/complete-setup/route';
import * as onboardingSetupToken from './routes-next/onboarding/setup-token/route';
import * as onboardingTutorialProgress from './routes-next/onboarding/tutorial-progress/route';
import * as onboardingTutorialCheckAction from './routes-next/onboarding/tutorial-progress/check-action/route';

// -- Misc ------------------------------------------------------------------
import * as authPermissions from './routes-next/auth/permissions/route';
import * as setup from './routes-next/setup/route';
import * as bugReports from './routes-next/bug-reports/route';
import * as cronResetDemoData from './routes-next/cron/reset-demo-data/route';

// Helper to mount a route module
function mount(router: Router, path: string, mod: Record<string, unknown>, params?: Record<string, string>) {
  if (typeof mod.GET === 'function') router.get(path, adaptRoute(mod.GET as any, params));
  if (typeof mod.POST === 'function') router.post(path, adaptRoute(mod.POST as any, params));
  if (typeof mod.PUT === 'function') router.put(path, adaptRoute(mod.PUT as any, params));
  if (typeof mod.PATCH === 'function') router.patch(path, adaptRoute(mod.PATCH as any, params));
  if (typeof mod.DELETE === 'function') router.delete(path, adaptRoute(mod.DELETE as any, params));
}

export function createRouter(): Router {
  const router = Router();

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
  mount(router, '/admin/superadmin', adminSuperadmin);
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
