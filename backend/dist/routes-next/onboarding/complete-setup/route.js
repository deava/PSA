"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.POST = POST;
const server_1 = require("next/server");
const supabase_server_1 = require("@/lib/supabase-server");
const setup_token_1 = require("@/lib/onboarding/setup-token");
async function POST(request) {
    // Only works during first run
    const firstRun = await (0, setup_token_1.isFirstRun)();
    if (!firstRun) {
        return server_1.NextResponse.json({ error: 'Setup already completed' }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    if (!body?.token || !body?.email || !body?.password || !body?.name) {
        return server_1.NextResponse.json({ error: 'Token, email, password, and name are required' }, { status: 400 });
    }
    // Validate token
    const valid = await (0, setup_token_1.validateSetupToken)(body.token);
    if (!valid) {
        return server_1.NextResponse.json({ error: 'Invalid or expired setup token' }, { status: 401 });
    }
    const supabase = (0, supabase_server_1.createAdminSupabaseClient)();
    if (!supabase) {
        return server_1.NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true, // Skip email confirmation for superadmin
        user_metadata: { name: body.name },
    });
    if (authError || !authData.user) {
        return server_1.NextResponse.json({ error: authError?.message || 'Failed to create user' }, { status: 500 });
    }
    const userId = authData.user.id;
    // Create user profile (the DB trigger may also do this, but we ensure it with our values)
    const { error: profileError } = await supabase.from('user_profiles').upsert({
        id: userId,
        email: body.email,
        name: body.name,
        is_superadmin: true,
        has_completed_onboarding: false,
    });
    if (profileError) {
        console.error('Profile creation error:', profileError);
    }
    // Assign Superadmin role
    const { error: roleError } = await supabase.from('user_roles').insert({
        user_id: userId,
        role_id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', // Superadmin role from seed
        assigned_by: userId,
    });
    if (roleError) {
        console.error('Role assignment error:', roleError);
    }
    // Create onboarding state
    await supabase.from('onboarding_state').insert({
        user_id: userId,
        tutorial_completed: false,
        tutorial_step: 0,
    });
    // Consume the token
    await (0, setup_token_1.consumeSetupToken)(body.token, userId);
    return server_1.NextResponse.json({
        success: true,
        message: 'Superadmin account created successfully',
        user: { id: userId, email: body.email, name: body.name },
    });
}
