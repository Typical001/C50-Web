import type { Request, Response, NextFunction } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
export interface AuthenticatedRequest extends Request { user?: { id: string; role: string; email: string }; }
export function createRequireAuth(db: SupabaseClient) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    res.setHeader('Cache-Control', 'no-store');
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : '';
    if (!token || token.split('.').length !== 3) return res.status(401).json({ error: 'Please sign in again with the updated application.' });
    try {
      const { data, error } = await db.auth.getUser(token);
      if (error && (!error.status || error.status >= 500)) return res.status(503).json({ error: 'Authentication service unavailable. Please retry.' });
      if (error || !data.user?.email_confirmed_at) return res.status(401).json({ error: 'Session expired or email not confirmed. Please sign in again.' });
      const { data: profile, error: profileError } = await db.from('profiles').select('role').eq('id', data.user.id).maybeSingle();
      if (profileError) return res.status(503).json({ error: 'Account service unavailable. Please retry.' });
      if (!profile) return res.status(403).json({ error: 'Account profile unavailable. Contact support.' });
      req.user = { id: data.user.id, email: data.user.email || '', role: profile.role };
      next();
    } catch { res.status(503).json({ error: 'Authentication service unavailable. Please retry.' }); }
  };
}
