import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getFormResponseByHistoryId } from '@/lib/form-service';
import { verifyWorkflowHistoryAccess } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

// GET /api/workflows/history/[historyId]/form - Get form response for workflow history entry
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ historyId: string }> }
) {
  const { historyId } = await params;

  if (!isValidUUID(historyId)) {
    return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
  }

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

    // Phase 9: Forms are inline-only in workflows, check workflow permissions instead
    const canViewWorkflow = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, admin) ||
                            await hasPermission(userProfile, Permission.MANAGE_WORKFLOWS, undefined, admin);
    if (!canViewWorkflow) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflow forms' }, { status: 403 });
    }

    // Verify user has access to the workflow history's project
    const accessCheck = await verifyWorkflowHistoryAccess(supabase, user.id, historyId);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this workflow history'
      }, { status: 403 });
    }

    // Get form response
    const response = await getFormResponseByHistoryId(historyId);

    if (!response) {
      return NextResponse.json({ error: 'Form response not found for this workflow history entry' }, { status: 404 });
    }

    return NextResponse.json({ success: true, response }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/workflows/history/[historyId]/form', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
