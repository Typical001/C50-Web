import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import express from 'express';
import type { AddressInfo } from 'node:net';
import { httpsUrl, noteProduct, premiumNotesRoutes } from './premium-notes';

test('external notes URLs preserve form parameters and reject unsafe schemes/credentials', () => {
  const url = 'https://docs.google.com/forms/d/e/example/viewform?usp=pp_url&entry.123=reference';
  assert.equal(httpsUrl(url), url);
  assert.equal(httpsUrl('https://forms.gle/example'), 'https://forms.gle/example');
  for (const value of ['http://example.com', 'javascript:alert(1)', 'https://user:pass@example.com', 'https://user@example.com', 'file:///tmp/pdf', 'https://example.com\\@evil.test', ' https://example.com', undefined]) assert.throws(() => httpsUrl(value));
});
test('product validation requires real prices and a URL only for published listings', () => {
  const p = { title: 'Notes', description: 'Description', contents: '', kind: 'note', price_paise: 100, cover_url: '', checkout_url: '', delivery_instructions: '', published: false, sort_order: 0 };
  assert.equal(noteProduct(p).published, false);
  assert.throws(() => noteProduct({ ...p, published: true }));
  for (const price_paise of [0, -100, 100.5, NaN, Infinity, '100']) assert.throws(() => noteProduct({ ...p, price_paise }));
  assert.equal(noteProduct({ ...p, published: true, checkout_url: 'https://forms.gle/example' }).price_paise, 100);
});

test('database: account isolation, deduplication, audited review, stale writes, retries and archive preservation', async () => {
  const db = new PGlite();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key); create table public.profiles(id uuid primary key, role text);
      grant select on public.profiles to service_role;`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261118082723_premium_notes.sql', import.meta.url), 'utf8'));
    // Reproduce hosted Supabase defaults before applying the follow-up hardening.
    await db.exec('grant all on public.premium_note_events to service_role');
    await db.exec(await readFile(new URL('../supabase/migrations/20261118125532_premium_notes_audit_permissions.sql', import.meta.url), 'utf8'));
    const user = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002', admin = '00000000-0000-4000-8000-000000000003';
    await db.exec(`insert into auth.users values('${user}'),('${other}'),('${admin}'); insert into profiles values('${user}','student'),('${admin}','admin');`);
    const product = (await db.query<{ id: string }>(`insert into premium_note_products(title,description,kind,price_paise,checkout_url,published) values('Notes','Description','note',5000,'https://forms.gle/example',true) returning id`)).rows[0].id;
    for (const role of ['anon', 'authenticated']) {
      await db.exec(`set role ${role}`);
      await assert.rejects(db.query('select * from premium_note_requests'));
      await assert.rejects(db.query('select * from premium_note_products'));
      await assert.rejects(db.query('select request_premium_note($1,$2)', [product, user]));
      await assert.rejects(db.query('select review_premium_note($1,$2,$3,$4,$5,$6)', [user, user, 'purchased', 'pending', 'forged', new Date().toISOString()]));
      await db.exec('reset role');
    }
    await db.exec('set role service_role');
    const request = async (owner = user) => (await db.query<{ result: any }>('select request_premium_note($1,$2) as result', [product, owner])).rows[0].result;
    const first = await request();
    assert.equal(first.request.status, 'pending'); assert.equal(first.checkout_url, 'https://forms.gle/example');
    assert.equal((await request()).request.id, first.request.id);
    assert.notEqual((await request(other)).request.id, first.request.id);
    const review = async (r: any, status: string, actor = admin) => (await db.query<{ result: any }>('select review_premium_note($1,$2,$3,$4,$5,$6) as result', [r.id, actor, status, 'pending', 'Matched external records', r.updated_at])).rows[0].result;
    await assert.rejects(review(first.request, 'purchased', user));
    const purchased = await review(first.request, 'purchased');
    assert.equal(purchased.status, 'purchased');
    await assert.rejects(review(first.request, 'rejected'));
    assert.equal((await request()).checkout_url, null);
    const rejected = await review(purchased, 'rejected');
    const retry = await request(); assert.equal(retry.request.id, rejected.id); assert.equal(retry.request.status, 'pending');
    await review(retry.request, 'purchased');
    await db.query('update premium_note_products set published=false where id=$1', [product]);
    assert.equal((await request()).request.status, 'purchased');
    await assert.rejects(request(other));
    const audit = await db.query('select * from premium_note_events where request_id=$1', [first.request.id]);
    assert.equal(audit.rows.length, 5);
    await assert.rejects(db.exec('delete from premium_note_events'));
    await assert.rejects(db.exec("update premium_note_events set reason='tampered'"));
    await assert.rejects(db.exec("update premium_note_products set checkout_url='https://user:password@example.com'"));
  } finally { await db.close(); }
});

test('HTTP: login/admin gates and own-account filtering; students cannot choose request owner', async () => {
  const calls: unknown[] = [];
  const db: any = {
    from: () => ({ select: () => ({ eq: (key: string, value: string) => { calls.push([key, value]); return { order: async () => ({ data: [], error: null }) }; } }) }),
    rpc: async (name: string, args: unknown) => { calls.push([name, args]); return { data: { request: { status: 'pending' } }, error: null }; },
  };
  const auth: any = (req: any, res: any, next: any) => { if (!req.headers.authorization) return res.sendStatus(401); req.user = { id: 'student', role: 'student' }; next(); };
  const admin: any = (req: any, res: any) => res.sendStatus(req.headers.authorization ? 403 : 401);
  const app = express(); app.use(express.json(), premiumNotesRoutes(db, auth, admin));
  const server = app.listen(0); await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(base + '/api/premium-notes/mine')).status, 401);
    assert.equal((await fetch(base + '/api/admin/premium-notes', { headers: { Authorization: 'student' } })).status, 403);
    assert.equal((await fetch(base + '/api/admin/premium-notes', { method: 'POST', headers: { Authorization: 'student' } })).status, 403);
    await fetch(base + '/api/premium-notes/mine?user_id=other', { headers: { Authorization: 'student' } });
    assert.deepEqual(calls[0], ['user_id', 'student']);
    const product = '00000000-0000-4000-8000-000000000001';
    await fetch(base + `/api/premium-notes/${product}/request`, { method: 'POST', headers: { Authorization: 'student', 'Content-Type': 'application/json' }, body: JSON.stringify({ user_id: 'other', status: 'purchased' }) });
    assert.deepEqual(calls[1], ['request_premium_note', { p_product: product, p_user: 'student' }]);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
