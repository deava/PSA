import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { getNextAvailableNodes } from '@/lib/workflow-service';
import { verifyWorkflowInstanceAccess } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';

// GET /api/workflows/instances/[id]/next-nodes - Get available next nodes
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

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

    // Check EXECUTE_WORKFLOWS permission (users who can execute workflows need to see next nodes)
    const canView = await hasPermission(userProfile, Permission.EXECUTE_WORKFLOWS, undefined, admin);
    if (!canView) {
      return NextResponse.json({ error: 'Insufficient permissions to view workflow nodes' }, { status: 403 });
    }

    // Verify user has access to the workflow instance's project
    const accessCheck = await verifyWorkflowInstanceAccess(supabase, user.id, id);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({
        error: accessCheck.error || 'You do not have access to this workflow instance'
      }, { status: 403 });
    }

    // Get next available nodes
    const nextNodes = await getNextAvailableNodes(id);

    return NextResponse.json({ success: true, next_nodes: nextNodes }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/workflows/instances/[id]/next-nodes', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
