// Kept identical in the independently deployed Web and Admin applications.
export type StoreStatus = 'hidden' | 'coming_soon' | 'available';
export type StoreKey = 'google_play' | 'app_store';
export interface StoreLink { status: StoreStatus; url: string }
export interface AppPromotion {
  visible: boolean;
  badge: string;
  heading: string;
  description: string;
  phone_name: string;
  phone_caption: string;
  google_play: StoreLink;
  app_store: StoreLink;
}
export const promotionTextLimits = { badge: 40, heading: 120, description: 600, phone_name: 60, phone_caption: 80 } as const;
export function defaultAppPromotion(): AppPromotion {
  return {
    visible: true, badge: 'Mobile App', heading: 'Study Anytime. Anywhere.',
    description: 'Explore courses, watch lectures and open study notes with the Carrier-50 app.',
    phone_name: 'Carrier-50', phone_caption: 'Active learning',
    google_play: { status: 'coming_soon', url: '' }, app_store: { status: 'coming_soon', url: '' },
  };
}
export function validStoreUrl(value: string, store: StoreKey): boolean {
  if (!value || value.length > 2048 || /[\s\\]/.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    return store === 'google_play'
      ? url.hostname === 'play.google.com' && url.pathname === '/store/apps/details' && /^[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)+$/.test(url.searchParams.get('id') || '')
      : url.hostname === 'apps.apple.com' && /\/id[0-9]+\/?$/.test(url.pathname);
  } catch { return false; }
}
export function validateAppPromotion(value: unknown): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Invalid app promotion settings.';
  const p = value as AppPromotion;
  if (typeof p.visible !== 'boolean') return 'Choose whether to show the app promotion.';
  for (const [key, limit] of Object.entries(promotionTextLimits)) {
    const text = p[key as keyof typeof promotionTextLimits];
    if (typeof text !== 'string' || !text.trim() || text.length > limit) return `${key.replaceAll('_', ' ')} is required (maximum ${limit} characters).`;
  }
  for (const key of ['google_play', 'app_store'] as const) {
    const store = p[key];
    if (!store || !['hidden', 'coming_soon', 'available'].includes(store.status) || typeof store.url !== 'string') return 'Invalid store settings.';
    if ((store.status === 'available' || store.url !== '') && !validStoreUrl(store.url, key)) return `Enter a valid HTTPS ${key === 'google_play' ? 'Google Play' : 'Apple App Store'} listing URL, without credentials.`;
  }
  return null;
}
export function readAppPromotion(value: unknown): AppPromotion {
  return validateAppPromotion(value) ? defaultAppPromotion() : value as AppPromotion;
}
