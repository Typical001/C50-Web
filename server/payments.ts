import crypto from 'node:crypto';

export class PaymentError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
export type Purchase = {
  id: string; user_id: string; batch_id: string; amount: number; amount_paise: number;
  currency: string; gateway_mode: string; status: string; razorpay_order_id: string | null;
  razorpay_payment_id?: string | null; verified_at?: string | null;
};
export interface PaymentStore {
  batch(id: string): Promise<any>;
  access(user: string, batch: string): Promise<boolean>;
  reserve(row: Purchase): Promise<Purchase>;
  get(id: string): Promise<Purchase | null>;
  byOrder(id: string): Promise<Purchase | null>;
  attachOrder(id: string, order: string): Promise<Purchase>;
  finalize(row: Purchase, payment: any, signature: string | null): Promise<void>;
  fail(id: string): Promise<void>;
  event(id: string, type: string, hash: string): Promise<void>;
  finishEvent(id: string, status: string, paymentId: string | null): Promise<void>;
}
export interface Provider { request(path: string, body?: unknown): Promise<any>; }
export function rupeesToPaise(value: unknown): number {
  // Decimal-string arithmetic avoids floating-point rounding and rejects fractions of a paise.
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(String(value));
  if (!match) throw new PaymentError(400, 'Invalid batch price.');
  const result = BigInt(match[1]) * 100n + BigInt((match[2] || '').padEnd(2, '0'));
  if (result <= 0n || result > BigInt(Number.MAX_SAFE_INTEGER)) throw new PaymentError(400, 'Invalid batch price.');
  return Number(result);
}
export function validSignature(body: string | Buffer, signature: unknown, secret: string): boolean {
  if (typeof signature !== 'string' || !/^[a-f0-9]{64}$/i.test(signature) || !secret) return false;
  return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), crypto.createHmac('sha256', secret).update(body).digest());
}
export function razorpayProvider(key: string, secret: string): Provider {
  return { async request(path, body) {
    try {
      const response = await fetch(`https://api.razorpay.com/v1/${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Authorization: `Basic ${Buffer.from(`${key}:${secret}`).toString('base64')}`, 'Content-Type': 'application/json' },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw new Error('Provider rejected request');
      return await response.json();
    } catch {
      // Never return provider response bodies or credentials to clients/logs.
      throw new PaymentError(503, 'Payment provider unavailable. Please retry confirmation shortly.');
    }
  } };
}
const providerId = (value: unknown, prefix: string): value is string => typeof value === 'string' && new RegExp(`^${prefix}_[A-Za-z0-9]{1,80}$`).test(value);
const uuid = (value: unknown): value is string => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export function onlyFields(body: any, fields: string[]) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !fields.includes(key))) {
    throw new PaymentError(400, 'Invalid payment request fields.');
  }
}

export class Payments {
  readonly mode: string;
  constructor(private store: PaymentStore, private provider: Provider,
    private config: { key: string; secret: string; webhookSecret: string }) {
    this.mode = config.key.startsWith('rzp_live_') ? 'live' : 'test';
  }
  private configured() {
    if (!/^rzp_(test|live)_[A-Za-z0-9]+$/.test(this.config.key) || !this.config.secret) {
      throw new PaymentError(503, 'Paid checkout is not configured.');
    }
  }
  private checkOrder(row: Purchase, order: any) {
    if (!providerId(order?.id, 'order') || row.gateway_mode !== this.mode || order.amount !== row.amount_paise ||
      order.currency !== row.currency || order.receipt !== row.id || order.notes?.c50_payment_id !== row.id ||
      (row.razorpay_order_id && row.razorpay_order_id !== order.id)) {
      throw new PaymentError(409, 'Payment order does not match this purchase.');
    }
  }
  private async recoverOrder(row: Purchase): Promise<Purchase> {
    if (row.razorpay_order_id) return row;
    // Receipt lookup is read-only: never repeat an ambiguous order-creation POST.
    const collection = await this.provider.request(`orders?receipt=${encodeURIComponent(row.id)}&count=100`);
    const matches = collection.items?.filter((order: any) => order.receipt === row.id) || [];
    if (matches.length > 1) throw new PaymentError(409, 'Multiple provider orders require support reconciliation.');
    if (matches.length === 1) {
      this.checkOrder(row, matches[0]);
      return this.store.attachOrder(row.id, matches[0].id);
    }
    return row;
  }
  private async reconcile(row: Purchase, payment: any, order: any, signature: string | null) {
    this.checkOrder(row, order);
    if (!providerId(payment?.id, 'pay') || payment.order_id !== order.id || payment.amount !== row.amount_paise ||
      payment.currency !== row.currency) {
      throw new PaymentError(409, 'Payment does not match this purchase.');
    }
    if (payment.status !== 'failed' && row.razorpay_payment_id && row.razorpay_payment_id !== payment.id) {
      throw new PaymentError(409, 'Purchase already has a different successful payment.');
    }
    if (payment.status === 'captured' && payment.captured === true && order.status === 'paid' &&
      order.amount_paid === row.amount_paise && order.amount_due === 0 && !(payment.amount_refunded > 0)) {
      await this.store.finalize(row, payment, signature);
    } else if (payment.status === 'failed') {
      await this.store.fail(row.id); // Conditional pending-only update; never touches enrollment.
    }
    return this.result(row.id, row.user_id);
  }
  private async result(id: string, user: string) {
    const row = await this.store.get(id);
    if (!row || row.user_id !== user) throw new PaymentError(404, 'Payment not found.');
    const paid = !!row.verified_at && row.status === 'success';
    const hasAccess = paid && await this.store.access(user, row.batch_id);
    // Payment receipt and current content availability are distinct (e.g. an inactive batch).
    return { paymentId: row.id, batchId: row.batch_id, status: paid ? 'success' : row.status === 'failed' ? 'failed' : 'pending', hasAccess,
      message: paid ? 'Payment Successful' : row.status === 'failed' ? 'Payment failed. You can retry checkout.' : 'Payment confirmation pending.' };
  }
  async create(user: string, body: any) {
    this.configured();
    onlyFields(body, ['batchId']);
    if (!uuid(body.batchId)) throw new PaymentError(400, 'Invalid batch ID.');
    const batch = await this.store.batch(body.batchId);
    if (!batch || !batch.is_active || !batch.is_paid || batch.is_free || !batch.payment_enabled) {
      throw new PaymentError(400, 'This batch is not available for paid checkout.');
    }
    if (await this.store.access(user, batch.id)) throw new PaymentError(409, 'You already have access to this batch.');
    const amount = rupeesToPaise(Number(batch.discount_price) > 0 ? batch.discount_price : batch.price);
    const id = crypto.randomUUID();
    let row = await this.store.reserve({ id, user_id: user, batch_id: batch.id, amount: amount / 100, amount_paise: amount,
      currency: 'INR', status: 'pending', gateway_mode: this.mode, razorpay_order_id: null });
    if (row.gateway_mode !== this.mode) throw new PaymentError(409, 'Existing purchase requires reconciliation before changing payment mode.');
    if (row.id === id) {
      // Do not automatically retry this POST after a timeout: it may already have created an order.
      const order = await this.provider.request('orders', { amount, currency: 'INR', receipt: id, notes: { c50_payment_id: id } });
      this.checkOrder(row, order);
      await this.store.attachOrder(id, order.id);
      row.razorpay_order_id = order.id;
    } else {
      row = await this.recoverOrder(row);
    }
    if (!row.razorpay_order_id) throw new PaymentError(409, 'Order creation is pending reconciliation. Please contact support before retrying payment.');
    return { paymentId: row.id, orderId: row.razorpay_order_id, amount: row.amount_paise, currency: row.currency, keyId: this.config.key };
  }
  async verify(user: string, body: any) {
    this.configured();
    onlyFields(body, ['razorpay_order_id', 'razorpay_payment_id', 'razorpay_signature']);
    if (!providerId(body.razorpay_order_id, 'order') || !providerId(body.razorpay_payment_id, 'pay')) throw new PaymentError(400, 'Invalid payment identifiers.');
    const row = await this.store.byOrder(body.razorpay_order_id);
    if (!row || row.user_id !== user) throw new PaymentError(404, 'Payment not found.');
    if (!validSignature(`${row.razorpay_order_id}|${body.razorpay_payment_id}`, body.razorpay_signature, this.config.secret)) {
      throw new PaymentError(400, 'Invalid payment signature.');
    }
    const [order, payment] = await Promise.all([this.provider.request(`orders/${row.razorpay_order_id}`), this.provider.request(`payments/${body.razorpay_payment_id}`)]);
    if (payment.id !== body.razorpay_payment_id) throw new PaymentError(409, 'Payment identifier mismatch.');
    return this.reconcile(row, payment, order, body.razorpay_signature);
  }
  async status(user: string, id: string) {
    this.configured();
    if (!uuid(id)) throw new PaymentError(400, 'Invalid payment ID.');
    let row = await this.store.get(id);
    if (!row || row.user_id !== user) throw new PaymentError(404, 'Payment not found.');
    if (row.gateway_mode !== this.mode) throw new PaymentError(409, 'Purchase payment mode does not match server configuration.');
    row = await this.recoverOrder(row);
    if (row.razorpay_order_id) {
      const order = await this.provider.request(`orders/${row.razorpay_order_id}`);
      this.checkOrder(row, order);
      const attempts = await this.provider.request(`orders/${row.razorpay_order_id}/payments`);
      const captured = attempts.items?.find((p: any) => p.status === 'captured');
      if (captured) return this.reconcile(row, captured, order, null);
    }
    return this.result(id, user);
  }
  async webhook(raw: Buffer, signature: unknown, eventId: unknown) {
    this.configured();
    if (!this.config.webhookSecret) throw new PaymentError(503, 'Payment webhook is not configured.');
    if (!Buffer.isBuffer(raw) || !validSignature(raw, signature, this.config.webhookSecret)) throw new PaymentError(400, 'Invalid webhook signature.');
    if (typeof eventId !== 'string' || !/^[A-Za-z0-9_-]{1,200}$/.test(eventId)) throw new PaymentError(400, 'Missing or invalid webhook event ID.');
    let event: any;
    try { event = JSON.parse(raw.toString('utf8')); } catch { throw new PaymentError(400, 'Invalid webhook JSON.'); }
    if (typeof event?.event !== 'string') throw new PaymentError(400, 'Invalid webhook event.');
    await this.store.event(eventId, event.event, crypto.createHash('sha256').update(raw).digest('hex'));
    let row: Purchase | null = null;
    try {
      if (['payment.captured', 'order.paid', 'payment.failed'].includes(event.event)) {
        const entity = event.payload?.payment?.entity;
        if (!providerId(entity?.id, 'pay')) throw new PaymentError(400, 'Invalid webhook payment.');
        if (entity.order_id == null) {
          await this.store.finishEvent(eventId, 'ignored', null);
          return { received: true }; // Standalone payment/button without an Orders purchase.
        }
        if (!providerId(entity.order_id, 'order')) throw new PaymentError(400, 'Invalid webhook order.');
        const [order, payment] = await Promise.all([this.provider.request(`orders/${entity.order_id}`), this.provider.request(`payments/${entity.id}`)]);
        if (payment.id !== entity.id) throw new PaymentError(409, 'Payment identifier mismatch.');
        row = await this.store.byOrder(order.id);
        // Recover the DB-link write if order creation succeeded before a server outage.
        if (!row && uuid(order.receipt) && order.notes?.c50_payment_id === order.receipt) {
          row = await this.store.get(order.receipt);
          if (row) { this.checkOrder(row, order); row = await this.store.attachOrder(row.id, order.id); }
        }
        if (row) {
          const result = await this.reconcile(row, payment, order, null);
          if (event.event !== 'payment.failed' && result.status === 'pending') {
            throw new PaymentError(503, 'Capture confirmation pending. Retry webhook.');
          }
        }
        // Unknown/static-button orders remain audit-only and never enroll a student.
      }
      await this.store.finishEvent(eventId, row ? 'processed' : 'ignored', row?.id || null);
      return { received: true };
    } catch (error) {
      await this.store.finishEvent(eventId, 'failed', row?.id || null);
      throw error; // Non-2xx makes Razorpay retry; finalization remains idempotent.
    }
  }
}
