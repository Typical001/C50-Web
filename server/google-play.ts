import { GoogleAuth } from 'google-auth-library';
import { PaymentError } from './payments';

export const PLAY_PACKAGE = 'com.carrier50.c50academy';
export interface PlayPurchase {
  productLineItem?: Array<{ productId?: string; quantity?: number }>;
  purchaseStateContext?: { purchaseState?: string };
  obfuscatedExternalAccountId?: string;
  acknowledgementState?: string;
  testPurchaseContext?: unknown;
  orderId?: string;
}
export function validatePlayPurchase(purchase: PlayPurchase, product: string, account: string, allowTest: boolean) {
  if (purchase.obfuscatedExternalAccountId !== account || !account) throw new PaymentError(403, 'This purchase belongs to a different learning account.');
  if (purchase.productLineItem?.length !== 1 || purchase.productLineItem[0].productId !== product || (purchase.productLineItem[0].quantity ?? 1) !== 1) {
    throw new PaymentError(400, 'The Google Play product does not match this batch.');
  }
  if (purchase.testPurchaseContext && !allowTest) throw new PaymentError(403, 'Test purchases are restricted to configured testers.');
  const state = purchase.purchaseStateContext?.purchaseState;
  if (!['PURCHASED', 'PENDING', 'CANCELLED'].includes(state || '')) throw new PaymentError(503, 'Google Play returned an unsupported purchase state.');
  return { state: state!, test: !!purchase.testPurchaseContext };
}

// Credentials are a server-side secret file (GOOGLE_APPLICATION_CREDENTIALS), never an Expo variable.
export function googlePlayProvider() {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/androidpublisher'] });
  async function request<T>(path: string, method: 'GET' | 'POST' = 'GET'): Promise<T> {
    try {
      const client = await auth.getClient();
      const response = await client.request<T>({ url: `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PLAY_PACKAGE}/${path}`, method, timeout: 15000, ...(method === 'POST' ? { data: {} } : {}) });
      return response.data;
    } catch { throw new PaymentError(502, 'Google Play verification is temporarily unavailable. Restore purchases to retry.', 'PLAY_PROVIDER_UNAVAILABLE'); }
  }
  return {
    get: (token: string) => request<PlayPurchase>(`purchases/productsv2/tokens/${encodeURIComponent(token)}`),
    acknowledge: (product: string, token: string) => request(`purchases/products/${encodeURIComponent(product)}/tokens/${encodeURIComponent(token)}:acknowledge`, 'POST'),
  };
}
