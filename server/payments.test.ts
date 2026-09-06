import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import express from 'express';
import { Payments, PaymentError, rupeesToPaise, validSignature, type PaymentStore, type Purchase } from './payments';
import { paymentRoutes } from './payment-routes';

const user = crypto.randomUUID(), batchId = crypto.randomUUID();
const config = { key: 'rzp_test_fixture', secret: 'unit-test-secret', webhookSecret: 'unit-test-webhook' };
const hmac = (raw: string, secret = config.secret) => crypto.createHmac('sha256', secret).update(raw).digest('hex');
function fixture() {
  const rows = new Map<string, Purchase>();
  const events = new Map<string, string>();
  const enrollments = new Map<string, string>();
  const orders = new Map<string, any>();
  const attempts = new Map<string, any>();
  const batch = { id: batchId, is_active: true, is_paid: true, is_free: false, payment_enabled: true, price: 1000, discount_price: 999.99 };
  let finalizerError = false;
  const store: PaymentStore = {
    batch: async () => batch,
    access: async (u, b) => enrollments.has(`${u}:${b}`),
    async reserve(row) {
      const existing = [...rows.values()].find(p => p.user_id === row.user_id && p.batch_id === row.batch_id && p.status === 'pending');
      if (existing) return { ...existing };
      rows.set(row.id, { ...row }); return { ...row };
    },
    get: async id => rows.get(id) ? { ...rows.get(id)! } : null,
    byOrder: async id => { const row = [...rows.values()].find(p => p.razorpay_order_id === id); return row ? { ...row } : null; },
    async attachOrder(id, order) { rows.get(id)!.razorpay_order_id = order; return { ...rows.get(id)! }; },
    async finalize(row, payment) {
      if (finalizerError) throw new Error('Injected database outage');
      Object.assign(rows.get(row.id)!, { status: 'success', verified_at: 'test-verified', razorpay_payment_id: payment.id });
      enrollments.set(`${row.user_id}:${row.batch_id}`, row.id);
    },
    async fail(id) { if (rows.get(id)!.status === 'pending') rows.get(id)!.status = 'failed'; },
    async event(id, type, hash) { if (events.has(id) && events.get(id) !== hash) throw new PaymentError(409, 'Event hash mismatch'); events.set(id, hash); },
    async finishEvent() {}
  };
  const provider = { async request(path: string, body?: any) {
    if (path.startsWith('orders?receipt=')) {
      const receipt = new URLSearchParams(path.split('?')[1]).get('receipt');
      return { items: [...orders.values()].filter(order => order.receipt === receipt) };
    }
    if (path === 'orders') {
      const order = { ...body, id: `order_${orders.size + 1}`, status: 'created', amount_paid: 0, amount_due: body.amount };
      orders.set(order.id, order); return { ...order };
    }
    if (path.endsWith('/payments')) return { items: [...attempts.values()].filter(p => p.order_id === path.split('/')[1]) };
    return path.startsWith('orders/') ? orders.get(path.split('/')[1]) : attempts.get(path.split('/')[1]);
  } };
  const service = new Payments(store, provider, config);
  const create = () => service.create(user, { batchId });
  function capture(orderId: string, status = 'captured') {
    const order = orders.get(orderId);
    const payment = { id: 'pay_1', order_id: orderId, amount: order.amount, currency: 'INR', status, captured: status === 'captured', amount_refunded: 0, method: 'upi' };
    attempts.set(payment.id, payment);
    if (status === 'captured') Object.assign(order, { status: 'paid', amount_paid: order.amount, amount_due: 0 });
    return { razorpay_order_id: orderId, razorpay_payment_id: payment.id, razorpay_signature: hmac(`${orderId}|${payment.id}`) };
  }
  const webhook = (orderId: string, type = 'payment.captured', id = 'evt_1') => {
    const raw = JSON.stringify({ event: type, payload: { payment: { entity: { id: 'pay_1', order_id: orderId } } } });
    return service.webhook(Buffer.from(raw), hmac(raw, config.webhookSecret), id);
  };
  return { service, store, provider, create, capture, webhook, rows, orders, attempts, enrollments, events, batch,
    breakFinalizer(value: boolean) { finalizerError = value; } };
}

test('exact INR conversion and strict signatures', () => {
  assert.equal(rupeesToPaise('999.99'), 99999);
  assert.equal(rupeesToPaise('1000'), 100000);
  for (const value of ['1.001', -1, 0, NaN, Infinity, '1e3', null]) assert.throws(() => rupeesToPaise(value));
  assert.equal(validSignature('body', hmac('body'), config.secret), true);
  assert.equal(validSignature('changed', hmac('body'), config.secret), false);
  assert.equal(validSignature('body', 'bad', config.secret), false);
});
test('server-derived amount; reuse order; reject client identity/amount and disabled batch', async () => {
  const f = fixture();
  await assert.rejects(f.service.create(user, { batchId, amount: 1, user_id: user }));
  const order = await f.create();
  assert.equal(order.amount, 99999);
  assert.equal((await f.create()).orderId, order.orderId);
  assert.equal(f.rows.size, 1); assert.equal(f.orders.size, 1);
  f.batch.payment_enabled = false;
  await assert.rejects(f.create());
});
test('concurrent create-order requests create only one provider order', async () => {
  const f = fixture();
  await Promise.allSettled([f.create(), f.create(), f.create()]);
  assert.equal(f.orders.size, 1); assert.equal(f.rows.size, 1);
});
test('foreign user, invalid signature, and mismatched amount never enroll', async () => {
  const f = fixture(); const order = await f.create(); const body = f.capture(order.orderId);
  await assert.rejects(f.service.verify(crypto.randomUUID(), body));
  await assert.rejects(f.service.verify(user, { ...body, razorpay_signature: '0'.repeat(64) }));
  f.attempts.get('pay_1').amount = 1;
  await assert.rejects(f.service.verify(user, body));
  assert.equal(f.enrollments.size, 0);
});
test('authorized is pending; captured finalizes; duplicates repair enrollment', async () => {
  const f = fixture(); const order = await f.create(); let body = f.capture(order.orderId, 'authorized');
  assert.equal((await f.service.verify(user, body)).status, 'pending');
  assert.equal(f.enrollments.size, 0);
  body = f.capture(order.orderId);
  assert.equal((await f.service.verify(user, body)).status, 'success');
  await Promise.all([f.service.verify(user, body), f.webhook(order.orderId), f.webhook(order.orderId)]);
  assert.equal(f.enrollments.size, 1); assert.equal(f.rows.size, 1); assert.equal(f.events.size, 1);
  f.enrollments.clear(); await f.webhook(order.orderId);
  assert.equal(f.enrollments.size, 1);
});
test('database failure then webhook retry completes safely', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId);
  f.breakFinalizer(true); await assert.rejects(f.webhook(order.orderId));
  assert.equal(f.enrollments.size, 0);
  f.breakFinalizer(false); await f.webhook(order.orderId);
  assert.equal(f.enrollments.size, 1);
});
test('failed attempt grants nothing; later captured retry succeeds; late failure does not revoke', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId, 'failed');
  await f.webhook(order.orderId, 'payment.failed');
  assert.equal(f.enrollments.size, 0);
  f.capture(order.orderId); await f.webhook(order.orderId, 'order.paid', 'evt_2');
  f.attempts.get('pay_1').status = 'failed'; await f.webhook(order.orderId, 'payment.failed', 'evt_3');
  assert.equal(f.enrollments.size, 1); assert.equal(f.rows.get(order.paymentId)!.status, 'success');
});
test('status reconciliation checks owner and repairs missed callback/webhook', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId);
  await assert.rejects(f.service.status(crypto.randomUUID(), order.paymentId));
  assert.equal((await f.service.status(user, order.paymentId)).status, 'success');
});
test('webhook recovers missing local order link; unknown static order never enrolls', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId);
  f.rows.get(order.paymentId)!.razorpay_order_id = null;
  await f.webhook(order.orderId); assert.equal(f.enrollments.size, 1);
  f.enrollments.clear(); f.rows.clear();
  await f.webhook(order.orderId, 'order.paid', 'evt_unknown'); assert.equal(f.enrollments.size, 0);
});
test('webhook event ID reused with different body is rejected', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId);
  await f.webhook(order.orderId);
  await assert.rejects(f.webhook(order.orderId, 'order.paid'));
});
test('receipt recovery reuses a created order after the local link was lost', async () => {
  const f = fixture(); const order = await f.create();
  f.rows.get(order.paymentId)!.razorpay_order_id = null;
  assert.equal((await f.create()).orderId, order.orderId);
  assert.equal(f.orders.size, 1);
});
test('ambiguous provider POST timeout is recovered by receipt without a second POST', async () => {
  const f = fixture(); const original = f.provider.request;
  f.provider.request = async (path, body) => {
    const result = await original(path, body);
    if (path === 'orders') throw new PaymentError(503, 'Simulated timeout after order creation');
    return result;
  };
  await assert.rejects(f.create());
  assert.equal((await f.create()).orderId, 'order_1');
  assert.equal(f.orders.size, 1);
});
test('completed payment is acknowledged even when batch access is unavailable', async () => {
  const f = fixture(); const order = await f.create(); const body = f.capture(order.orderId);
  f.store.access = async () => false;
  const result = await f.service.verify(user, body);
  assert.equal(result.status, 'success'); assert.equal(result.hasAccess, false);
  await f.webhook(order.orderId);
});
test('captured event with not-yet-captured provider state requests webhook retry', async () => {
  const f = fixture(); const order = await f.create(); f.capture(order.orderId, 'authorized');
  await assert.rejects(f.webhook(order.orderId), (error: any) => error.status === 503);
  assert.equal(f.enrollments.size, 0);
});
test('currency, foreign order mapping, and wrong environment fail closed', async () => {
  const f = fixture(); const order = await f.create(); const body = f.capture(order.orderId);
  f.attempts.get('pay_1').currency = 'USD'; await assert.rejects(f.service.verify(user, body));
  f.attempts.get('pay_1').currency = 'INR';
  f.orders.get(order.orderId).notes.c50_payment_id = crypto.randomUUID(); await assert.rejects(f.service.verify(user, body));
  f.orders.get(order.orderId).notes.c50_payment_id = order.paymentId;
  f.rows.get(order.paymentId)!.gateway_mode = 'live'; await assert.rejects(f.service.verify(user, body));
  assert.equal(f.enrollments.size, 0);
});
test('raw Express webhook body validates before JSON parsing; changed bytes rejected', async () => {
  const f = fixture(); const app = express();
  const routes = paymentRoutes(f.service, (_req, res) => { res.sendStatus(401); });
  app.use(routes.webhook); app.use(express.json()); app.use(routes.api);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const raw = '{ "event": "unhandled.event" }';
  try {
    const send = (body: string) => fetch(`http://127.0.0.1:${address.port}/api/payments/razorpay/webhook`, {
      method: 'POST', body, headers: { 'Content-Type': 'application/json', 'X-Razorpay-Signature': hmac(raw, config.webhookSecret), 'X-Razorpay-Event-Id': 'evt_raw' }
    });
    assert.equal((await send(raw)).status, 200);
    assert.equal((await send(JSON.stringify(JSON.parse(raw)))).status, 400);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
