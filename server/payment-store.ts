import type { SupabaseClient } from '@supabase/supabase-js';
import { PaymentError, type PaymentStore, type Purchase } from './payments';

export function paymentStore(db: SupabaseClient): PaymentStore {
  async function one(query: any): Promise<any> {
    const { data, error } = await query;
    if (error) throw new PaymentError(503, 'Payment database unavailable. Please retry confirmation.');
    return data;
  }
  const store: PaymentStore = {
    batch: id => one(db.from('batches').select('id,price,discount_price,is_active,is_paid,is_free,payment_enabled').eq('id', id).maybeSingle()),
    access: (user, batch) => one(db.rpc('has_active_batch_access', { p_user_id: user, p_batch_id: batch })),
    get: id => one(db.from('payments').select('*').eq('id', id).maybeSingle()),
    byOrder: id => one(db.from('payments').select('*').eq('razorpay_order_id', id).maybeSingle()),
    async reserve(row) {
      const { data, error } = await db.from('payments').insert(row).select().single();
      if (!error) return data;
      if (error.code !== '23505') throw new PaymentError(503, 'Could not start purchase.');
      const existing = await one(db.from('payments').select('*').eq('user_id', row.user_id).eq('batch_id', row.batch_id)
        .eq('status', 'pending').not('amount_paise', 'is', null).maybeSingle());
      if (!existing) throw new PaymentError(409, 'Purchase state changed. Please retry.');
      return existing;
    },
    async attachOrder(id, order) {
      const updated = await one(db.from('payments').update({ razorpay_order_id: order }).eq('id', id)
        .is('razorpay_order_id', null).select().maybeSingle());
      const row = updated || await store.get(id);
      if (!row || row.razorpay_order_id !== order) throw new PaymentError(409, 'Order is already linked to a different purchase.');
      return row;
    },
    async finalize(row, payment, signature) {
      await one(db.rpc('finalize_razorpay_payment', { p_payment_id: row.id, p_razorpay_payment_id: payment.id,
        p_razorpay_signature: signature, p_payment_method: typeof payment.method === 'string' ? payment.method : null }));
    },
    async fail(id) {
      await one(db.from('payments').update({ status: 'failed', failure_code: 'provider_payment_failed' }).eq('id', id).eq('status', 'pending'));
    },
    async event(id, type, hash) {
      const { error } = await db.from('payment_webhook_events').insert({ razorpay_event_id: id, event_type: type, payload_hash: hash });
      if (!error) return;
      if (error.code !== '23505') throw new PaymentError(503, 'Could not record webhook.');
      const existing = await one(db.from('payment_webhook_events').select('payload_hash').eq('razorpay_event_id', id).single());
      if (existing.payload_hash !== hash) throw new PaymentError(409, 'Webhook event ID was reused with different content.');
    },
    async finishEvent(id, status, paymentId) {
      await one(db.from('payment_webhook_events').update({ processing_status: status, payment_id: paymentId,
        processing_error: status === 'failed' ? 'Processing incomplete; retry required' : null,
        processed_at: status === 'failed' ? null : new Date().toISOString() }).eq('razorpay_event_id', id));
    }
  };
  return store;
}
