export type RecoveryRequest =
  | { kind: 'none' }
  | { kind: 'error'; message: string }
  | { kind: 'tokens'; access_token: string; refresh_token: string };

export const INVALID_LINK = 'This password reset link is invalid, expired, or already used. Please request a new link and open the newest email.';

export function parseRecoveryUrl(url: string): RecoveryRequest {
  const parsed = new URL(url);
  const hash = new URLSearchParams(parsed.hash.slice(1));
  const query = parsed.searchParams;
  const get = (key: string) => hash.get(key) || query.get(key);
  const resetPath = /^\/reset-password\/?$/.test(parsed.pathname);
  // Supabase can send failures to Site URL (/), not only the requested path.
  if (get('error') || get('error_code') || get('error_description')) {
    return { kind: 'error', message: INVALID_LINK };
  }
  if (!resetPath && get('type') !== 'recovery') return { kind: 'none' };
  const access_token = hash.get('access_token');
  const refresh_token = hash.get('refresh_token');
  if (get('type') === 'recovery' && access_token && refresh_token) {
    return { kind: 'tokens', access_token, refresh_token };
  }
  // Never fall back to another logged-in session or a manually pasted token.
  return { kind: 'error', message: INVALID_LINK };
}

export function passwordError(password: string, confirmation: string): string | null {
  if (password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) {
    return 'Use at least 12 characters, including uppercase, lowercase, a number and a symbol.';
  }
  return password === confirmation ? null : 'Passwords do not match.';
}

type RecoveryAuth = {
  setSession(tokens: { access_token: string; refresh_token: string }): Promise<{ data: { session: { user: { id: string } } | null }; error: unknown }>;
  getUser(): Promise<{ data: { user: { id: string } | null }; error: unknown }>;
};

// One initialization promise prevents React StrictMode from consuming a link twice.
export function recoveryInitializer(request: RecoveryRequest, auth: RecoveryAuth) {
  let pending: Promise<string> | undefined;
  return () => pending ??= (async () => {
    if (request.kind !== 'tokens') throw new Error(INVALID_LINK);
    const result = await auth.setSession({ access_token: request.access_token, refresh_token: request.refresh_token });
    if (result.error || !result.data.session) throw new Error(INVALID_LINK);
    const verified = await auth.getUser();
    if (verified.error || !verified.data.user || verified.data.user.id !== result.data.session.user.id) throw new Error(INVALID_LINK);
    return verified.data.user.id;
  })();
}
