"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
exports.POST = POST;
const server_1 = require("next/server");
const setup_token_1 = require("@/lib/onboarding/setup-token");
// GET - Check if first run + generate token
async function GET() {
    const firstRun = await (0, setup_token_1.isFirstRun)();
    if (!firstRun) {
        return server_1.NextResponse.json({ firstRun: false, message: 'Platform already has users.' });
    }
    const token = await (0, setup_token_1.createSetupToken)();
    if (!token) {
        return server_1.NextResponse.json({
            error: 'Failed to generate setup token. Make sure SUPABASE_SERVICE_ROLE_KEY is set in .env.local',
            hint: 'Check that your .env.local file has the SUPABASE_SERVICE_ROLE_KEY from your Supabase config.'
        }, { status: 500 });
    }
    // Log token to server console (uses console.warn so it survives production mode)
    console.warn('\n========================================');
    console.warn('SUPERADMIN SETUP TOKEN');
    console.warn(`   Token: ${token}`);
    console.warn('   Expires in 15 minutes');
    console.warn('   Enter this token at the setup screen');
    console.warn('========================================\n');
    return server_1.NextResponse.json({ firstRun: true, tokenGenerated: true });
}
// POST - Validate a token
async function POST(request) {
    const body = await request.json().catch(() => null);
    if (!body?.token) {
        return server_1.NextResponse.json({ error: 'Token is required' }, { status: 400 });
    }
    const valid = await (0, setup_token_1.validateSetupToken)(body.token);
    return server_1.NextResponse.json({ valid });
}
