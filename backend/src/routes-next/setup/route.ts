import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest, createAdminSupabaseClient } from '@/lib/supabase-server';
import { logger } from '@/lib/debug-logger';

export async function GET(request: NextRequest) {
  try {
    const admin = createAdminSupabaseClient();
    if (!admin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    const { data: superadmins, error: countError } = await admin
      .from('user_profiles')
      .select('id')
      .eq('is_superadmin', true)
      .limit(1);

    if (countError) {
      return NextResponse.json({ error: 'Failed to check setup status' }, { status: 500 });
    }

    const hasSuperadmin = superadmins && superadmins.length > 0;
    const setupSecretConfigured = !!process.env.SETUP_SECRET;

    return NextResponse.json({
      setupAvailable: !hasSuperadmin && setupSecretConfigured,
      message: !hasSuperadmin && setupSecretConfigured
        ? 'Setup available. Provide the correct secret key to become superadmin.'
        : 'Setup is not available.'
    });
  } catch (error) {
    logger.error('Error in GET /api/setup', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminSupabaseClient();
    if (!admin) {
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }

    let body: any;
    try { body = await request.json(); } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    const { setupSecret } = body;

    const expectedSecret = process.env.SETUP_SECRET;
    if (!expectedSecret) {
      return NextResponse.json({ error: 'SETUP_SECRET not configured' }, { status: 400 });
    }
    if (!setupSecret || setupSecret !== expectedSecret) {
      return NextResponse.json({ error: 'Invalid setup secret' }, { status: 401 });
    }

    const { data: existingSuperadmins, error: checkError } = await admin
      .from('user_profiles').select('id').eq('is_superadmin', true).limit(1);

    if (checkError) {
      return NextResponse.json({ error: 'Failed to check existing superadmins' }, { status: 500 });
    }
    if (existingSuperadmins && existingSuperadmins.length > 0) {
      return NextResponse.json({ error: 'Setup already completed.' }, { status: 400 });
    }

    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'You must be logged in to complete setup.' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await admin
      .from('user_profiles').select('id, email, name').eq('id', user.id).single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found.' }, { status: 404 });
    }

    const { error: updateError } = await admin
      .from('user_profiles').update({ is_superadmin: true }).eq('id', user.id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to promote to superadmin' }, { status: 500 });
    }

    const { data: superadminRole } = await admin
      .from('roles').select('id').eq('name', 'Superadmin').single();

    if (superadminRole) {
      const { data: existingRole } = await admin
        .from('user_roles').select('id').eq('user_id', user.id).eq('role_id', superadminRole.id).single();
      if (!existingRole) {
        await admin.from('user_roles').insert({ user_id: user.id, role_id: superadminRole.id, assigned_by: user.id });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${(profile as any).name || (profile as any).email} is now a superadmin.`,
      user: { id: (profile as any).id, email: (profile as any).email, name: (profile as any).name }
    });

  } catch (error) {
    logger.error('Error in POST /api/setup', {}, error as Error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
