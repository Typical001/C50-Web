// Read-only API smoke test. Requires a built server and configured backend env.
import 'dotenv/config';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { createClient } from '@supabase/supabase-js';

const database = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } });
const { data: students, error } = await database.from('profiles').select('id').eq('role', 'student').limit(1);
if (error || !students?.length) throw new Error('An existing student is required');
const student = students[0].id;
const secret = process.env.SESSION_SECRET;
// Deliberately claim admin: the server must ignore this and load the real role.
const cipher = crypto.createCipheriv('aes-256-cbc', crypto.scryptSync(secret, 'salt-session', 32), Buffer.alloc(16));
const encrypted = cipher.update(JSON.stringify({ id: student, role: 'admin', email: '', expiresAt: Date.now() + 60000 }), 'utf8', 'hex') + cipher.final('hex');
const token = encrypted + '.' + crypto.createHmac('sha256', secret).update(encrypted).digest('hex');
const port = 3107;
const server = spawn(process.execPath, ['dist/server.cjs'], {
  env: { ...process.env, PORT: String(port), NODE_ENV: 'production' }, stdio: 'ignore', windowsHide: true
});
const request = (route, auth = token, method = 'GET') => fetch(`http://127.0.0.1:${port}${route}`, {
  method, headers: { 'X-Forwarded-Proto': 'https', ...(auth ? { Authorization: `Bearer ${auth}` } : {}) }
});
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (server.exitCode !== null) throw new Error('Test server failed to start');
    try { ready = (await request('/health', '')).ok; } catch {}
    if (ready) break;
    await delay(200);
  }
  assert.ok(ready, 'Server ready');
  const missingBatch = crypto.randomUUID();
  assert.equal((await request(`/api/batches/${missingBatch}/structure`, '')).status, 401);
  assert.equal((await request(`/api/batches/${missingBatch}/structure`, 'invalid.jwt.token')).status, 401);
  assert.equal((await request(`/api/batches/${missingBatch}/structure`)).status, 403);
  assert.equal((await request('/api/admin/payments')).status, 403, 'Token role must not grant admin');
  assert.equal((await request('/api/payments/verify', token, 'POST')).status, 400, 'Simulator/missing identifiers must be rejected');
  assert.equal((await request('/api/payments/create-order', '', 'POST')).status, 401);
  assert.equal((await request(`/api/payments/${crypto.randomUUID()}/status`)).status, 404);
  const denied = await request(`/api/batches/${missingBatch}/access`);
  assert.equal(denied.status, 200);
  assert.equal((await denied.json()).hasAccess, false);
  const { data: enrollments, error: enrollmentError } = await database.from('enrollments')
    .select('batch_id,batches!inner(is_paid,is_active)').eq('user_id', student).eq('status', 'active')
    .eq('batches.is_paid', false).eq('batches.is_active', true).limit(1);
  if (enrollmentError) throw new Error('Could not load free enrollment fixture');
  assert.ok(enrollments?.length, 'Existing active free enrollment fixture required');
  const free = await request(`/api/batches/${enrollments[0].batch_id}/structure`);
  assert.equal(free.status, 200, 'Free enrolled course must remain accessible');
  console.log('PASS: missing/invalid auth, unpaid access denial, authoritative role, invalid payment request denial, owner-only payment status, free enrolled course');
} finally {
  server.kill();
}
