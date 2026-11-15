import express, { type RequestHandler } from 'express';
import crypto from 'node:crypto';
import { OAuth2Client } from 'google-auth-library';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, onlyFields } from './payments';
import { googlePlayProvider, PLAY_PACKAGE, validatePlayPurchase } from './google-play';

export function googlePlayRoutes(db: SupabaseClient, auth: RequestHandler, admin: RequestHandler) {
  const router = express.Router();
  const google = googlePlayProvider();
  const oidc = new OAuth2Client();
  const testers = new Set((process.env.GOOGLE_PLAY_TESTER_USER_IDS || '').split(',').map(x => x.trim()).filter(Boolean));
  const enabled = () => {
    if (process.env.GOOGLE_PLAY_BILLING_ENABLED !== 'true') throw new PaymentError(503, 'Google Play checkout is not available yet.');
  };
  async function one(query: any): Promise<any> {
    const { data, error } = await query;
    if (error) throw new PaymentError(503, 'Purchase records are temporarily unavailable. Please retry.');
    return data;
  }
  const run = (fn: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    try { res.json(await fn(req)); }
    catch (error) { res.status(error instanceof PaymentError ? error.status : 503).json({ error: error instanceof PaymentError ? error.message : 'Google Play processing unavailable. Please retry.' }); }
  };
  const windows = new Map<string, { count: number; until: number }>();
  const limit: RequestHandler = (req: any, res, next) => {
    const now = Date.now();
    for (const [key, value] of windows) if (value.until < now) windows.delete(key);
    const key = req.user.id;
    const value = windows.get(key) || { count: 0, until: now + 60000 };
    windows.set(key, value); value.count++;
    if (value.count > 30) { res.status(429).json({ error: 'Please wait a minute before retrying.' }); return; }
    next();
  };
  async function verify(token: unknown, user?: string, expectedProduct?: string) {
    if (typeof token !== 'string' || token.length < 10 || token.length > 4096 || /\s/.test(token)) throw new PaymentError(400, 'Invalid Google purchase token.');
    const purchase = await google.get(token);
    const product = purchase.productLineItem?.[0]?.productId;
    if (!product || (expectedProduct && product !== expectedProduct)) throw new PaymentError(400, 'Purchase product mismatch.');
    const mapping = await one(db.from('google_play_products').select('*').eq('product_id', product).maybeSingle());
    const accountId = purchase.obfuscatedExternalAccountId;
    if (!mapping || !accountId || !/^[a-f0-9-]{36}$/i.test(accountId)) throw new PaymentError(403, 'Purchase cannot be linked to a learning account.');
    const account = await one(db.from('google_play_accounts').select('*').eq('account_id', accountId).maybeSingle());
    if (!account || (user && account.user_id !== user)) throw new PaymentError(403, 'This purchase belongs to another learning account.');
    const verified = validatePlayPurchase(purchase, product, account.account_id, testers.has(account.user_id));
    const hash = crypto.createHash('sha256').update(token).digest('hex');
    const paymentId = await one(db.rpc('record_google_play_purchase', {
      p_hash: hash, p_token: token, p_user: account.user_id, p_batch: mapping.batch_id,
      p_product: product, p_state: verified.state, p_order: purchase.orderId || null, p_test: verified.test,
    }));
    // Durable entitlement precedes acknowledgement. A failed acknowledgement is retried by reconciliation.
    if (verified.state === 'PURCHASED') {
      try {
        if (purchase.acknowledgementState !== 'ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED') await google.acknowledge(product, token);
        await one(db.from('google_play_purchases').update({ acknowledged: true }).eq('token_hash', hash));
      } catch { /* Do not log provider errors: they may contain the token URL. */ }
    }
    const access = await one(db.rpc('has_active_batch_access', { p_user_id: account.user_id, p_batch_id: mapping.batch_id }));
    return { paymentId, batchId: mapping.batch_id, state: verified.state, hasAccess: access === true };
  }
  router.get('/api/google-play/catalog', auth, limit, run(async () => {
    enabled();
    const mappings = await one(db.from('google_play_products').select('batch_id,product_id').eq('enabled', true));
    const batches = await one(db.from('batches').select('id').eq('is_active', true).eq('catalog_visible', true).eq('is_paid', true).eq('payment_enabled', true));
    const ids = new Set(batches.map((b: any) => b.id));
    return mappings.filter((m: any) => ids.has(m.batch_id));
  }));
  router.post('/api/google-play/prepare', auth, limit, run(async req => {
    enabled(); onlyFields(req.body, ['batchId']);
    if (typeof req.body.batchId !== 'string' || !/^[a-f0-9-]{36}$/i.test(req.body.batchId)) throw new PaymentError(400, 'Invalid batch.');
    const batch = await one(db.from('batches').select('id,is_active,is_paid,catalog_visible,payment_enabled').eq('id', req.body.batchId).maybeSingle());
    const mapping = await one(db.from('google_play_products').select('*').eq('batch_id', req.body.batchId).eq('enabled', true).maybeSingle());
    if (!batch?.is_active || !batch.is_paid || !batch.catalog_visible || !batch.payment_enabled || !mapping) throw new PaymentError(409, 'This batch is not available for Google Play purchase.');
    if (await one(db.rpc('has_active_batch_access', { p_user_id: req.user.id, p_batch_id: batch.id }))) return { hasAccess: true };
    await one(db.from('google_play_accounts').upsert({ user_id: req.user.id }, { onConflict: 'user_id', ignoreDuplicates: true }));
    const account = await one(db.from('google_play_accounts').select('account_id').eq('user_id', req.user.id).single());
    return { productId: mapping.product_id, accountId: account.account_id, hasAccess: false };
  }));
  router.post('/api/google-play/verify', auth, limit, run(async req => {
    onlyFields(req.body, ['purchaseToken', 'productId']);
    if (typeof req.body.productId !== 'string') throw new PaymentError(400, 'Missing product.');
    return verify(req.body.purchaseToken, req.user.id, req.body.productId);
  }));
  router.get('/api/admin/google-play/products', admin, run(() => one(db.from('google_play_products').select('batch_id,product_id,enabled'))));
  router.put('/api/admin/google-play/products/:batchId', admin, run(async req => {
    onlyFields(req.body, ['productId', 'enabled']);
    if (typeof req.body.productId !== 'string' || !/^[a-z][a-z0-9_.]{1,99}$/.test(req.body.productId) || typeof req.body.enabled !== 'boolean') throw new PaymentError(400, 'Invalid product mapping.');
    const previous = await one(db.from('google_play_products').select('product_id').eq('batch_id', req.params.batchId).maybeSingle());
    if (previous && previous.product_id !== req.body.productId) throw new PaymentError(409, 'Product IDs are immutable. Disable this mapping and contact support.');
    await one(db.from('google_play_products').upsert({ batch_id: req.params.batchId, product_id: req.body.productId, enabled: req.body.enabled }));
    return { saved: true };
  }));
  router.post('/api/google-play/rtdn', run(async req => {
    const audience = process.env.GOOGLE_PLAY_RTDN_AUDIENCE;
    const email = process.env.GOOGLE_PLAY_RTDN_SERVICE_ACCOUNT;
    const subscription = process.env.GOOGLE_PLAY_RTDN_SUBSCRIPTION;
    if (!audience || !email || !subscription) throw new PaymentError(503, 'Notification receiver is not configured.');
    let payload;
    try { payload = (await oidc.verifyIdToken({ idToken: (req.headers.authorization || '').replace(/^Bearer /, ''), audience })).getPayload(); }
    catch { throw new PaymentError(401, 'Invalid notification authentication.'); }
    if (!payload?.email_verified || payload.email !== email) throw new PaymentError(403, 'Notification identity rejected.');
    if (req.body?.subscription !== subscription || typeof req.body?.message?.data !== 'string') throw new PaymentError(400, 'Invalid notification envelope.');
    let event;
    try { event = JSON.parse(Buffer.from(req.body.message.data, 'base64').toString('utf8')); } catch { throw new PaymentError(400, 'Invalid notification.'); }
    if (event.packageName !== PLAY_PACKAGE) throw new PaymentError(400, 'Wrong application.');
    if (event.testNotification) return { received: true };
    const token = event.oneTimeProductNotification?.purchaseToken || event.voidedPurchaseNotification?.purchaseToken;
    if (token) await verify(token);
    return { received: true };
  }));
  router.post('/api/google-play/reconcile', run(async req => {
    const secret = process.env.GOOGLE_PLAY_RECONCILE_SECRET || '';
    const actual = (req.headers.authorization || '').replace(/^Bearer /, '');
    if (secret.length < 32 || Buffer.byteLength(actual) !== Buffer.byteLength(secret) || !crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(secret))) throw new PaymentError(401, 'Invalid reconciliation authentication.');
    const rows = await one(db.from('google_play_purchases').select('token_hash,purchase_token').neq('state', 'CANCELLED').order('checked_at').limit(50));
    let failed = 0;
    for (const row of rows) {
      try { await verify(row.purchase_token); } catch { failed++; }
    }
    if (failed) throw new PaymentError(503, 'Some purchases require retry.');
    return { checked: rows.length };
  }));
  return router;
}
