import { useSyncExternalStore } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { User } from '../types';
import { supabase, recoveryRequest, confirmationNotice } from './supabaseClient';
import { setSessionContext, onSessionExpired } from './sessionTransport';
const LOCK = 'c50-web-signed-out';
type State = { checking: boolean; user: User | null; error: string; revision: number };
let state: State = { checking: true, user: null, error: '', revision: 0 };
const listeners = new Set<() => void>();
let version = 0;
let activeToken: string | null = null;
let confirmationHandled = !confirmationNotice;
let controller: AbortController | null = null;
let signingOut: Promise<void> | null = null;
function publish(checking: boolean, user: User | null, error = '') {
  state = { checking, user, error, revision: state.revision + 1 };
  for (const listener of listeners) listener();
}
function invalidate() { version++; activeToken = null; controller?.abort(); setSessionContext(null); }
export function lockWebsite(message = '') {
  localStorage.setItem(LOCK, '1');
  for (const key of Object.keys(sessionStorage)) { if (key.startsWith('c50_pending_purchase:')) sessionStorage.removeItem(key); }
  invalidate(); publish(false, null, message);
}
export async function signOutWebsite() {
  lockWebsite();
  signingOut = (async () => {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) publish(false, null, 'Signed out on this device. Server sign-out could not be confirmed; reconnect before signing in.');
  })().catch(() => { publish(false, null, 'Signed out on this device. Reconnect before signing in.'); }).finally(() => { signingOut = null; });
  await signingOut;
}
export async function prepareWebsiteLogin() {
  if (signingOut) await signingOut;
  invalidate(); confirmationHandled = true; localStorage.setItem(LOCK, '1');
}
export async function completeWebsiteLogin(session: Session | null) {
  if (!session) return;
  localStorage.removeItem(LOCK);
  await verify(session);
}
async function verify(session: Session | null) {
  if (recoveryRequest.kind !== 'none' || !confirmationHandled || localStorage.getItem(LOCK)) {
    invalidate(); publish(false, null); return;
  }
  if (session?.access_token === activeToken && state.user) return;
  invalidate(); const ticket = version;
  if (!session) { publish(false, null); return; }
  publish(true, null);
  const abort = new AbortController(); controller = abort;
  const timeout = setTimeout(() => abort.abort(), 15000);
  try {
    const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${session.access_token}` }, cache: 'no-store', signal: abort.signal });
    const data = await response.json();
    if (ticket !== version || localStorage.getItem(LOCK)) return;
    if (!response.ok || !data.user || data.user.id !== session.user.id) throw new Error(response.status === 403 ? 'Account profile unavailable. Contact support.' : 'Unable to verify your session. Please sign in again.');
    activeToken = session.access_token; setSessionContext(activeToken); publish(false, data.user);
  } catch (error) {
    if (ticket === version) lockWebsite(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Session verification timed out. Please sign in again.');
  } finally { clearTimeout(timeout); }
}
// Migrate away from unverified cached identity and custom website tokens.
localStorage.removeItem('aura_session_user'); localStorage.removeItem('aura_session_token');
let scheduled: ReturnType<typeof setTimeout>;
supabase.auth.onAuthStateChange((event, session) => {
  if (recoveryRequest.kind !== 'none' || localStorage.getItem(LOCK)) return;
  clearTimeout(scheduled);
  if (event === 'SIGNED_OUT') { lockWebsite(); return; }
  // Leave the SDK callback before performing further asynchronous work.
  if (session?.access_token !== activeToken) { invalidate(); publish(!!session && !localStorage.getItem(LOCK), null); }
  scheduled = setTimeout(() => void verify(session), 0);
});
const initial = version;
void supabase.auth.getSession().then(({ data, error }) => {
  if (initial !== version) return;
  if (error) lockWebsite('Unable to restore session. Please sign in again.'); else void verify(data.session);
}).catch(() => lockWebsite('Unable to restore session. Please sign in again.'));
window.addEventListener('storage', event => { if (event.key === LOCK && event.newValue) lockWebsite(); });
const revalidate = () => {
  if (recoveryRequest.kind !== 'none' || document.visibilityState !== 'visible' || localStorage.getItem(LOCK)) return;
  invalidate(); publish(true, null); const ticket = version;
  void supabase.auth.getSession().then(({ data }) => { if (ticket === version) void verify(data.session); }).catch(() => { if (ticket === version) lockWebsite('Unable to verify session. Please sign in again.'); });
};
window.addEventListener('pageshow', event => { if (event.persisted) revalidate(); });
document.addEventListener('visibilitychange', revalidate);
onSessionExpired(() => lockWebsite('Session expired. Please sign in again.'));
export function useWebsiteSession() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => state); }
