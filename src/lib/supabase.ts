import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL!;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY!;

if (import.meta.env.DEV) {
  console.log('[supabase] env', {
    hasUrl: Boolean(url),
    hasAnonKey: Boolean(key),
  });
}

const browserWindow = window as BrowserSupabaseWindow;

const noOpAuthLock = async <T>(
  _name: string,
  _acquireTimeout: number,
  fn: () => Promise<T>
): Promise<T> => await fn();

const createBrowserSupabase = () =>
  createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: window.localStorage,
      // Some mobile browsers can throw `AbortError: signal is aborted without reason`
      // when using the Navigator LockManager internally.
      // A no-op lock keeps auth/session stable for single-tab usage.
      lock: noOpAuthLock,
    },
  });

type BrowserSupabaseClient = ReturnType<typeof createBrowserSupabase>;
type BrowserSupabaseWindow = Window & typeof globalThis & {
  __palhaSupabase?: BrowserSupabaseClient;
  supabase?: BrowserSupabaseClient;
};

export const supabase = browserWindow.__palhaSupabase ?? createBrowserSupabase();

if (!browserWindow.__palhaSupabase) {
  browserWindow.__palhaSupabase = supabase;
}

// apenas para debug
browserWindow.supabase = supabase;
