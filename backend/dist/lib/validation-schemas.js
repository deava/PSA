"use strict";
/**
 * Zod Validation Schemas for API Routes
 * Centralizes all input validation with type-safe schemas
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.submitClientFeedbackSchema = exports.acceptClientInvitationSchema = exports.sendClientInvitationSchema = exports.submitFormResponseSchema = exports.updateFormTemplateSchema = exports.createFormTemplateSchema = exports.formFieldSchema = exports.workflowHandoffSchema = exports.startWorkflowInstanceSchema = exports.createWorkflowConnectionSchema = exports.updateWorkflowNodeSchema = exports.createWorkflowNodeSchema = exports.updateWorkflowTemplateSchema = exports.createWorkflowTemplateSchema = exports.getCapacityQuerySchema = exports.updateIssueSchema = exports.createIssueSchema = exports.updateProjectUpdateSchema = exports.createProjectUpdateSchema = exports.updateDepartmentSchema = exports.createDepartmentSchema = exports.updateAvailabilitySchema = exports.createAvailabilitySchema = exports.updateProfileSchema = exports.updateRoleSchema = exports.createRoleSchema = exports.getTimeEntriesQuerySchema = exports.updateTimeEntrySchema = exports.createTimeEntrySchema = exports.updateTaskSchema = exports.createTaskSchema = exports.updateAccountSchema = exports.createAccountSchema = exports.getProjectsQuerySchema = exports.updateProjectSchema = exports.createProjectSchema = exports.nonNegativeNumberSchema = exports.positiveNumberSchema = exports.dateOnlySchema = exports.dateSchema = exports.emailSchema = exports.optionalUuidSchema = exports.uuidSchema = void 0;
exports.validateRequestBody = validateRequestBody;
exports.validateQueryParams = validateQueryParams;
const zod_1 = require("zod");
// ============================================================================
// COMMON/REUSABLE SCHEMAS
// ============================================================================
// Use regex for UUID validation instead of z.uuid() because:
// - z.uuid() strictly validates RFC 4122 variant bits (17th char must be 8,9,a,b)
// - Demo/seed data uses simplified UUIDs like 11111111-1111-1111-1111-000000000001
// - These are valid UUID-like strings but fail strict RFC 4122 validation
const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
exports.uuidSchema = zod_1.z.string().regex(uuidRegex, 'Invalid UUID format');
// Optional UUID that treats empty strings as undefined
exports.optionalUuidSchema = zod_1.z.union([
    zod_1.z.string().regex(uuidRegex, 'Invalid UUID format'),
    zod_1.z.literal(''),
    zod_1.z.null(),
    zod_1.z.undefined()
]).transform(val => (val === '' || val === null ? undefined : val));
exports.emailSchema = zod_1.z.string().email('Invalid email format');
// dateSchema: Full ISO 8601 datetime (e.g., "2024-01-15T00:00:00Z")
exports.dateSchema = zod_1.z.string().datetime('Invalid datetime format');
// dateOnlySchema: Date-only format (e.g., "2024-01-15") used by HTML date inputs and most API fields
exports.dateOnlySchema = zod_1.z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');
exports.positiveNumberSchema = zod_1.z.number().positive('Must be a positive number');
exports.nonNegativeNumberSchema = zod_1.z.number().nonnegative('Must be non-negative');
// ============================================================================
// PROJECT SCHEMAS
// ============================================================================
exports.createProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Project name is required').max(200, 'Project name too long'),
    description: zod_1.z.string().max(2000, 'Description too long').optional().nullable(),
    accountId: exports.uuidSchema,
    status: zod_1.z.enum(['planning', 'in_progress', 'review', 'complete', 'on_hold']).optional(),
    start_date: exports.dateOnlySchema.optional().nullable(),
    end_date: exports.dateOnlySchema.optional().nullable(),
    budget: exports.positiveNumberSchema.optional().nullable(),
    assigned_user_id: exports.uuidSchema.optional(),
});
exports.updateProjectSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(2000).optional().nullable(),
    status: zod_1.z.enum(['planning', 'in_progress', 'review', 'complete', 'on_hold']).optional(),
    start_date: exports.dateOnlySchema.optional().nullable(),
    end_date: exports.dateOnlySchema.optional().nullable(),
    budget: exports.positiveNumberSchema.optional().nullable(),
    assigned_user_id: exports.uuidSchema.optional().nullable(),
});
exports.getProjectsQuerySchema = zod_1.z.object({
    userId: exports.uuidSchema,
    limit: zod_1.z.string().regex(/^\d+$/, 'Limit must be a number').transform(Number).optional(),
});
// ============================================================================
// ACCOUNT SCHEMAS
// ============================================================================
exports.createAccountSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Account name is required').max(200, 'Account name too long'),
    description: zod_1.z.string().max(2000, 'Description too long').optional().nullable(),
    primary_contact_name: zod_1.z.string().max(200, 'Contact name too long').optional().nullable(),
    primary_contact_email: exports.emailSchema.optional().nullable(),
    status: zod_1.z.enum(['active', 'inactive', 'archived']).optional(),
    account_manager_id: exports.optionalUuidSchema.optional(),
});
exports.updateAccountSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(2000).optional().nullable(),
    primary_contact_name: zod_1.z.string().max(200).optional().nullable(),
    primary_contact_email: exports.emailSchema.optional().nullable(),
    status: zod_1.z.enum(['active', 'inactive', 'archived']).optional(),
    account_manager_id: exports.optionalUuidSchema.optional(),
});
// ============================================================================
// TASK SCHEMAS
// ============================================================================
exports.createTaskSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Task name is required').max(200, 'Name too long'),
    description: zod_1.z.string().max(5000, 'Description too long').optional().nullable(),
    project_id: exports.uuidSchema,
    assigned_to: exports.uuidSchema.optional().nullable(),
    estimated_hours: exports.positiveNumberSchema.optional().nullable(),
    remaining_hours: exports.nonNegativeNumberSchema.optional().nullable(),
    start_date: exports.dateOnlySchema.optional().nullable(),
    due_date: exports.dateOnlySchema.optional().nullable(),
    priority: zod_1.z.enum(['low', 'medium', 'high', 'urgent']).optional(),
    status: zod_1.z.enum(['backlog', 'todo', 'in_progress', 'review', 'done', 'blocked']).optional(),
    dependencies: zod_1.z.array(exports.uuidSchema).optional(),
});
exports.updateTaskSchema = exports.createTaskSchema.partial();
// ============================================================================
// TIME ENTRY SCHEMAS
// ============================================================================
exports.createTimeEntrySchema = zod_1.z.object({
    taskId: exports.uuidSchema,
    projectId: exports.uuidSchema,
    hoursLogged: zod_1.z.number().min(0.1, 'Hours must be at least 0.1').max(24, 'Hours cannot exceed 24'),
    entryDate: exports.dateOnlySchema,
    description: zod_1.z.string().max(1000, 'Description too long').optional().nullable(),
    notes: zod_1.z.string().max(2000, 'Notes too long').optional().nullable(),
});
exports.updateTimeEntrySchema = zod_1.z.object({
    hoursLogged: zod_1.z.number().min(0.1).max(24).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    notes: zod_1.z.string().max(2000).optional().nullable(),
});
exports.getTimeEntriesQuerySchema = zod_1.z.object({
    startDate: exports.dateOnlySchema.optional(),
    endDate: exports.dateOnlySchema.optional(),
    userId: exports.uuidSchema.optional(),
    projectId: exports.uuidSchema.optional(),
    taskId: exports.uuidSchema.optional(),
});
// ============================================================================
// ROLE SCHEMAS
// ============================================================================
exports.createRoleSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Role name is required').max(100, 'Role name too long'),
    description: zod_1.z.string().max(500, 'Description too long').optional().nullable(),
    department_id: exports.uuidSchema,
    hierarchy_level: zod_1.z.number().int().min(1).max(10).optional(),
    reporting_role_id: exports.uuidSchema.optional().nullable(),
    permissions: zod_1.z.record(zod_1.z.string(), zod_1.z.boolean()).optional(),
});
exports.updateRoleSchema = exports.createRoleSchema.partial();
// ============================================================================
// USER PROFILE SCHEMAS
// ============================================================================
exports.updateProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    email: exports.emailSchema.optional(),
    phone: zod_1.z.string().max(50).optional().nullable(),
    bio: zod_1.z.string().max(1000).optional().nullable(),
});
// ============================================================================
// AVAILABILITY SCHEMAS
// ============================================================================
exports.createAvailabilitySchema = zod_1.z.object({
    week_start_date: exports.dateOnlySchema,
    available_hours: zod_1.z.number().min(0, 'Hours must be non-negative').max(168, 'Cannot exceed 168 hours per week'),
});
exports.updateAvailabilitySchema = zod_1.z.object({
    available_hours: zod_1.z.number().min(0).max(168),
});
// ============================================================================
// DEPARTMENT SCHEMAS
// ============================================================================
exports.createDepartmentSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Department name is required').max(100, 'Name too long'),
    description: zod_1.z.string().max(500, 'Description too long').optional().nullable(),
    parent_department_id: exports.uuidSchema.optional().nullable(),
});
exports.updateDepartmentSchema = exports.createDepartmentSchema.partial();
// ============================================================================
// PROJECT UPDATE SCHEMAS
// ============================================================================
exports.createProjectUpdateSchema = zod_1.z.object({
    project_id: exports.uuidSchema,
    title: zod_1.z.string().min(1).max(200),
    content: zod_1.z.string().min(1).max(10000, 'Content too long'),
    update_type: zod_1.z.enum(['status', 'milestone', 'issue', 'general']).optional(),
});
exports.updateProjectUpdateSchema = zod_1.z.object({
    title: zod_1.z.string().min(1).max(200).optional(),
    content: zod_1.z.string().min(1).max(10000).optional(),
    update_type: zod_1.z.enum(['status', 'milestone', 'issue', 'general']).optional(),
});
// ============================================================================
// ISSUE SCHEMAS
// ============================================================================
exports.createIssueSchema = zod_1.z.object({
    project_id: exports.uuidSchema,
    title: zod_1.z.string().min(1, 'Issue title is required').max(200, 'Title too long'),
    description: zod_1.z.string().max(5000, 'Description too long').optional().nullable(),
    severity: zod_1.z.enum(['low', 'medium', 'high', 'critical']).optional(),
    status: zod_1.z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
});
exports.updateIssueSchema = exports.createIssueSchema.partial().omit({ project_id: true });
// ============================================================================
// CAPACITY SCHEMAS
// ============================================================================
exports.getCapacityQuerySchema = zod_1.z.object({
    startDate: exports.dateOnlySchema.optional(),
    endDate: exports.dateOnlySchema.optional(),
    departmentId: exports.uuidSchema.optional(),
    accountId: exports.uuidSchema.optional(),
});
// ============================================================================
// HELPER FUNCTIONS
// ============================================================================
/**
 * Safely parse request body with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
function validateRequestBody(schema, body) {
    try {
        const data = schema.parse(body);
        return { success: true, data };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const firstError = error.issues[0];
            return {
                success: false,
                error: `${firstError.path.join('.')}: ${firstError.message}`,
                zodError: error,
            };
        }
        return {
            success: false,
            error: 'Invalid request body',
        };
    }
}
/**
 * Safely parse query parameters with Zod schema
 */
function validateQueryParams(schema, params) {
    try {
        // Convert single values from arrays if needed
        const normalized = {};
        for (const [key, value] of Object.entries(params)) {
            normalized[key] = Array.isArray(value) ? value[0] : value;
        }
        const data = schema.parse(normalized);
        return { success: true, data };
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            const firstError = error.issues[0];
            return {
                success: false,
                error: `${firstError.path.join('.')}: ${firstError.message}`,
                zodError: error,
            };
        }
        return {
            success: false,
            error: 'Invalid query parameters',
        };
    }
}
// ============================================================================
// WORKFLOW SCHEMAS (Phase 1)
// ============================================================================
exports.createWorkflowTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Workflow name is required').max(200, 'Workflow name too long'),
    description: zod_1.z.string().max(1000, 'Description too long').optional().nullable(),
});
exports.updateWorkflowTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    is_active: zod_1.z.boolean().optional(),
});
exports.createWorkflowNodeSchema = zod_1.z.object({
    workflow_template_id: exports.uuidSchema,
    node_type: zod_1.z.enum(['start', 'department', 'role', 'approval', 'form', 'client', 'conditional', 'sync', 'end']),
    entity_id: exports.uuidSchema.optional().nullable(),
    position_x: zod_1.z.number(),
    position_y: zod_1.z.number(),
    label: zod_1.z.string().min(1, 'Node label is required').max(100, 'Node label too long'),
    requires_form: zod_1.z.boolean().optional(),
    form_template_id: exports.uuidSchema.optional().nullable(),
    settings: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.updateWorkflowNodeSchema = zod_1.z.object({
    node_type: zod_1.z.enum(['start', 'department', 'role', 'approval', 'form', 'client', 'conditional', 'sync', 'end']).optional(),
    entity_id: exports.uuidSchema.optional().nullable(),
    position_x: zod_1.z.number().optional(),
    position_y: zod_1.z.number().optional(),
    label: zod_1.z.string().min(1).max(100).optional(),
    requires_form: zod_1.z.boolean().optional(),
    form_template_id: exports.uuidSchema.optional().nullable(),
    settings: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional(),
});
exports.createWorkflowConnectionSchema = zod_1.z.object({
    workflow_template_id: exports.uuidSchema,
    from_node_id: exports.uuidSchema,
    to_node_id: exports.uuidSchema,
    condition: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
});
exports.startWorkflowInstanceSchema = zod_1.z.object({
    workflow_template_id: exports.uuidSchema,
    project_id: exports.uuidSchema.optional().nullable(),
    task_id: exports.uuidSchema.optional().nullable(),
    start_node_id: exports.uuidSchema,
}).refine((data) => (data.project_id && !data.task_id) || (!data.project_id && data.task_id), { message: 'Must provide either project_id or task_id, but not both' });
exports.workflowHandoffSchema = zod_1.z.object({
    to_node_id: exports.uuidSchema,
    handed_off_to: exports.uuidSchema.optional().nullable(),
    form_response_id: exports.uuidSchema.optional().nullable(),
    notes: zod_1.z.string().max(2000, 'Notes too long').optional().nullable(),
    out_of_order: zod_1.z.boolean().optional(),
});
// ============================================================================
// FORM SCHEMAS (Phase 1)
// ============================================================================
exports.formFieldSchema = zod_1.z.object({
    id: zod_1.z.string().min(1, 'Field ID is required'),
    type: zod_1.z.enum(['text', 'number', 'date', 'dropdown', 'multiselect', 'file', 'textarea', 'email', 'checkbox']),
    label: zod_1.z.string().min(1, 'Field label is required'),
    required: zod_1.z.boolean(),
    placeholder: zod_1.z.string().optional(),
    options: zod_1.z.array(zod_1.z.string()).optional(),
    defaultValue: zod_1.z.any().optional(),
    validation: zod_1.z.object({
        min: zod_1.z.number().optional(),
        max: zod_1.z.number().optional(),
        pattern: zod_1.z.string().optional(),
        message: zod_1.z.string().optional(),
    }).optional(),
    conditional: zod_1.z.object({
        show_if: zod_1.z.string(),
        equals: zod_1.z.any(),
    }).optional(),
});
exports.createFormTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Form name is required').max(200, 'Form name too long'),
    description: zod_1.z.string().max(1000, 'Description too long').optional().nullable(),
    fields: zod_1.z.array(exports.formFieldSchema).min(1, 'Form must have at least one field'),
});
exports.updateFormTemplateSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(200).optional(),
    description: zod_1.z.string().max(1000).optional().nullable(),
    fields: zod_1.z.array(exports.formFieldSchema).optional(),
    is_active: zod_1.z.boolean().optional(),
});
exports.submitFormResponseSchema = zod_1.z.object({
    form_template_id: exports.uuidSchema,
    response_data: zod_1.z.record(zod_1.z.string(), zod_1.z.any()),
    workflow_history_id: exports.uuidSchema.optional().nullable(),
});
// ============================================================================
// CLIENT PORTAL SCHEMAS (Phase 1)
// ============================================================================
exports.sendClientInvitationSchema = zod_1.z.object({
    account_id: exports.uuidSchema,
    email: exports.emailSchema,
    expires_in_days: zod_1.z.number().int().min(1).max(30).optional(),
});
exports.acceptClientInvitationSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Name is required').max(100, 'Name too long'),
    company_position: zod_1.z.string().max(100, 'Position too long').optional(),
});
exports.submitClientFeedbackSchema = zod_1.z.object({
    project_id: exports.uuidSchema,
    satisfaction_score: zod_1.z.number().int().min(1).max(10).optional().nullable(),
    what_went_well: zod_1.z.string().max(2000, 'Text too long').optional().nullable(),
    what_needs_improvement: zod_1.z.string().max(2000, 'Text too long').optional().nullable(),
    performance_metrics: zod_1.z.record(zod_1.z.string(), zod_1.z.any()).optional().nullable(),
    workflow_history_id: exports.uuidSchema.optional().nullable(),
});
