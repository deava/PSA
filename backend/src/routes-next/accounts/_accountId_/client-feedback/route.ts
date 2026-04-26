import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';
import { hasPermission } from '@/lib/rbac';
import { Permission } from '@/lib/permissions';
import { hasAccountAccessServer } from '@/lib/access-control-server';
import { logger } from '@/lib/debug-logger';
import { isValidUUID } from '@/lib/validation-helpers';

// GET /api/accounts/[id]/client-feedback - View feedback for specific account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ accountId: string }> }
) {
  try {
    const { accountId } = await params;

    if (!isValidUUID(accountId)) {
      return NextResponse.json({ error: 'Invalid ID format' }, { status: 400 });
    }

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

    // Phase 9: VIEW_CLIENT_FEEDBACK → MANAGE_CLIENT_INVITES (consolidated admin permission)
    const canViewFeedback = await hasPermission(userProfile, Permission.MANAGE_CLIENT_INVITES, undefined, admin);
    if (!canViewFeedback) {
      return NextResponse.json({ error: 'Insufficient permissions to view client feedback' }, { status: 403 });
    }

    // Verify user has access to this account
    const hasAccess = await hasAccountAccessServer(supabase, user.id, accountId);
    if (!hasAccess) {
      return NextResponse.json({
        error: 'You do not have access to this account'
      }, { status: 403 });
    }

    // Get feedback for account with enriched data
    const { data: feedback, error: feedbackError } = await admin
      .from('client_feedback')
      .select(`
        *,
        projects!inner (
          id,
          name,
          account_id
        ),
        user_profiles (
          id,
          name,
          email
        )
      `)
      .eq('projects.account_id', accountId)
      .order('submitted_at', { ascending: false });

    if (feedbackError) {
      logger.error('Error fetching feedback', {}, feedbackError as unknown as Error);
      return NextResponse.json({ error: 'Failed to fetch feedback' }, { status: 500 });
    }

    return NextResponse.json({ success: true, feedback: feedback || [] }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Error in GET /api/accounts/[id]/client-feedback', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
