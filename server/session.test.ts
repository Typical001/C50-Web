import test from 'node:test';
import assert from 'node:assert/strict';
import { sessionFetch, setSessionContext, onSessionExpired } from '../src/lib/sessionTransport';
import { createRequireAuth } from './auth';

test('logout rejects a late response even when fetch ignores abort', async () => {
  const original = globalThis.fetch;
  let resolve!: (value: Response) => void;
  setSessionContext('account-a');
  globalThis.fetch = async () => new Promise<Response>(r => { resolve = r; });
  try {
    const pending = sessionFetch('/api/my-batches');
    setSessionContext(null);
    resolve(new Response('[{"private":"A"}]'));
    await assert.rejects(pending, /Account changed/);
  } finally { globalThis.fetch = original; setSessionContext(null); }
});
test('old 401 cannot expire a newer account; parsed responses are also guarded', async () => {
  const original = globalThis.fetch;
  let expired = 0;
  onSessionExpired(() => { expired++; });
  try {
    setSessionContext('a');
    globalThis.fetch = async () => { setSessionContext('b'); return new Response('{}', { status: 401 }); };
    await assert.rejects(sessionFetch('/api/auth/me'), /Account changed/);
    assert.equal(expired, 0);
    globalThis.fetch = async () => new Response('{"owner":"b"}');
    const response = await sessionFetch('/api/private');
    setSessionContext(null);
    await assert.rejects(response.json(), /Account changed/);
  } finally { globalThis.fetch = original; onSessionExpired(() => {}); setSessionContext(null); }
});
test('current 401 expires session while requests use current token and no-store', async () => {
  const original = globalThis.fetch;
  let expired = 0;
  onSessionExpired(() => { expired++; setSessionContext(null); });
  try {
    setSessionContext('fresh');
    globalThis.fetch = async (_url, options) => {
      assert.equal(new Headers(options?.headers).get('Authorization'), 'Bearer fresh');
      assert.equal(options?.cache, 'no-store');
      return new Response('{}', { status: 401 });
    };
    await assert.rejects(sessionFetch('/api/private'), /Session expired/);
    assert.equal(expired, 1);
  } finally { globalThis.fetch = original; onSessionExpired(() => {}); setSessionContext(null); }
});
test('backend rejects legacy/unconfirmed tokens and trusts only authoritative profile roles', async () => {
  let user: any = { id: 'u', email: 'fixture@example.com', email_confirmed_at: 'date', user_metadata: { role: 'admin' } };
  let profile: any = { role: 'student' };
  let error: any = null;
  const db: any = { auth: { getUser: async () => ({ data: { user }, error }) }, from: () => ({ select: () => ({ eq: (_key: string, id: string) => { assert.equal(id, 'u'); return { maybeSingle: async () => ({ data: profile, error: null }) }; } }) }) };
  async function invoke(token: string) {
    let status = 200, passed = false;
    const request: any = { headers: { authorization: `Bearer ${token}` } };
    const response: any = { setHeader: (key: string, value: string) => assert.equal(`${key}:${value}`, 'Cache-Control:no-store'), status: (value: number) => { status = value; return response; }, json: () => {} };
    await createRequireAuth(db)(request, response, () => { passed = true; });
    return { status, passed, user: request.user };
  }
  assert.equal((await invoke('old.signature')).status, 401);
  assert.equal((await invoke('signed.jwt.token')).user.role, 'student');
  user.email_confirmed_at = null;
  assert.equal((await invoke('signed.jwt.token')).status, 401);
  user.email_confirmed_at = 'date'; profile = null;
  assert.equal((await invoke('signed.jwt.token')).status, 403);
  error = { status: 503 };
  assert.equal((await invoke('signed.jwt.token')).status, 503);
});
