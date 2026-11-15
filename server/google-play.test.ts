import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { validatePlayPurchase } from './google-play';

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
    await assert.rejects(db.exec(`update public.google_play_products set product_id='changed' where batch_id='${b}'`));
    const record = async (state: string, user = u) => db.query('select public.record_google_play_purchase($1,$2,$3,$4,$5,$6,$7,$8) as id', ['a'.repeat(64), 'fixture-token-only', user, b, 'batch_1', state, 'fixture-order', true]);
    const access = async () => (await db.query<{ access: boolean }>('select public.has_active_batch_access($1,$2) as access',[u,b])).rows[0].access;
    await record('PENDING'); assert.equal(await access(),false);
    await record('PURCHASED'); assert.equal(await access(),true);
    await record('PURCHASED');
    assert.equal((await db.query<{ count: number }>('select count(*)::int as count from public.payments')).rows[0].count,1);
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
