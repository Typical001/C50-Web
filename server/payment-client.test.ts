import test from 'node:test';
import assert from 'node:assert/strict';
import { confirmedAccess, createPurchase, verifyPurchase } from '../src/lib/paymentClient';

test('UI access requires successful server status, access, and exact batch/payment', () => {
  const valid = { paymentId: 'p', batchId: 'b', status: 'success' as const, hasAccess: true };
  assert.equal(confirmedAccess(valid, 'b', 'p'), true);
  assert.equal(confirmedAccess({ ...valid, status: 'pending' }, 'b', 'p'), false);
  assert.equal(confirmedAccess({ ...valid, hasAccess: false }, 'b', 'p'), false);
  assert.equal(confirmedAccess(valid, 'other', 'p'), false);
  assert.equal(confirmedAccess(valid, 'b', 'other'), false);
});
test('browser order and verification requests contain only approved fields', async () => {
  const original = globalThis.fetch;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const requests: any[] = [];
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => 'fixture-token' } });
  globalThis.fetch = async (_url, options) => {
    requests.push(options); return new Response(JSON.stringify({ status: 'pending' }), { status: 200 });
  };
  try {
    await createPurchase('batch');
    await verifyPurchase({ razorpay_order_id: 'order', razorpay_payment_id: 'payment', razorpay_signature: 'signature', amount: 1, user_id: 'forged' } as any);
    assert.deepEqual(JSON.parse(requests[0].body), { batchId: 'batch' });
    assert.deepEqual(Object.keys(JSON.parse(requests[1].body)).sort(), ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);
    assert.equal(requests[0].headers.Authorization, 'Bearer fixture-token');
    globalThis.fetch = async () => new Response(JSON.stringify({ error: 'Payment not found.' }), { status: 404 });
    await assert.rejects(createPurchase('batch'), /Payment not found/);
  } finally {
    globalThis.fetch = original;
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor); else delete (globalThis as any).localStorage;
  }
});
