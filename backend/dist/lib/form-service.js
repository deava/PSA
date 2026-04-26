"use strict";
/**
 * FORM SERVICE
 * Service layer for dynamic form operations (Phase 1 Feature 2)
 * Handles form template management and form response submission
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFormResponseByHistoryId = void 0;
exports.getFormTemplates = getFormTemplates;
exports.getFormTemplateById = getFormTemplateById;
exports.createFormTemplate = createFormTemplate;
exports.updateFormTemplate = updateFormTemplate;
exports.deleteFormTemplate = deleteFormTemplate;
exports.submitFormResponse = submitFormResponse;
exports.getFormResponseById = getFormResponseById;
exports.getFormResponses = getFormResponses;
exports.getFormResponseForWorkflowHistory = getFormResponseForWorkflowHistory;
exports.isFieldVisible = isFieldVisible;
exports.getVisibleFields = getVisibleFields;
const supabase_server_1 = require("./supabase-server");
const debug_logger_1 = require("./debug-logger");
// Helper to get supabase client with null check
async function getSupabase() {
    const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
    if (!supabase) {
        throw new Error('Unable to connect to the database');
    }
    return supabase;
}
// =====================================================
// FORM TEMPLATE MANAGEMENT
// =====================================================
/**
 * Get all active form templates
 */
async function getFormTemplates() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) {
        debug_logger_1.logger.error('Error fetching form templates', { action: 'getFormTemplates' }, error);
        throw error;
    }
    return data || [];
}
/**
 * Get form template by ID
 */
async function getFormTemplateById(templateId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        debug_logger_1.logger.error('Error fetching form template', { action: 'getFormTemplateById', templateId }, error);
        throw error;
    }
    return data || null;
}
/**
 * Create form template
 */
async function createFormTemplate(name, description, fields, createdBy) {
    const supabase = await getSupabase();
    // Validate fields
    validateFormFields(fields);
    const { data, error } = await supabase
        .from('form_templates')
        .insert({
        name,
        description,
        fields,
        created_by: createdBy,
        is_active: true,
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error creating form template', { action: 'createFormTemplate', name }, error);
        throw error;
    }
    debug_logger_1.logger.info('Form template created', { templateId: data.id, name });
    return data;
}
/**
 * Update form template
 */
async function updateFormTemplate(templateId, updates) {
    const supabase = await getSupabase();
    // Validate fields if provided
    if (updates.fields) {
        validateFormFields(updates.fields);
    }
    const { data, error } = await supabase
        .from('form_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', templateId)
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error updating form template', { action: 'updateFormTemplate', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Form template updated', { templateId });
    return data;
}
/**
 * Delete form template (soft delete by setting is_active = false)
 */
async function deleteFormTemplate(templateId) {
    const supabase = await getSupabase();
    const { error } = await supabase
        .from('form_templates')
        .update({ is_active: false })
        .eq('id', templateId);
    if (error) {
        debug_logger_1.logger.error('Error deleting form template', { action: 'deleteFormTemplate', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Form template deleted', { templateId });
}
// =====================================================
// FORM RESPONSE MANAGEMENT
// =====================================================
/**
 * Submit form response
 */
async function submitFormResponse(params) {
    const supabase = await getSupabase();
    const { formTemplateId, responseData, submittedBy, workflowHistoryId } = params;
    // Get form template to validate response
    const template = await getFormTemplateById(formTemplateId);
    if (!template) {
        throw new Error('Form template not found');
    }
    // Validate response data
    validateFormResponse(template.fields, responseData);
    const { data, error } = await supabase
        .from('form_responses')
        .insert({
        form_template_id: formTemplateId,
        workflow_history_id: workflowHistoryId || null,
        submitted_by: submittedBy,
        response_data: responseData,
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error submitting form response', { action: 'submitFormResponse', formTemplateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Form response submitted', {
        responseId: data.id,
        formTemplateId,
        submittedBy
    });
    return data;
}
/**
 * Get form response by ID
 */
async function getFormResponseById(responseId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('form_responses')
        .select(`
      *,
      form_template:form_templates(*)
    `)
        .eq('id', responseId)
        .single();
    if (error && error.code !== 'PGRST116') {
        debug_logger_1.logger.error('Error fetching form response', { action: 'getFormResponseById', responseId }, error);
        throw error;
    }
    return data || null;
}
/**
 * Get form responses for a form template
 */
async function getFormResponses(formTemplateId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('form_responses')
        .select('*')
        .eq('form_template_id', formTemplateId)
        .order('submitted_at', { ascending: false });
    if (error) {
        debug_logger_1.logger.error('Error fetching form responses', { action: 'getFormResponses', formTemplateId }, error);
        throw error;
    }
    return data || [];
}
/**
 * Get form response for a workflow history entry
 */
async function getFormResponseForWorkflowHistory(workflowHistoryId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('form_responses')
        .select(`
      *,
      form_template:form_templates(*)
    `)
        .eq('workflow_history_id', workflowHistoryId)
        .single();
    if (error && error.code !== 'PGRST116') {
        debug_logger_1.logger.error('Error fetching form response for workflow history', { action: 'getFormResponseForWorkflowHistory', workflowHistoryId }, error);
        throw error;
    }
    return data || null;
}
// =====================================================
// VALIDATION HELPERS
// =====================================================
/**
 * Validate form fields structure
 */
function validateFormFields(fields) {
    if (!Array.isArray(fields) || fields.length === 0) {
        throw new Error('Form must have at least one field');
    }
    const fieldIds = new Set();
    for (const field of fields) {
        // Check for duplicate IDs
        if (fieldIds.has(field.id)) {
            throw new Error(`Duplicate field ID: ${field.id}`);
        }
        fieldIds.add(field.id);
        // Validate required properties
        if (!field.id || !field.type || !field.label) {
            throw new Error('Each field must have id, type, and label');
        }
        // Validate field type
        const validTypes = ['text', 'number', 'date', 'dropdown', 'multiselect', 'file', 'textarea', 'email', 'checkbox', 'url'];
        if (!validTypes.includes(field.type)) {
            throw new Error(`Invalid field type: ${field.type}`);
        }
        // Validate options for dropdown/multiselect
        if ((field.type === 'dropdown' || field.type === 'multiselect') && (!field.options || field.options.length === 0)) {
            throw new Error(`Field ${field.id} (${field.type}) must have options`);
        }
        // Validate conditional logic
        if (field.conditional) {
            if (!field.conditional.show_if || field.conditional.equals === undefined) {
                throw new Error(`Field ${field.id} has invalid conditional logic`);
            }
            // Check if referenced field exists
            if (!fieldIds.has(field.conditional.show_if)) {
                throw new Error(`Field ${field.id} references non-existent field ${field.conditional.show_if} in conditional`);
            }
        }
    }
}
/**
 * Validate form response data
 */
function validateFormResponse(fields, responseData) {
    // Check required fields
    for (const field of fields) {
        if (field.required) {
            const value = responseData[field.id];
            if (value === undefined || value === null || value === '') {
                throw new Error(`Required field missing: ${field.label} (${field.id})`);
            }
        }
    }
    // Validate field values
    for (const field of fields) {
        const value = responseData[field.id];
        if (value === undefined || value === null)
            continue;
        switch (field.type) {
            case 'number':
                if (isNaN(Number(value))) {
                    throw new Error(`Field ${field.label} must be a number`);
                }
                if (field.validation?.min !== undefined && Number(value) < field.validation.min) {
                    throw new Error(`Field ${field.label} must be at least ${field.validation.min}`);
                }
                if (field.validation?.max !== undefined && Number(value) > field.validation.max) {
                    throw new Error(`Field ${field.label} must be at most ${field.validation.max}`);
                }
                break;
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(String(value))) {
                    throw new Error(`Field ${field.label} must be a valid email address`);
                }
                break;
            case 'dropdown':
                if (field.options && !field.options.includes(String(value))) {
                    throw new Error(`Field ${field.label} has invalid option: ${value}`);
                }
                break;
            case 'multiselect':
                if (!Array.isArray(value)) {
                    throw new Error(`Field ${field.label} must be an array`);
                }
                if (field.options) {
                    for (const item of value) {
                        if (!field.options.includes(String(item))) {
                            throw new Error(`Field ${field.label} has invalid option: ${item}`);
                        }
                    }
                }
                break;
            case 'checkbox':
                if (typeof value !== 'boolean') {
                    throw new Error(`Field ${field.label} must be a boolean`);
                }
                break;
        }
        // Custom pattern validation
        if (field.validation?.pattern) {
            try {
                const regex = new RegExp(field.validation.pattern);
                if (!regex.test(String(value))) {
                    throw new Error(field.validation.message || `Field ${field.label} does not match required pattern`);
                }
            }
            catch (regexError) {
                // Invalid regex pattern in form definition - skip pattern validation
                if (regexError instanceof Error && regexError.message.includes('does not match')) {
                    throw regexError;
                }
            }
        }
    }
}
/**
 * Check if field should be visible based on conditional logic
 */
function isFieldVisible(field, formData) {
    if (!field.conditional)
        return true;
    const conditionalFieldValue = formData[field.conditional.show_if];
    return conditionalFieldValue === field.conditional.equals;
}
/**
 * Get visible fields based on current form data
 */
function getVisibleFields(fields, formData) {
    return fields.filter((field) => isFieldVisible(field, formData));
}
// Export alias for API route compatibility
exports.getFormResponseByHistoryId = getFormResponseForWorkflowHistory;
