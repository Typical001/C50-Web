import { createClient } from '@supabase/supabase-js';
import { parseRecoveryUrl, recoveryInitializer } from './recovery';

const viteEnv = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabasePublishableKey = viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const recoveryRequest = parseRecoveryUrl(window.location.href);
export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: recoveryRequest.kind === 'none' ? {} : {
    // Handle recovery explicitly; do not auto-consume the URL or reuse stored login.
    detectSessionInUrl: false,
    persistSession: false,
    storageKey: 'c50-password-recovery',
  },
});
export const initializeRecovery = recoveryInitializer(recoveryRequest, supabase.auth);

