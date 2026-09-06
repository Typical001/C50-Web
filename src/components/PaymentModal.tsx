import { useEffect, useRef, useState } from 'react';
import { X, Shield, Loader2, CheckCircle } from 'lucide-react';
import type { Batch } from '../types';
import { confirmedAccess, createPurchase, verifyPurchase, loadCheckout, paymentRequest, type CheckoutInstance, type CheckoutResponse, type PaymentStatus } from '../lib/paymentClient';

interface Props { key?: string; batch: Batch; userId: string; onClose(): void; onPaymentSuccess(): Promise<void>; }
export default function PaymentModal({ batch, userId, onClose, onPaymentSuccess }: Props) {
  const storageKey = `c50_pending_purchase:${userId}:${batch.id}`;
  const [paymentId, setPaymentId] = useState(() => sessionStorage.getItem(storageKey) || '');
  const [phase, setPhase] = useState<'ready' | 'busy' | 'pending' | 'success' | 'unavailable' | 'failed'>(() => sessionStorage.getItem(storageKey) ? 'pending' : 'ready');
  const [error, setError] = useState('');
  const [received, setReceived] = useState(false);
  const [amount, setAmount] = useState(batch.discountPrice > 0 ? batch.discountPrice : batch.price);
  const [polls, setPolls] = useState(0);
  const mounted = useRef(true), checking = useRef(false), starting = useRef(false);
  const checkout = useRef<CheckoutInstance | null>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; checkout.current?.close(); }; }, []);
  function accept(result: PaymentStatus, id: string) {
    if (!mounted.current) return;
    if (result.paymentId !== id || result.batchId !== batch.id) throw new Error('Payment confirmation did not match this batch.');
    if (confirmedAccess(result, batch.id, id)) {
      sessionStorage.removeItem(storageKey); setPhase('success'); setError('');
    } else if (result.status === 'success') {
      setPhase('unavailable'); setError('Payment verified, but course access is currently unavailable. Please contact support.');
    } else if (result.status === 'failed') {
      sessionStorage.removeItem(storageKey); setPhase('failed'); setError('Payment failed. No course access was granted. You can retry.');
    } else { setPhase('pending'); }
  }
  async function check(id = paymentId) {
    if (!id || checking.current) return;
    checking.current = true;
    try { accept(await paymentRequest(`/api/payments/${id}/status`), id); }
    catch (err) { if (mounted.current) setError(err instanceof Error ? err.message : 'Confirmation unavailable. Please check again.'); }
    finally { checking.current = false; }
  }
  useEffect(() => {
    if (phase !== 'pending' || !paymentId || polls >= 12) return;
    const timer = setTimeout(() => { setPolls(n => n + 1); void check(); }, 5000);
    return () => clearTimeout(timer);
  }, [phase, paymentId, polls]);
  async function begin() {
    if (starting.current) return;
    starting.current = true; setPhase('busy'); setError('');
    try {
      const order = await createPurchase(batch.id);
      if (!order.paymentId || !order.orderId || !order.keyId || order.currency !== 'INR' || !Number.isSafeInteger(order.amount) || order.amount <= 0) throw new Error('Invalid checkout order.');
      sessionStorage.setItem(storageKey, order.paymentId); setPaymentId(order.paymentId); setAmount(order.amount / 100);
      await loadCheckout();
      if (!mounted.current) return;
      let callbackReceived = false;
      const Razorpay = window.Razorpay!;
      checkout.current = new Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: 'C50 Academy', description: batch.title, theme: { color: '#6D5DF6' },
        handler: async (response: CheckoutResponse) => {
          callbackReceived = true;
          if (!mounted.current) return;
          setReceived(true); setPhase('busy');
          try {
            accept(await verifyPurchase(response), order.paymentId);
          } catch {
            if (mounted.current) { setPhase('pending'); setPolls(0); setError('Server confirmation is still pending. Do not pay again.'); }
          }
        },
        modal: { ondismiss: () => {
          if (!mounted.current || callbackReceived) return;
          setPhase('pending'); setPolls(0); setError('Checkout closed. Check payment status before retrying if money was debited.');
        } }
      });
      checkout.current.on('payment.failed', () => {
        if (mounted.current) setError('This payment attempt failed. You can retry inside Razorpay or close it to check status.');
      });
      checkout.current.open();
    } catch (err) {
      if (mounted.current) { setPhase('ready'); setError(err instanceof Error ? err.message : 'Unable to open checkout.'); }
    } finally { starting.current = false; }
  }
  async function startLearning() {
    setPhase('busy');
    try { await onPaymentSuccess(); }
    catch (err) { setPhase('success'); setError(err instanceof Error ? err.message : 'Unable to refresh course access.'); }
  }
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
    <section role="dialog" aria-modal="true" aria-labelledby="payment-title" className="relative w-full max-w-md rounded-3xl bg-white p-7 shadow-2xl">
      <button aria-label="Close payment" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2"><X size={20} /></button>
      <Shield className="mb-4 text-indigo-600" size={32} />
      <h2 id="payment-title" className="text-xl font-bold">Secure batch purchase</h2>
      <p className="mt-2 text-gray-600">{batch.title}</p>
      <p className="my-4 text-3xl font-extrabold">₹{amount.toLocaleString('en-IN')}</p>
      <p className="text-sm text-gray-500">Card, UPI and banking details are entered only in Razorpay Checkout.</p>
      {error && <p role="alert" className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">{error}</p>}
      <div aria-live="polite" className="my-5">
        {phase === 'busy' && <p className="flex items-center gap-2"><Loader2 className="animate-spin" size={18} /> Waiting for secure checkout / confirmation…</p>}
        {phase === 'pending' && <p>{received ? 'Payment received. Confirmation pending.' : 'Payment confirmation pending.'} {polls >= 12 && 'Automatic checks paused; you can check again below.'}</p>}
        {phase === 'success' && <p className="flex items-center gap-2 font-semibold text-emerald-700"><CheckCircle /> Payment Successful</p>}
      </div>
      {phase === 'success' ? <button className="apple-btn-primary w-full" onClick={startLearning}>Start Learning</button> :
        phase !== 'busy' && phase !== 'unavailable' && <button disabled={!batch.paymentEnabled} className="apple-btn-primary w-full disabled:opacity-50" onClick={begin}>
          {batch.paymentEnabled ? (paymentId ? 'Reopen Razorpay Checkout' : 'Continue to Razorpay') : 'Purchases not enabled yet'}
        </button>}
      {paymentId && phase !== 'busy' && phase !== 'success' && <button onClick={() => { setPolls(0); void check(); }} className="mt-3 w-full text-sm font-semibold text-indigo-600">Check payment status</button>}
      {paymentId && <p className="mt-4 break-all text-xs text-gray-400">Purchase reference: {paymentId}</p>}
    </section>
  </div>;
}
