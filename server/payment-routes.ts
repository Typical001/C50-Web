import express, { type RequestHandler } from 'express';
import { PaymentError, type Payments } from './payments';

// Both routers are mounted on the existing Express app, not a separate backend.
export function paymentRoutes(service: Payments, auth: RequestHandler) {
  const webhook = express.Router();
  const api = express.Router();
  const handler = (run: (req: any) => Promise<unknown>): RequestHandler => async (req, res) => {
    try { res.json(await run(req)); }
    catch (error) {
      const known = error instanceof PaymentError;
      res.status(known ? error.status : 503).json({ error: known ? error.message : 'Payment processing unavailable. Please retry confirmation.' });
    }
  };
  // Local traffic protection; use a shared limiter at the edge for multi-instance deployments.
  const windows = new Map<string, { count: number; until: number }>();
  const limit: RequestHandler = (req: any, res, next) => {
    const now = Date.now();
    for (const [key, window] of windows) if (window.until < now) windows.delete(key);
    const key = `${req.user.id}:${req.route.path}`;
    const window = windows.get(key) || { count: 0, until: now + 60000 };
    window.count++;
    windows.set(key, window);
    if (window.count > 30) { res.setHeader('Retry-After', '60'); res.status(429).json({ error: 'Too many payment requests. Please wait a minute.' }); return; }
    next();
  };
  webhook.post('/api/payments/razorpay/webhook', express.raw({ type: 'application/json', limit: '1mb' }),
    handler(req => service.webhook(req.body, req.headers['x-razorpay-signature'], req.headers['x-razorpay-event-id'])));
  api.post('/api/payments/create-order', auth, limit, handler(req => service.create(req.user.id, req.body)));
  api.post('/api/payments/verify', auth, limit, handler(req => service.verify(req.user.id, req.body)));
  api.get('/api/payments/:paymentId/status', auth, limit, handler(req => service.status(req.user.id, req.params.paymentId)));
  return { webhook, api };
}
