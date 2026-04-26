"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET = GET;
const server_1 = require("next/server");
const setup_token_1 = require("@/lib/onboarding/setup-token");
// GET - Just check if this is a first run (no token generation)
async function GET() {
    const firstRun = await (0, setup_token_1.isFirstRun)();
    return server_1.NextResponse.json({ firstRun });
}
