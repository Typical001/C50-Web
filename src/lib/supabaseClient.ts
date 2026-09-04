import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) || 
  'https://ypueconmqgcgcbvqqkqf.supabase.co';

const supabaseAnonKey = 
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) || 
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) || 
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwdWVjb25tcWdjZ2NidnFxa3FmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA4OTcyMjUsImV4cCI6MjA5NjQ3MzIyNX0.lP6mkG6bUBwLd5eq-nTJvwlhh04cp0h4zCVzp_2vGw4';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

