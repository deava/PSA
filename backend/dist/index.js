"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
// Fix: Node.js DNS resolution fails on some Windows setups.
// Force Google's public DNS so Supabase (and all external hosts) resolve correctly.
const dns_1 = require("dns");
(0, dns_1.setDefaultResultOrder)('ipv4first');
try {
    (0, dns_1.setServers)(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
}
catch { /* ignore */ }
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const router_1 = require("./router");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 4000;
// Middleware
app.use((0, cors_1.default)({
    origin: true, // Allow all origins in development
    credentials: true,
}));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true }));
app.use((0, cookie_parser_1.default)());
// Request logger
app.use((req, _res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
// Health check
app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Worklo-backend', timestamp: new Date().toISOString() });
});
// DB diagnostic — check which tables exist
app.get('/health/db', async (_req, res) => {
    try {
        const { createAdminSupabaseClient } = await Promise.resolve().then(() => __importStar(require('./lib/supabase-server')));
        const admin = createAdminSupabaseClient();
        if (!admin)
            return res.status(500).json({ error: 'Supabase not configured' });
        const tables = ['user_profiles', 'roles', 'departments', 'workflow_templates', 'workflow_nodes', 'workflow_connections', 'workflow_instances', 'projects', 'accounts', 'time_entries', 'invitations'];
        const results = {};
        for (const table of tables) {
            const { error } = await admin.from(table).select('id').limit(1);
            results[table] = error ? `ERROR: ${error.message}` : 'OK';
        }
        res.json({ tables: results });
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
// All API routes
app.use('/api', (0, router_1.createRouter)());
// 404 handler
app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
});
// Error handler
app.use((err, _req, res, _next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
});
app.listen(PORT, () => {
    console.log(`\n🚀 Worklo Backend running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/health\n`);
});
exports.default = app;
