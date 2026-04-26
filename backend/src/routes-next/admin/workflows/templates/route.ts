import { NextRequest, NextResponse } from 'next/server';
import { createApiSupabaseClient, createAdminSupabaseClient, getUserFromRequest } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getWorkflowTemplates, getAllWorkflowTemplates, createWorkflowTemplate } from '@/lib/workflow-service';
import { validateRequestBody, createWorkflowTemplateSchema } from '@/lib/validation-schemas';
import { logger } from '@/lib/debug-logger';

// GET /api/admin/workflows/templates - List all workflow templates
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { data: userProfile } = await admin
      .from('user_profiles')
      .select(`*, user_roles!user_id(role_id, roles!role_id(id,name,permissions,department_id,is_system_role))`)
      .eq('id', user.id).single();

    if (!userProfile) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });

    const canView = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, admin);
    if (!canView) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

    const includeInactive = request.nextUrl.searchParams.get('include_inactive') === 'true';
    const templates = includeInactive ? await getAllWorkflowTemplates() : await getWorkflowTemplates();

    return NextResponse.json({ success: true, templates }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/admin/workflows/templates', {}, error as Error);
    const err = error as any;
    console.error('[GET /api/admin/workflows/templates] ERROR:', err?.message, err?.code, err?.details);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST /api/admin/workflows/templates - Create new workflow template
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const admin = createAdminSupabaseClient();
    if (!admin) return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });

    const { data: userProfile, error: profileError } = await admin
      .from('user_profiles')
      .select(`*, user_roles!user_id(role_id, roles!role_id(id,name,permissions,department_id,is_system_role))`)
      .eq('id', user.id).single();

    console.log('[POST templates] userProfile:', JSON.stringify({ id: userProfile?.id, is_superadmin: userProfile?.is_superadmin, profileError: profileError?.message }));

    if (!userProfile) return NextResponse.json({ error: 'User profile not found', details: profileError?.message }, { status: 404 });

    const canManage = await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, admin);
    console.log('[POST templates] canManage:', canManage);
    if (!canManage) return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

    // Validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const validation = validateRequestBody(createWorkflowTemplateSchema, body);
    if (!validation.success) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Create template
    console.log('[POST /api/admin/workflows/templates] Creating template:', { name: validation.data.name, userId: user.id });
    const template = await createWorkflowTemplate(
      validation.data.name,
      validation.data.description || null,
      user.id
    );

    return NextResponse.json({ success: true, template }, { status: 201 });
  } catch (error: unknown) {
    const err = error as any;
    console.error('[POST /api/admin/workflows/templates] ERROR:', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
      stack: err?.stack,
    });
    logger.error('Error in POST /api/admin/workflows/templates', {
      message: err?.message,
      code: err?.code,
      details: err?.details,
      hint: err?.hint,
    }, error as Error);
    return NextResponse.json({ error: err?.message || 'Internal server error', details: err?.details || err?.hint }, { status: 500 });
  }
}
