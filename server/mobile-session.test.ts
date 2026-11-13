import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

test('Android locks before failed sign-out, rejects late verification and isolates account changes', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'c50-mobile-session-'));
  const values = new Map<string, string>();
  const pause = () => new Promise(resolve => setTimeout(resolve, 20));
  const session = (id: string) => ({ access_token: `token-${id}`, user: { id } });
  let current: any = session('a');
  let callback: any, foreground: any;
  let verifyUser = async (token: string) => ({ data: { user: { id: token.slice(6) } }, error: null });
  const harness = {
    React: { useSyncExternalStore: (_subscribe: unknown, snapshot: () => unknown) => snapshot() },
    Native: { AppState: { addEventListener: (_name: string, fn: unknown) => { foreground = fn; } } },
    Storage: { getItem: async (key: string) => values.get(key) || null, setItem: async (key: string, value: string) => { values.set(key, value); }, removeItem: async (key: string) => { values.delete(key); } },
    supabase: {
      auth: { getSession: async () => ({ data: { session: current } }), getUser: (token: string) => verifyUser(token),
        onAuthStateChange: (fn: unknown) => { callback = fn; }, signOut: async () => ({ error: new Error('offline') }), startAutoRefresh() {}, stopAutoRefresh() {} },
      from: () => ({ select: () => ({ eq: (_key: string, id: string) => ({ single: async () => ({ data: { id }, error: null }) }) }) }),
    },
  };
  (globalThis as any).__c50MobileTest = harness;
  try {
    const output = path.join(directory, 'session.cjs');
    await build({ entryPoints: [path.resolve('../c50-mobile/src/lib/mobileSession.ts')], outfile: output, bundle: true, platform: 'node', format: 'cjs', plugins: [{ name: 'test-adapters', setup(plugin) {
      plugin.onResolve({ filter: /^(react|react-native|@react-native-async-storage\/async-storage|\.\/supabaseClient)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
      plugin.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === './supabaseClient'
        ? 'export const supabase = globalThis.__c50MobileTest.supabase;'
        : args.path === 'react' ? 'export const useSyncExternalStore = globalThis.__c50MobileTest.React.useSyncExternalStore;'
        : args.path === 'react-native' ? 'export const AppState = globalThis.__c50MobileTest.Native.AppState;'
        : 'export default globalThis.__c50MobileTest.Storage;' }));
    } }] });
    const require = createRequire(import.meta.url);
    let store = require(output);
    await pause(); assert.equal(store.useMobileSession().session.user.id, 'a');
    let resolve!: (value: any) => void;
    verifyUser = () => new Promise(r => { resolve = r; });
    callback('TOKEN_REFRESHED', current); await pause();
    const logout = store.signOutMobile();
    assert.equal(store.useMobileSession().session, null);
    assert.equal(store.mobileSessionBlocked(), true);
    resolve({ data: { user: { id: 'a' } }, error: null });
    await logout; await pause();
    assert.equal(values.get('c50-mobile-signed-out'), '1');
    assert.equal(store.useMobileSession().session, null);
    delete require.cache[output]; store = require(output); await pause();
    assert.equal(store.useMobileSession().session, null); // persisted SDK session cannot reopen the account
    verifyUser = async token => ({ data: { user: { id: token.slice(6) } }, error: null });
    await store.prepareMobileLogin(); callback('TOKEN_REFRESHED', current); await pause();
    assert.equal(values.get('c50-mobile-signed-out'), '1');
    delete require.cache[output]; store = require(output); await pause();
    assert.equal(store.useMobileSession().session, null);
    await store.prepareMobileLogin(); current = session('b'); callback('SIGNED_IN', current);
    await store.completeMobileLogin(current); await pause();
    assert.equal(store.useMobileSession().session.user.id, 'b');
    foreground('background'); assert.equal(store.useMobileSession().session, null);
    foreground('active'); await pause(); assert.equal(store.useMobileSession().session.user.id, 'b');
  } finally { delete (globalThis as any).__c50MobileTest; await rm(directory, { recursive: true, force: true }); }
});
