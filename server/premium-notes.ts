import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthenticatedRequest } from './auth';

export function httpsUrl(value: unknown, optional = false): string {
  if (optional && (value === '' || value == null)) return '';
  if (typeof value !== 'string' || value.length > 2048 || /[\s\\]/.test(value)) throw new Error('Enter a valid HTTPS URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password) throw new Error('Use an HTTPS URL without embedded credentials.');
  return url.href;
}
export function noteProduct(body: any) {
  const text = (name: string, max: number, required = false) => {
    if (typeof body?.[name] !== 'string' || body[name].length > max || (required && !body[name].trim())) throw new Error(`Invalid ${name}.`);
    return body[name].trim();
  };
  if (!['note', 'bundle'].includes(body?.kind) || typeof body?.published !== 'boolean') throw new Error('Invalid product settings.');
  if (!Number.isSafeInteger(body.price_paise) || body.price_paise < 100 || body.price_paise > 100000000) throw new Error('Price must be between ₹1 and ₹10,00,000.');
  if (!Number.isInteger(body.sort_order) || Math.abs(body.sort_order) > 100000) throw new Error('Invalid display order.');
  return { title: text('title', 160, true), description: text('description', 10000, true), contents: text('contents', 10000),
    delivery_instructions: text('delivery_instructions', 5000), kind: body.kind, price_paise: body.price_paise,
    cover_url: httpsUrl(body.cover_url, true), checkout_url: httpsUrl(body.checkout_url, !body.published), published: body.published, sort_order: body.sort_order };
}
const fields = 'id,title,description,contents,kind,price_paise,cover_url,published,sort_order';
const requestFields = `id,product_id,status,delivery_status,title_snapshot,price_paise,created_at,updated_at,product:premium_note_products(${fields},delivery_instructions)`;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function premiumNotesRoutes(db: SupabaseClient, auth: RequestHandler, admin: RequestHandler) {
  const router = Router();
  const wrap = (fn: (req: AuthenticatedRequest, res: any) => Promise<unknown>): RequestHandler => (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    void fn(req, res).catch(() => res.status(503).json({ error: 'Premium notes are temporarily unavailable. Please retry.' }));
  };
  router.get('/api/premium-notes', wrap(async (_req, res) => {
    const { data, error } = await db.from('premium_note_products').select(fields).eq('published', true).order('sort_order').order('id');
    if (error) throw error; res.json(data);
  }));
  router.get('/api/premium-notes/mine', auth, wrap(async (req, res) => {
    const { data, error } = await db.from('premium_note_requests').select(requestFields).eq('user_id', req.user!.id).order('created_at', { ascending: false });
    if (error) throw error;
    res.json((data || []).map((row: any) => ({ ...row, product: row.product ? { ...row.product, delivery_instructions: row.status === 'purchased' ? row.product.delivery_instructions : undefined } : null })));
  }));
  router.post('/api/premium-notes/:id/request', auth, wrap(async (req, res) => {
    if (!uuid.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid notes identifier.' });
    const { data, error } = await db.rpc('request_premium_note', { p_product: req.params.id, p_user: req.user!.id });
    if (error?.message === 'Product unavailable') return res.status(409).json({ error: 'These notes are no longer available for purchase.' });
    if (error) throw error; res.json(data);
  }));
  router.get('/api/admin/premium-notes', admin, wrap(async (_req, res) => {
    const { data, error } = await db.from('premium_note_products').select('*').order('sort_order').order('id');
    if (error) throw error; res.json(data);
  }));
  router.post('/api/admin/premium-notes', admin, wrap(async (req, res) => {
    let product; try { product = noteProduct(req.body); } catch (e) { return res.status(400).json({ error: (e as Error).message }); }
    const { data, error } = await db.from('premium_note_products').insert(product).select().single();
    if (error) throw error; res.status(201).json(data);
  }));
  router.put('/api/admin/premium-notes/:id', admin, wrap(async (req, res) => {
    let product; try { product = noteProduct(req.body); } catch (e) { return res.status(400).json({ error: (e as Error).message }); }
    if (!uuid.test(String(req.params.id)) || typeof req.body.updated_at !== 'string') return res.status(400).json({ error: 'Reload before saving.' });
    const { data, error } = await db.from('premium_note_products').update({ ...product, updated_at: new Date().toISOString() }).eq('id', req.params.id).eq('updated_at', req.body.updated_at).select().maybeSingle();
    if (error) throw error;
    if (!data) return res.status(409).json({ error: 'Product changed. Reload before saving.' }); res.json(data);
  }));
  router.get('/api/admin/premium-note-requests', admin, wrap(async (req, res) => {
    const page = Math.max(0, Math.min(100000, Number(req.query.page) || 0));
    let query = db.from('premium_note_requests').select('*', { count: 'exact' }).order('created_at', { ascending: false }).order('id');
    if (['pending', 'purchased', 'rejected'].includes(String(req.query.status))) query = query.eq('status', req.query.status);
    if (req.query.user_id && uuid.test(String(req.query.user_id))) query = query.eq('user_id', req.query.user_id);
    const { data, error, count } = await query.range(page * 50, page * 50 + 49);
    if (error) throw error;
    const users = await Promise.all([...new Set((data || []).map(x => x.user_id))].map(async id => {
      const result = await db.auth.admin.getUserById(id); if (result.error) throw result.error;
      return [id, result.data.user?.email || id];
    }));
    res.json({ rows: data, count, emails: Object.fromEntries(users) });
  }));
  router.get('/api/admin/premium-note-requests/:id/history', admin, wrap(async (req, res) => {
    if (!uuid.test(String(req.params.id))) return res.status(400).json({ error: 'Invalid request.' });
    const { data, error } = await db.from('premium_note_events').select('*').eq('request_id', req.params.id).order('created_at', { ascending: false });
    if (error) throw error; res.json(data);
  }));
  router.post('/api/admin/premium-note-requests/:id', admin, wrap(async (req, res) => {
    const { status, delivery_status, reason, updated_at } = req.body || {};
    if (!uuid.test(String(req.params.id)) || !['pending', 'purchased', 'rejected'].includes(status) || !['pending', 'delivered'].includes(delivery_status) || typeof reason !== 'string' || !reason.trim() || reason.length > 2000 || typeof updated_at !== 'string') return res.status(400).json({ error: 'Choose a status and enter a verification/correction reason.' });
    const { data, error } = await db.rpc('review_premium_note', { p_id: req.params.id, p_actor: req.user!.id, p_status: status, p_delivery: delivery_status, p_reason: reason.trim(), p_expected: updated_at });
    if (error?.message === 'Request changed') return res.status(409).json({ error: 'Request changed. Reload before reviewing.' });
    if (error) throw error; res.json(data);
  }));
  return router;
}
