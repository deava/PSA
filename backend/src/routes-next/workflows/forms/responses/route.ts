import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { submitFormResponse } from '@/lib/form-service';
import { validateRequestBody, submitFormResponseSchema } from '@/lib/validation-schemas';
import { verifyWorkflowHistoryAccess } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';

// POST /api/workflows/forms/responses - Submit a form response
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    // Get user profile with roles
    const { data: userProfile } = await admin
      .from('user_profiles')
      .select(`
        *,
        user_roles!user_id(
          roles!role_id(
            id,
            name,
            permissions,
            department_id
          )
        )
      `)
      .eq('id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Phase 9: Forms are inline-only in workflows - check EXECUTE_WORKFLOWS permission
    const canSubmit = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, admin);
    if (!canSubmit) {
      return NextResponse.json({ error: 'Insufficient permissions to submit forms (requires workflow execution permission)' }, { status: 403 });
    }

    // Validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const validation = validateRequestBody(submitFormResponseSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // If workflow_history_id is provided, verify user has access to that workflow
    if (validation.data.workflow_history_id) {
      const accessCheck = await verifyWorkflowHistoryAccess(supabase, user.id, validation.data.workflow_history_id);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({
          error: accessCheck.error || 'You do not have access to this workflow'
        }, { status: 403 });
      }
    }

    // Submit form response
    const response = await submitFormResponse({
      formTemplateId: validation.data.form_template_id,
      responseData: validation.data.response_data,
      submittedBy: user.id,
      workflowHistoryId: validation.data.workflow_history_id || null
    });

    return NextResponse.json({ success: true, response }, { status: 201 });
  } catch (error: unknown) {
    logger.error('Error in POST /api/workflows/forms/responses', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
