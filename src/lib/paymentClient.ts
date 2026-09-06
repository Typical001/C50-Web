export type PaymentStatus = { paymentId: string; batchId: string; status: 'pending' | 'success' | 'failed'; hasAccess: boolean };
export async function paymentRequest(path: string, body?: unknown) {
  const token = localStorage.getItem('aura_session_token');
  if (!token) throw new Error('Please sign in again.');
  const response = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(20000)
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Unable to confirm payment. Please try again.');
  return data;
}
export function confirmedAccess(result: PaymentStatus, batchId: string, paymentId: string) {
  return result.batchId === batchId && result.paymentId === paymentId && result.status === 'success' && result.hasAccess === true;
}
export type CheckoutResponse = { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
export const createPurchase = (batchId: string) => paymentRequest('/api/payments/create-order', { batchId });
export const verifyPurchase = (response: CheckoutResponse) => paymentRequest('/api/payments/verify', {
  razorpay_order_id: response.razorpay_order_id, razorpay_payment_id: response.razorpay_payment_id,
  razorpay_signature: response.razorpay_signature
});
export type CheckoutInstance = { open(): void; close(): void; on(event: string, callback: () => void): void };
declare global { interface Window { Razorpay?: new (options: Record<string, unknown>) => CheckoutInstance; } }
let scriptPromise: Promise<void> | undefined;
export function loadCheckout(): Promise<void> {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
    const fail = () => { clearTimeout(timer); script.remove(); scriptPromise = undefined; reject(new Error('Razorpay could not load. Check your connection and retry.')); };
    const timer = setTimeout(fail, 15000);
    script.onerror = fail;
    script.onload = () => { if (!window.Razorpay) return fail(); clearTimeout(timer); resolve(); };
    document.head.appendChild(script);
  });
  return scriptPromise;
}
