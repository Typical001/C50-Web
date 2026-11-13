// Shared request boundary: old-account responses can never update a new session.
let token: string | null = null;
let generation = 0;
const requests = new Set<AbortController>();
let onUnauthorized = () => {};
export const currentAccessToken = () => token;
export const sessionGeneration = () => generation;
export function setSessionContext(next: string | null) {
  generation++; token = next;
  for (const controller of requests) controller.abort();
  requests.clear();
}
export function onSessionExpired(handler: () => void) { onUnauthorized = handler; }
export async function sessionFetch(input: string, options: RequestInit = {}) {
  const ticket = generation;
  const controller = new AbortController();
  const abort = () => controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) controller.abort();
  requests.add(controller);
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  else headers.delete('Authorization');
  const check = () => { if (ticket !== generation) throw new Error('Account changed. Please try again.'); };
  const timer = setTimeout(abort, 30000);
  try {
    const response = await fetch(input, { ...options, headers, cache: 'no-store', signal: controller.signal });
    check();
    if (response.status === 401 && token) { onUnauthorized(); throw new Error('Session expired. Please sign in again.'); }
    // Consume the body within the cancellable request and guard again after parsing.
    const body = await response.text(); check();
    return { ok: response.ok, status: response.status, async json() { check(); return JSON.parse(body); } };
  } finally {
    clearTimeout(timer); requests.delete(controller); options.signal?.removeEventListener('abort', abort);
  }
}
