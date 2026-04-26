"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkDemoModeForDestructiveAction = checkDemoModeForDestructiveAction;
exports.isDemoModeServer = isDemoModeServer;
const server_1 = require("next/server");
const demo_mode_1 = require("./demo-mode");
/**
 * API route helper to check and block destructive actions in demo mode.
 * Returns a 403 response if the action is blocked, or null if allowed.
 *
 * Usage in API routes:
 * ```typescript
 * export async function DELETE(request: NextRequest) {
 *   const blocked = checkDemoModeForDestructiveAction('delete_project');
 *   if (blocked) return blocked;
 *
 *   // Continue with delete logic...
 * }
 * ```
 */
function checkDemoModeForDestructiveAction(action) {
    if ((0, demo_mode_1.isActionBlocked)(action)) {
        return server_1.NextResponse.json({
            error: (0, demo_mode_1.getBlockedActionMessage)(action),
            code: 'DEMO_MODE_BLOCKED',
            action,
        }, { status: 403 });
    }
    return null;
}
/**
 * Helper to determine if demo mode is active on the server side.
 */
function isDemoModeServer() {
    return process.env.NEXT_PUBLIC_DEMO_MODE === 'true' || process.env.DEMO_MODE === 'true';
}
