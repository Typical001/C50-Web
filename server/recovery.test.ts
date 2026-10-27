import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseRecoveryUrl, recoveryInitializer, passwordError } from '../src/lib/recovery';
import { recoveryRedirect } from './recovery-config';

test('homepage Supabase failures are recognized without decoding arbitrary text twice', () => {
  for (const suffix of ['#error=access_denied&error_code=otp_expired&error_description=bad%25', '?error=access_denied', '#error_description=invalid']) {
    assert.equal(parseRecoveryUrl(`https://c50.test/${suffix}`).kind, 'error');
  }
});

test('only complete recovery token pairs are accepted; no session fallback', () => {
  for (const suffix of ['/reset-password', '/reset-password/', '/reset-password?token=old&email=a%40b.com', '/reset-password?code=unsupported', '/reset-password#type=recovery&access_token=a', '/reset-password#type=signup&access_token=a&refresh_token=b']) {
    assert.equal(parseRecoveryUrl(`https://c50.test${suffix}`).kind, 'error');
  }
  assert.equal(parseRecoveryUrl('https://c50.test/').kind, 'none');
  for (const path of ['/', '/reset-password']) {
    assert.deepEqual(parseRecoveryUrl(`https://c50.test${path}#type=recovery&access_token=a&refresh_token=b`), { kind: 'tokens', access_token: 'a', refresh_token: 'b' });
  }
});

test('recovery initialization uses both tokens and verifies user once across repeated mounts', async () => {
  let sets = 0; let reads = 0;
  const init = recoveryInitializer({ kind: 'tokens', access_token: 'a', refresh_token: 'b' }, {
    async setSession(tokens) { sets++; assert.deepEqual(tokens, { access_token: 'a', refresh_token: 'b' }); return { data: { session: { user: { id: 'u' } } }, error: null }; },
    async getUser() { reads++; return { data: { user: { id: 'u' } }, error: null }; },
  });
  assert.deepEqual(await Promise.all([init(), init()]), ['u', 'u']);
  assert.equal(sets, 1); assert.equal(reads, 1);
});

test('invalid links never initialize a session; mismatched or rejected sessions fail closed', async () => {
  const forbidden = { async setSession() { throw new Error('must not run'); }, async getUser() { throw new Error('must not run'); } };
  await assert.rejects(recoveryInitializer({ kind: 'none' }, forbidden)(), /invalid/);
  for (const scenario of ['rejected', 'missing', 'foreign', 'user-error']) {
    const init = recoveryInitializer({ kind: 'tokens', access_token: 'a', refresh_token: 'b' }, {
      async setSession() { return { data: { session: scenario === 'missing' ? null : { user: { id: 'u' } } }, error: scenario === 'rejected' ? new Error('bad') : null }; },
      async getUser() { return { data: { user: { id: scenario === 'foreign' ? 'other' : 'u' } }, error: scenario === 'user-error' ? new Error('bad') : null }; },
    });
    await assert.rejects(init(), /invalid/);
  }
});

test('password policy and confirmation are validated', () => {
  assert.equal(passwordError('Example-Test-123', 'Example-Test-123'), null);
  for (const value of ['short', 'alllowercase123!', 'ALLUPPERCASE123!', 'NoNumbersHere!', 'NoSymbolsHere123']) assert.ok(passwordError(value, value));
  assert.match(passwordError('Example-Test-123', 'different')!, /match/);
});

test('server redirect rejects local/insecure production destinations', () => {
  assert.equal(recoveryRedirect('https://c50-web.onrender.com', true), 'https://c50-web.onrender.com/reset-password');
  assert.equal(recoveryRedirect('http://localhost:3000', false), 'http://localhost:3000/reset-password');
  for (const url of ['http://localhost:3000', 'https://localhost', 'https://127.0.0.1', 'https://[::1]', 'http://c50.test', 'https://c50.test/?redirect=x', 'https://user:pass@c50.test']) assert.throws(() => recoveryRedirect(url, true));
});

test('UI uses confirmation and disables changes until verified; old endpoint is retired', () => {
  const ui = readFileSync(new URL('../src/components/PasswordRecovery.tsx', import.meta.url), 'utf8');
  assert.match(ui, /status !== 'ready'/);
  assert.match(ui, /verified.data.user.id !== owner.current/);
  assert.match(ui, /passwordError\(password, confirmation\)/);
  assert.match(ui, /history.replaceState/);
  const server = readFileSync(new URL('./../server.ts', import.meta.url), 'utf8');
  assert.match(server, /status\(410\)/);
  assert.doesNotMatch(server, /refresh_token: ''/);
});
