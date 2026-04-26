"use strict";
/**
 * WORKFLOW SERVICE
 * Service layer for workflow operations (Phase 1 Feature 1 & 4)
 * Handles workflow template management, workflow execution, and history tracking
 *
 * IMPORTANT: Functions are being migrated to accept Supabase client as parameter
 * to maintain proper authentication context from API routes
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.getWorkflowInstanceById = void 0;
exports.getWorkflowTemplates = getWorkflowTemplates;
exports.getAllWorkflowTemplates = getAllWorkflowTemplates;
exports.getWorkflowTemplateById = getWorkflowTemplateById;
exports.createWorkflowTemplate = createWorkflowTemplate;
exports.updateWorkflowTemplate = updateWorkflowTemplate;
exports.deleteWorkflowTemplate = deleteWorkflowTemplate;
exports.createWorkflowNode = createWorkflowNode;
exports.updateWorkflowNode = updateWorkflowNode;
exports.deleteWorkflowNode = deleteWorkflowNode;
exports.createWorkflowConnection = createWorkflowConnection;
exports.deleteWorkflowConnection = deleteWorkflowConnection;
exports.startWorkflowInstance = startWorkflowInstance;
exports.getWorkflowInstance = getWorkflowInstance;
exports.getWorkflowInstanceForEntity = getWorkflowInstanceForEntity;
exports.getNextAvailableNodes = getNextAvailableNodes;
exports.handoffWorkflow = handoffWorkflow;
exports.completeWorkflow = completeWorkflow;
exports.cancelWorkflow = cancelWorkflow;
exports.getWorkflowHistory = getWorkflowHistory;
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
// WORKFLOW TEMPLATE MANAGEMENT
// =====================================================
/**
 * Get all active workflow templates
 */
async function getWorkflowTemplates() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');
    if (error) {
        debug_logger_1.logger.error('Error fetching workflow templates', { action: 'getWorkflowTemplates' }, error);
        throw error;
    }
    return data || [];
}
/**
 * Get all workflow templates (including inactive) - for admin views
 * Excludes workflows marked as [DELETED] (soft-deleted due to FK constraints)
 */
async function getAllWorkflowTemplates() {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_templates')
        .select('*')
        .not('name', 'like', '[DELETED]%') // Exclude soft-deleted workflows
        .order('is_active', { ascending: false }) // Active first
        .order('name');
    if (error) {
        debug_logger_1.logger.error('Error fetching all workflow templates', { action: 'getAllWorkflowTemplates' }, error);
        throw error;
    }
    return data || [];
}
/**
 * Get workflow template by ID with nodes and connections
 */
async function getWorkflowTemplateById(templateId) {
    const supabase = await getSupabase();
    // Fetch template
    const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .select('*')
        .eq('id', templateId)
        .single();
    if (templateError) {
        debug_logger_1.logger.error('Error fetching workflow template', { action: 'getWorkflowTemplateById', templateId }, templateError);
        throw templateError;
    }
    if (!template)
        return null;
    // Fetch nodes
    const { data: nodes, error: nodesError } = await supabase
        .from('workflow_nodes')
        .select('*')
        .eq('workflow_template_id', templateId)
        .order('created_at');
    if (nodesError) {
        debug_logger_1.logger.error('Error fetching workflow nodes', { action: 'getWorkflowTemplateById', templateId }, nodesError);
        throw nodesError;
    }
    // Fetch connections
    const { data: connections, error: connectionsError } = await supabase
        .from('workflow_connections')
        .select('*')
        .eq('workflow_template_id', templateId)
        .order('created_at');
    if (connectionsError) {
        debug_logger_1.logger.error('Error fetching workflow connections', { action: 'getWorkflowTemplateById', templateId }, connectionsError);
        throw connectionsError;
    }
    return {
        ...template,
        nodes: nodes || [],
        connections: connections || [],
    };
}
/**
 * Create workflow template
 */
async function createWorkflowTemplate(name, description, createdBy) {
    const supabase = await getSupabase();
    console.log('[createWorkflowTemplate] Inserting:', { name, description, createdBy });
    const { data, error } = await supabase
        .from('workflow_templates')
        .insert({
        name,
        description,
        created_by: createdBy,
        is_active: false, // New workflows start as inactive until configured
    })
        .select()
        .single();
    if (error) {
        console.error('[createWorkflowTemplate] DB error:', error);
        debug_logger_1.logger.error('Error creating workflow template', { action: 'createWorkflowTemplate', name }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow template created', { templateId: data.id, name });
    return data;
}
/**
 * Update workflow template
 */
async function updateWorkflowTemplate(templateId, updates, supabaseClient) {
    const supabase = supabaseClient || await getSupabase();
    const { data, error } = await supabase
        .from('workflow_templates')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', templateId)
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error updating workflow template', { action: 'updateWorkflowTemplate', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow template updated', { templateId });
    return data;
}
/**
 * Delete workflow template (permanently deletes the template and all associated nodes/connections)
 *
 * NOTE: Workflow instances have their own snapshot of the workflow, so deleting a template
 * does NOT affect any in-progress or completed workflows. They will continue to use their
 * snapshot data. Only NEW projects will be unable to use this workflow.
 */
async function deleteWorkflowTemplate(templateId, supabaseClient) {
    const supabase = supabaseClient || await getSupabase();
    // Get template name for logging
    const { data: template } = await supabase
        .from('workflow_templates')
        .select('name')
        .eq('id', templateId)
        .single();
    const templateName = template?.name || templateId;
    // Check if there are any workflow instances using this template
    const { data: instances } = await supabase
        .from('workflow_instances')
        .select('id, status')
        .eq('workflow_template_id', templateId);
    if (instances && instances.length > 0) {
        // There are instances - we need to ensure they have snapshots before proceeding
        // For instances without snapshots, we need to capture one now
        for (const instance of instances) {
            // Check if instance has a snapshot
            const { data: instanceData } = await supabase
                .from('workflow_instances')
                .select('started_snapshot')
                .eq('id', instance.id)
                .single();
            if (!instanceData?.started_snapshot) {
                // Capture snapshot now before deleting template
                const { data: nodes } = await supabase
                    .from('workflow_nodes')
                    .select('*')
                    .eq('workflow_template_id', templateId);
                const { data: connections } = await supabase
                    .from('workflow_connections')
                    .select('*')
                    .eq('workflow_template_id', templateId);
                const snapshot = {
                    nodes: nodes || [],
                    connections: connections || [],
                    template_name: templateName,
                    captured_at: new Date().toISOString(),
                    captured_reason: 'template_deleted'
                };
                await supabase
                    .from('workflow_instances')
                    .update({ started_snapshot: snapshot })
                    .eq('id', instance.id);
                debug_logger_1.logger.info('Captured snapshot for instance before template deletion', {
                    instanceId: instance.id,
                    templateId
                });
            }
        }
    }
    // Delete connections first (they reference nodes)
    const { error: connectionsError } = await supabase
        .from('workflow_connections')
        .delete()
        .eq('workflow_template_id', templateId);
    if (connectionsError) {
        debug_logger_1.logger.error('Error deleting workflow connections', { action: 'deleteWorkflowTemplate', templateId }, connectionsError);
        throw connectionsError;
    }
    // Delete nodes
    const { error: nodesError } = await supabase
        .from('workflow_nodes')
        .delete()
        .eq('workflow_template_id', templateId);
    if (nodesError) {
        debug_logger_1.logger.error('Error deleting workflow nodes', { action: 'deleteWorkflowTemplate', templateId }, nodesError);
        throw nodesError;
    }
    // Now try to delete the template
    // If there's a foreign key constraint, we'll get an error
    const { error } = await supabase
        .from('workflow_templates')
        .delete()
        .eq('id', templateId);
    if (error) {
        // Check if this is a foreign key constraint error
        if (error.code === '23503') {
            // Foreign key violation - instances still reference this template
            // This means the DB has a strict FK constraint
            // We need to deactivate instead of delete
            debug_logger_1.logger.warn('Cannot delete template due to FK constraint, deactivating instead', {
                action: 'deleteWorkflowTemplate',
                templateId
            });
            const { error: deactivateError } = await supabase
                .from('workflow_templates')
                .update({
                is_active: false,
                name: `[DELETED] ${templateName}`,
                description: `This workflow was deleted on ${new Date().toISOString()}. Existing projects continue to use their workflow snapshots.`
            })
                .eq('id', templateId);
            if (deactivateError) {
                debug_logger_1.logger.error('Error deactivating workflow template', { action: 'deleteWorkflowTemplate', templateId }, deactivateError);
                throw deactivateError;
            }
            debug_logger_1.logger.info('Workflow template marked as deleted (deactivated due to FK constraint)', { templateId, templateName });
            return;
        }
        debug_logger_1.logger.error('Error deleting workflow template', { action: 'deleteWorkflowTemplate', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow template permanently deleted', { templateId, templateName });
}
// =====================================================
// WORKFLOW NODE MANAGEMENT
// =====================================================
/**
 * Create workflow node
 */
async function createWorkflowNode(templateId, nodeData) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_nodes')
        .insert({
        workflow_template_id: templateId,
        ...nodeData,
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error creating workflow node', { action: 'createWorkflowNode', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow node created', { nodeId: data.id, templateId });
    return data;
}
/**
 * Update workflow node
 */
async function updateWorkflowNode(nodeId, updates) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_nodes')
        .update(updates)
        .eq('id', nodeId)
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error updating workflow node', { action: 'updateWorkflowNode', nodeId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow node updated', { nodeId });
    return data;
}
/**
 * Delete workflow node
 */
async function deleteWorkflowNode(nodeId) {
    const supabase = await getSupabase();
    const { error } = await supabase
        .from('workflow_nodes')
        .delete()
        .eq('id', nodeId);
    if (error) {
        debug_logger_1.logger.error('Error deleting workflow node', { action: 'deleteWorkflowNode', nodeId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow node deleted', { nodeId });
}
// =====================================================
// WORKFLOW CONNECTION MANAGEMENT
// =====================================================
/**
 * Create workflow connection
 */
async function createWorkflowConnection(templateId, fromNodeId, toNodeId, condition) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_connections')
        .insert({
        workflow_template_id: templateId,
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        condition: condition || null,
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error creating workflow connection', { action: 'createWorkflowConnection', templateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow connection created', { connectionId: data.id, templateId });
    return data;
}
/**
 * Delete workflow connection
 */
async function deleteWorkflowConnection(connectionId) {
    const supabase = await getSupabase();
    const { error } = await supabase
        .from('workflow_connections')
        .delete()
        .eq('id', connectionId);
    if (error) {
        debug_logger_1.logger.error('Error deleting workflow connection', { action: 'deleteWorkflowConnection', connectionId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow connection deleted', { connectionId });
}
// =====================================================
// WORKFLOW INSTANCE MANAGEMENT
// =====================================================
/**
 * Start workflow instance on a project or task
 */
async function startWorkflowInstance(params) {
    const { workflowTemplateId, projectId, taskId, startNodeId } = params;
    const supabase = await getSupabase();
    // Validate that exactly one of projectId or taskId is provided
    if ((projectId && taskId) || (!projectId && !taskId)) {
        throw new Error('Must provide either projectId or taskId, but not both');
    }
    // Validate that the workflow template exists, is active, and has nodes
    const { data: template, error: templateError } = await supabase
        .from('workflow_templates')
        .select('id, name, is_active')
        .eq('id', workflowTemplateId)
        .single();
    if (templateError || !template) {
        debug_logger_1.logger.error('Workflow template not found', { action: 'startWorkflowInstance', workflowTemplateId }, templateError);
        throw new Error('Workflow template not found');
    }
    if (!template.is_active) {
        debug_logger_1.logger.error('Workflow template is not active', { action: 'startWorkflowInstance', workflowTemplateId });
        throw new Error(`Workflow "${template.name}" is not active. Please activate it in the workflow editor before using.`);
    }
    // Check if the workflow has nodes
    const { count: nodeCount, error: nodeCountError } = await supabase
        .from('workflow_nodes')
        .select('id', { count: 'exact', head: true })
        .eq('workflow_template_id', workflowTemplateId);
    if (nodeCountError) {
        debug_logger_1.logger.error('Error checking workflow nodes', { action: 'startWorkflowInstance', workflowTemplateId }, nodeCountError);
        throw new Error('Failed to validate workflow configuration');
    }
    if (!nodeCount || nodeCount === 0) {
        debug_logger_1.logger.error('Workflow has no nodes', { action: 'startWorkflowInstance', workflowTemplateId });
        throw new Error(`Workflow "${template.name}" has no nodes configured. Please add at least Start and End nodes in the workflow editor.`);
    }
    // Validate the start node exists
    const { data: startNode, error: startNodeError } = await supabase
        .from('workflow_nodes')
        .select('id')
        .eq('id', startNodeId)
        .eq('workflow_template_id', workflowTemplateId)
        .single();
    if (startNodeError || !startNode) {
        debug_logger_1.logger.error('Start node not found in workflow', { action: 'startWorkflowInstance', workflowTemplateId, startNodeId }, startNodeError);
        throw new Error('Invalid start node for this workflow');
    }
    const { data, error } = await supabase
        .from('workflow_instances')
        .insert({
        workflow_template_id: workflowTemplateId,
        project_id: projectId || null,
        task_id: taskId || null,
        current_node_id: startNodeId,
        status: 'active',
    })
        .select()
        .single();
    if (error) {
        debug_logger_1.logger.error('Error starting workflow instance', { action: 'startWorkflowInstance', workflowTemplateId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow instance started', {
        instanceId: data.id,
        workflowTemplateId,
        projectId,
        taskId
    });
    return data;
}
/**
 * Get workflow instance by ID
 */
async function getWorkflowInstance(instanceId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_instances')
        .select('*')
        .eq('id', instanceId)
        .single();
    if (error) {
        debug_logger_1.logger.error('Error fetching workflow instance', { action: 'getWorkflowInstance', instanceId }, error);
        throw error;
    }
    return data;
}
/**
 * Get workflow instance for a project or task
 */
async function getWorkflowInstanceForEntity(projectId, taskId) {
    const supabase = await getSupabase();
    let query = supabase
        .from('workflow_instances')
        .select('*')
        .eq('status', 'active');
    if (projectId) {
        query = query.eq('project_id', projectId);
    }
    else if (taskId) {
        query = query.eq('task_id', taskId);
    }
    else {
        throw new Error('Must provide either projectId or taskId');
    }
    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        debug_logger_1.logger.error('Error fetching workflow instance', { action: 'getWorkflowInstanceForEntity', projectId, taskId }, error);
        throw error;
    }
    return data || null;
}
/**
 * Get next available nodes in workflow
 * Uses snapshot data if available, falls back to live tables for backwards compatibility
 */
async function getNextAvailableNodes(instanceId) {
    const supabase = await getSupabase();
    // Get workflow instance including snapshot
    const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select('current_node_id, workflow_template_id, started_snapshot')
        .eq('id', instanceId)
        .single();
    if (instanceError || !instance?.current_node_id) {
        debug_logger_1.logger.error('Error fetching workflow instance for next nodes', { action: 'getNextAvailableNodes', instanceId }, instanceError ? new Error(instanceError.message) : undefined);
        throw instanceError || new Error('No current node found');
    }
    // Use snapshot data if available (for workflow independence from template changes)
    let connections;
    let allNodes;
    if (instance.started_snapshot?.nodes && instance.started_snapshot?.connections) {
        // Use the snapshot - this ensures template changes don't affect in-progress workflows
        connections = instance.started_snapshot.connections.filter((c) => c.from_node_id === instance.current_node_id);
        allNodes = instance.started_snapshot.nodes;
        debug_logger_1.logger.info('Using snapshot data for getNextAvailableNodes', { instanceId });
    }
    else {
        // Fallback for older instances without snapshot - query live tables
        debug_logger_1.logger.info('No snapshot found, querying live tables', { instanceId });
        const { data: liveConnections, error: connectionsError } = await supabase
            .from('workflow_connections')
            .select('to_node_id')
            .eq('from_node_id', instance.current_node_id);
        if (connectionsError) {
            debug_logger_1.logger.error('Error fetching workflow connections', { action: 'getNextAvailableNodes', instanceId }, new Error(connectionsError.message));
            throw connectionsError;
        }
        if (!liveConnections || liveConnections.length === 0) {
            return []; // No next nodes (end of workflow)
        }
        const nodeIds = liveConnections.map((c) => c.to_node_id);
        const { data: liveNodes, error: nodesError } = await supabase
            .from('workflow_nodes')
            .select('*')
            .in('id', nodeIds);
        if (nodesError) {
            debug_logger_1.logger.error('Error fetching workflow nodes', { action: 'getNextAvailableNodes', instanceId }, nodesError);
            throw nodesError;
        }
        return liveNodes || [];
    }
    // Using snapshot data - filter nodes based on connections
    if (!connections || connections.length === 0) {
        return []; // No next nodes (end of workflow)
    }
    const nodeIds = connections.map((c) => c.to_node_id);
    const nextNodes = allNodes.filter((n) => nodeIds.includes(n.id));
    return nextNodes;
}
/**
 * Hand off workflow to next node
 */
async function handoffWorkflow(supabase, params) {
    if (!supabase) {
        throw new Error('Supabase client is required');
    }
    const { instanceId, toNodeId, handedOffBy, handedOffTo, formResponseId, notes, outOfOrder = false } = params;
    // Get current node
    const { data: instance, error: instanceError } = await supabase
        .from('workflow_instances')
        .select('current_node_id')
        .eq('id', instanceId)
        .single();
    if (instanceError) {
        debug_logger_1.logger.error('Error fetching workflow instance for handoff', { action: 'handoffWorkflow', instanceId }, instanceError);
        throw instanceError;
    }
    const fromNodeId = instance.current_node_id;
    // Create history entry
    const { data: history, error: historyError } = await supabase
        .from('workflow_history')
        .insert({
        workflow_instance_id: instanceId,
        from_node_id: fromNodeId,
        to_node_id: toNodeId,
        handed_off_by: handedOffBy,
        handed_off_to: handedOffTo || null,
        out_of_order: outOfOrder,
        form_response_id: formResponseId || null,
        notes: notes || null,
    })
        .select()
        .single();
    if (historyError) {
        debug_logger_1.logger.error('Error creating workflow history', { action: 'handoffWorkflow', instanceId }, historyError);
        throw historyError;
    }
    // Update workflow instance current node
    const { error: updateError } = await supabase
        .from('workflow_instances')
        .update({ current_node_id: toNodeId })
        .eq('id', instanceId);
    if (updateError) {
        debug_logger_1.logger.error('Error updating workflow instance', { action: 'handoffWorkflow', instanceId }, updateError);
        throw updateError;
    }
    debug_logger_1.logger.info('Workflow handed off', {
        instanceId,
        fromNodeId,
        toNodeId,
        handedOffBy,
        outOfOrder
    });
    return history;
}
/**
 * Complete workflow instance
 */
async function completeWorkflow(instanceId) {
    const supabase = await getSupabase();
    const { error } = await supabase
        .from('workflow_instances')
        .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
    })
        .eq('id', instanceId);
    if (error) {
        debug_logger_1.logger.error('Error completing workflow instance', { action: 'completeWorkflow', instanceId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow completed', { instanceId });
}
/**
 * Cancel workflow instance
 */
async function cancelWorkflow(instanceId) {
    const supabase = await getSupabase();
    const { error } = await supabase
        .from('workflow_instances')
        .update({ status: 'cancelled' })
        .eq('id', instanceId);
    if (error) {
        debug_logger_1.logger.error('Error cancelling workflow instance', { action: 'cancelWorkflow', instanceId }, error);
        throw error;
    }
    debug_logger_1.logger.info('Workflow cancelled', { instanceId });
}
/**
 * Get workflow history for an instance
 */
async function getWorkflowHistory(instanceId) {
    const supabase = await getSupabase();
    const { data, error } = await supabase
        .from('workflow_history')
        .select('*')
        .eq('workflow_instance_id', instanceId)
        .order('created_at', { ascending: false });
    if (error) {
        debug_logger_1.logger.error('Error fetching workflow history', { action: 'getWorkflowHistory', instanceId }, error);
        throw error;
    }
    return data || [];
}
// Export aliases for API route compatibility
exports.getWorkflowInstanceById = getWorkflowInstance;
