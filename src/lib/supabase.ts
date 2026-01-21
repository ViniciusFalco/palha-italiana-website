import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY!;

if (import.meta.env.DEV) {
  console.log('[supabase] env', {
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(key),
  });
}

export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storage: window.localStorage,
  },
});

// apenas para debug
// @ts-ignore
window.supabase = supabase;
