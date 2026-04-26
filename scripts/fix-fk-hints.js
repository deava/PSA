#!/usr/bin/env node
/**
 * Fix Supabase ambiguous relationship errors.
 * When multiple FKs exist between tables, Supabase needs a hint.
 * Use column-based hints (e.g. !user_id) instead of FK-name hints.
 *
 * Fixes:
 *   user_roles(  ->  user_roles!user_id(
 *   user_roles!user_id(  (already correct, skip)
 */
const fs = require('fs');
const path = require('path');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) files.push(...walk(full));
    else if (e.name.endsWith('.ts') || e.name.endsWith('.tsx')) files.push(full);
  }
  return files;
}

const roots = [
  path.join(__dirname, '../backend/src'),
  path.join(__dirname, '../lib'),
];

let total = 0;
for (const root of roots) {
  if (!fs.existsSync(root)) continue;
  for (const file of walk(root)) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Fix ambiguous user_roles join — use column hint !user_id
    // Match: user_roles( or user_roles ( but NOT user_roles!something(
    content = content.replace(/\buser_roles(?!!)\s*\(/g, 'user_roles!user_id(');

    // Fix ambiguous roles join inside user_roles — use column hint !role_id  
    // Only inside user_roles context: roles( -> roles!role_id(
    // We target the pattern: user_roles!user_id(\n...\n  roles(
    content = content.replace(/(user_roles!user_id\([^)]*?)(\broles(?!!)\s*\()/gs, '$1roles!role_id(');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      console.log('Fixed:', file.replace(path.join(__dirname, '..') + path.sep, ''));
      total++;
    }
  }
}
console.log(`\nDone — fixed ${total} files.`);
