#!/usr/bin/env node
/**
 * Worklo Demo Mode Startup Script
 * Starts Next.js with NEXT_PUBLIC_DEMO_MODE=true
 */

const { spawn } = require('child_process');
const path = require('path');

const isWindows = process.platform === 'win32';
const nextBin = path.join(process.cwd(), 'node_modules', '.bin', isWindows ? 'next.cmd' : 'next');

console.log('\n🚀 Starting Worklo in Demo Mode...\n');

const child = spawn(nextBin, ['dev'], {
  cwd: process.cwd(),
  stdio: 'inherit',
  shell: false,
  env: {
    ...process.env,
    NEXT_PUBLIC_DEMO_MODE: 'true',
  },
});

child.on('exit', (code) => process.exit(code || 0));
process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
