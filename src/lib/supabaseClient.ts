import { createClient } from '@supabase/supabase-js';

const viteEnv = (import.meta as ImportMeta & { env: Record<string, string | undefined> }).env;
const supabaseUrl = viteEnv.VITE_SUPABASE_URL;
const supabasePublishableKey = viteEnv.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey);

