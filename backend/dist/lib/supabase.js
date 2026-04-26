"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.supabaseAdmin = void 0;
exports.createUserClient = createUserClient;
const supabase_js_1 = require("@supabase/supabase-js");
// Admin client — bypasses RLS (server-side only, never expose to client)
exports.supabaseAdmin = (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
// User-scoped client — respects RLS
function createUserClient(accessToken) {
    return (0, supabase_js_1.createClient)(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}
