import React, { useEffect, useRef, useState } from 'react';
import { initializeRecovery, recoveryRequest, supabase } from '../lib/supabaseClient';
import { INVALID_LINK, passwordError } from '../lib/recovery';

export default function PasswordRecovery({ onRequestNew }: { onRequestNew: () => void }) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'invalid' | 'success'>('checking');
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const submitting = useRef(false);
  const owner = useRef('');

  useEffect(() => {
    // Remove credentials/error fragments from address bar and browser history.
    window.history.replaceState(null, '', '/reset-password');
    let active = true;
    if (recoveryRequest.kind !== 'tokens') {
      setError(INVALID_LINK); setStatus('invalid');
      return;
    }
    void initializeRecovery().then(id => {
      if (active) { owner.current = id; setStatus('ready'); }
    }).catch(() => {
      if (active) { setError(INVALID_LINK); setStatus('invalid'); }
    });
    return () => { active = false; };
  }, []);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || status !== 'ready') return;
    const validation = passwordError(password, confirmation);
    if (validation) { setError(validation); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const verified = await supabase.auth.getUser();
      if (verified.error || !verified.data.user || verified.data.user.id !== owner.current) {
        setStatus('invalid'); setError(INVALID_LINK); return;
      }
      const result = await supabase.auth.updateUser({ password });
      if (result.error) {
        if (result.error.status === 401 || result.error.status === 403) {
          setStatus('invalid'); setError(INVALID_LINK);
        } else {
          setError('Password could not be updated. Use a different strong password and retry. If this continues, request a new link.');
        }
        return;
      }
      setPassword(''); setConfirmation('');
      localStorage.removeItem('aura_session_user');
      localStorage.removeItem('aura_session_token');
      // Do not leave the recovery session logged in after changing the password.
      await supabase.auth.signOut({ scope: 'local' }).catch(() => undefined);
      setStatus('success');
    } catch {
      setError('Unable to connect. Check your connection and try again.');
    } finally {
      submitting.current = false; setBusy(false);
    }
  };

  return <section className="space-y-4" aria-busy={busy || status === 'checking'}>
    <h2 className="text-xl font-bold">Reset your password</h2>
    {status === 'checking' && <p role="status">Checking your recovery link…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {status === 'ready' && <form onSubmit={submit} className="space-y-4">
      <p id="password-rules" className="text-sm text-gray-600">Use at least 12 characters, including uppercase, lowercase, a number and a symbol.</p>
      <label className="block text-sm">New password
        <input type="password" autoComplete="new-password" required minLength={12} aria-describedby="password-rules" value={password} onChange={e => setPassword(e.target.value)} disabled={busy} className="mt-1 w-full border rounded-xl p-3" />
      </label>
      <label className="block text-sm">Confirm new password
        <input type="password" autoComplete="new-password" required minLength={12} value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} className="mt-1 w-full border rounded-xl p-3" />
      </label>
      <button type="submit" disabled={busy} className="w-full apple-btn-primary py-3 disabled:opacity-50">{busy ? 'Updating…' : 'Update password'}</button>
    </form>}
    {status === 'success' ? <div role="status" className="space-y-4">
      <p>Your password has been updated. Please sign in with your new password.</p>
      <a className="text-[#6D5DF6] underline" href="/">Return to sign in</a>
    </div> : <button type="button" disabled={busy} onClick={onRequestNew} className="text-[#6D5DF6] underline">Request a new reset link</button>}
  </section>;
}
