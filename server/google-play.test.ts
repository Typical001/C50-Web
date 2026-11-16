import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validatePlayPurchase, verifiedOrderTotal } from './google-play';
import express from 'express';
import { googlePlayRoutes } from './google-play-routes';
import type { AddressInfo } from 'node:net';

const receipt = { productLineItem: [{ productId: 'batch_1', quantity: 1 }], obfuscatedExternalAccountId: 'account', purchaseStateContext: { purchaseState: 'PURCHASED' } };
test('Google verification rejects wrong account, product, quantity, unknown state and unauthorized tests', () => {
  assert.equal(validatePlayPurchase(receipt, 'batch_1', 'account', false).state, 'PURCHASED');
  assert.throws(() => validatePlayPurchase(receipt, 'batch_1', 'other', false));
  assert.throws(() => validatePlayPurchase(receipt, 'other', 'account', false));
  assert.throws(() => validatePlayPurchase({ ...receipt, productLineItem: [{ productId: 'batch_1', quantity: 2 }] }, 'batch_1', 'account', false));
  assert.throws(() => validatePlayPurchase({ ...receipt, testPurchaseContext: {} }, 'batch_1', 'account', false));
  assert.equal(validatePlayPurchase({ ...receipt, testPurchaseContext: {} }, 'batch_1', 'account', true).test, true);
  assert.throws(() => validatePlayPurchase({ ...receipt, purchaseStateContext: { purchaseState: 'UNKNOWN' } }, 'batch_1', 'account', false));
  assert.equal(validatePlayPurchase({ ...receipt, purchaseStateContext: { purchaseState: 'PENDING' } }, 'batch_1', 'account', false).state, 'PENDING');
});

test('SQL migration: private tokens, pending denial, replay, account binding, cancellation and cross-provider access', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth;
      create function auth.role() returns text language sql as $$ select current_setting('request.jwt.claim.role',true) $$;
      create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create table auth.users(id uuid primary key);
      create table public.profiles(id uuid primary key,role text);
      create table public.batches(id uuid primary key,is_active boolean,is_paid boolean,catalog_visible boolean,payment_enabled boolean);
      create table public.payments(id uuid primary key default gen_random_uuid(),user_id uuid,batch_id uuid,payment_gateway text default 'razorpay',amount numeric,status text,currency text,gateway_order_id text,razorpay_order_id text,razorpay_payment_id text,verified_at timestamptz,updated_at timestamptz);
      create table public.enrollments(user_id uuid,batch_id uuid,status text,access_type text,payment_id uuid,unique(user_id,batch_id));
      select set_config('request.jwt.claim.role','service_role',false);
    `);
    await db.exec(await readFile(new URL('../supabase/migrations/20261115062543_google_play_billing.sql', import.meta.url), 'utf8'));
    const u = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002', b = '00000000-0000-4000-8000-000000000003';
    await db.exec(`insert into auth.users values('${u}'),('${other}'); insert into public.batches values('${b}',true,true,true,true); insert into public.google_play_products(batch_id,product_id) values('${b}','batch_1');`);
    await db.exec(await readFile(new URL('../supabase/migrations/20261115062749_google_play_catalog_bindings.sql', import.meta.url), 'utf8'));
    await db.exec(await readFile(new URL('../supabase/migrations/20261115144004_google_play_order_totals.sql', import.meta.url), 'utf8'));
    await assert.rejects(db.exec(`update public.google_play_products set product_id='changed' where batch_id='${b}'`));
    const record = async (state: string, user = u) => db.query('select public.record_google_play_purchase($1,$2,$3,$4,$5,$6,$7,$8) as id', ['a'.repeat(64), 'fixture-token-only', user, b, 'batch_1', state, 'fixture-order', true]);
    const access = async () => (await db.query<{ access: boolean }>('select public.has_active_batch_access($1,$2) as access',[u,b])).rows[0].access;
    await record('PENDING'); assert.equal(await access(),false);
    await record('PURCHASED'); assert.equal(await access(),true);
    await record('PURCHASED');
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.payments')).rows[0].count,1);
    await assert.rejects(db.exec("update public.payments set google_order_total=-1"));
    await assert.rejects(db.exec("update public.payments set google_order_currency='invalid'"));
    await assert.rejects(db.exec("update public.payments set google_order_state='UNKNOWN'"));
    await assert.rejects(record('PURCHASED',other));
    await record('PENDING'); assert.equal(await access(),true);
    await record('CANCELLED'); assert.equal(await access(),false);
    await record('PURCHASED'); assert.equal(await access(),false);
    await db.exec(`insert into public.payments(user_id,batch_id,amount,status,currency,razorpay_order_id,razorpay_payment_id,verified_at) values('${u}','${b}',50,'success','INR','order_fixture','pay_fixture',now());`);
    assert.equal(await access(),true);
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.role','authenticated',false); select set_config('request.jwt.claim.sub','${other}',false);`);
    assert.equal(await access(),false);
    await assert.rejects(db.query('select purchase_token from public.google_play_purchases'));
    await assert.rejects(record('PURCHASED'));
    await assert.rejects(db.exec(`insert into public.google_play_products(batch_id,product_id) values('${b}','bad')`));
    await db.exec('reset role');
  } finally { await db.close(); }
});

test('Google totals are bound to the verified token/product and retain decimal precision', () => {
 const order = { orderId: 'order', purchaseToken: 'token', state: 'PROCESSED', lineItems: [{productId:'product'}], total: {currencyCode:'INR',units:'49',nanos:990000000} };
 assert.deepEqual(verifiedOrderTotal(order,'order','token','product'),{total:'49.990000000',currency:'INR',state:'PROCESSED'});
 assert.throws(() => verifiedOrderTotal(order,'order','stolen','product'));
 assert.throws(() => verifiedOrderTotal({...order,total:undefined},'order','token','product'));
 assert.throws(() => verifiedOrderTotal({...order,total:{...order.total,nanos:1e9}},'order','token','product'));
});

test('scheduled reconciliation rejects missing/wrong credentials and fails closed on Vault lookup failure', async () => {
  const previous = process.env.GOOGLE_PLAY_RECONCILE_SECRET;
  delete process.env.GOOGLE_PLAY_RECONCILE_SECRET;
  let unavailable = false;
  let queries = 0;
  const secret = 'fixture-only-'.repeat(5);
  const db = {
    rpc: async (name: string, args: { p_token: string }) => {
      assert.equal(name, 'validate_google_play_reconcile_token');
      return { data: args.p_token === secret, error: unavailable ? { message: 'fixture outage' } : null };
    },
    from: (table: string) => {
      queries++;
      assert.equal(table, 'google_play_purchases');
      const query = { select: () => query, neq: () => query, order: () => query, limit: async (n: number) => {
        assert.equal(n, 10); return { data: [], error: null };
      } };
      return query;
    },
  };
  const app = express(); app.use(express.json());
  const deny: express.RequestHandler = (_req, res) => { res.sendStatus(401); };
  app.use(googlePlayRoutes(db as any, deny, deny));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/google-play/reconcile`;
  try {
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    assert.equal((await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${'x'.repeat(64)}` } })).status, 401);
    assert.equal(queries, 0);
    const accepted = await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } });
    assert.equal(accepted.status, 200); assert.deepEqual(await accepted.json(), { checked: 0 });
    unavailable = true;
    assert.equal((await fetch(url, { method: 'POST', headers: { authorization: `Bearer ${secret}` } })).status, 503);
    assert.equal(queries, 1);
  } finally {
    server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(e => e ? reject(e) : resolve()));
    if (previous === undefined) delete process.env.GOOGLE_PLAY_RECONCILE_SECRET;
    else process.env.GOOGLE_PLAY_RECONCILE_SECRET = previous;
  }
});
