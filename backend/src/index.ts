import 'dotenv/config';

// Fix: Node.js DNS resolution fails on some Windows setups.
import { setDefaultResultOrder, setServers } from 'dns';
setDefaultResultOrder('ipv4first');
try { setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']); } catch { /* ignore */ }

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { createRouter } from './router';
import { createAdminSupabaseClient } from './lib/supabase-server';

// Make admin client globally available for route files that reference it without importing
// This is a compatibility shim for routes that use `admin` as an undeclared variable
(global as any).admin = createAdminSupabaseClient();
(global as any).supabase = createAdminSupabaseClient();
(global as any).createApiSupabaseClient = (req: any) => {
  const { createApiSupabaseClient } = require('./lib/supabase-server');
  return createApiSupabaseClient(req);
};

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors({
  origin: true, // Allow all origins in development
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logger
app.use((req: any, _res: any, next: any) => {
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
    const { createAdminSupabaseClient } = await import('./lib/supabase-server');
    const admin = createAdminSupabaseClient();
    if (!admin) return res.status(500).json({ error: 'Supabase not configured' });

    const tables = ['user_profiles', 'roles', 'departments', 'workflow_templates', 'workflow_nodes', 'workflow_connections', 'workflow_instances', 'projects', 'accounts', 'time_entries', 'invitations'];
    const results: Record<string, string> = {};

    for (const table of tables) {
      const { error } = await admin.from(table).select('id').limit(1);
      results[table] = error ? `ERROR: ${error.message}` : 'OK';
    }

    res.json({ tables: results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// All API routes
app.use('/api', createRouter());

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error handler
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`\n🚀 Worklo Backend running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});

export default app;
