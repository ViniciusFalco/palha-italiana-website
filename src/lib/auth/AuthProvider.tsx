import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../supabase';

type WithAuthRetryOptions = {
  label?: string;
};

type RetryableResult = { error: any };

type SignOutOptions = {
  label?: string;
};

export type AuthRetryFn = <R extends RetryableResult>(
  operation: () => PromiseLike<R>,
  options?: WithAuthRetryOptions
) => Promise<R>;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loadingAuth: boolean;
  authError: string | null;
  refreshSession: (note?: string) => Promise<Session | null>;
  signOut: (options?: SignOutOptions) => Promise<{ error: string | null }>;
  withAuthRetry: AuthRetryFn;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const devLog = (label: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.log(`[auth] ${label}`, payload);
};

const normalizeMessage = (msg: any) => String(msg ?? '').trim();

const isAuthExpiredOrInvalid = (error: any) => {
  if (!error) return false;
  const status = (error as any)?.status;
  const message = normalizeMessage((error as any)?.message).toLowerCase();

  if (status === 401) return true;

  if (
    message.includes('jwt') ||
    message.includes('token') ||
    message.includes('expired') ||
    message.includes('invalid') ||
    message.includes('not authenticated')
  ) {
    return true;
  }

  return false;
};

const isForbiddenRls = (error: any) => {
  if (!error) return false;
  const status = (error as any)?.status;
  const message = normalizeMessage((error as any)?.message).toLowerCase();

  if (status === 403) return true;
  if (message.includes('permission denied')) return true;
  if (message.includes('row-level security')) return true;
  if (message.includes('rls')) return true;

  return false;
};

// ✅ corrigido: sem parâmetro não usado
const buildForbiddenMessage = () => {
  return 'Conta sem permissão para acessar esta área. Solicite liberação do administrador.';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const listenerRef =
    useRef<ReturnType<typeof supabase.auth.onAuthStateChange>['data'] | null>(null);
  const refreshingRef = useRef(false);

  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const refreshSession = useCallback(async (note: string = 'manual-refresh') => {
    if (refreshingRef.current) {
      return sessionRef.current;
    }

    refreshingRef.current = true;
    setLoadingAuth(true);
    setAuthError(null);
    devLog('refresh:start', { note });

    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;

      sessionRef.current = data.session ?? null;
      setSession(data.session ?? null);
      setUser(data.session?.user ?? null);
      devLog('refresh:success', { userId: data.session?.user?.id, note });

      return data.session ?? null;
    } catch (err: any) {
      const message = err?.message ?? 'Erro ao renovar sessão';
      sessionRef.current = null;
      setSession(null);
      setUser(null);
      setAuthError(message);
      devLog('refresh:error', { note, message, status: err?.status });

      return null;
    } finally {
      refreshingRef.current = false;
      setLoadingAuth(false);
      devLog('refresh:end', { note });
    }
  }, []);

  const signOut = useCallback(
    async (options?: SignOutOptions) => {
      const label = options?.label ?? 'unknown';
      if (import.meta.env.DEV) {
        const stack = new Error().stack;
        devLog('signout:origin', { label, stack });
      }
      try {
        devLog('signout:start', { userId: user?.id, label });
        const { error } = await supabase.auth.signOut();
        if (error) {
          devLog('signout:error', { message: error?.message, status: error?.status });
          return { error: error.message ?? 'Falha ao sair. Tente novamente.' };
        }
        return { error: null };
      } catch (err: any) {
        devLog('signout:error', { message: err?.message, status: err?.status });
        return { error: err?.message ?? 'Falha ao sair. Tente novamente.' };
      } finally {
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        setLoadingAuth(false);
        devLog('signout:end');
      }
    },
    [user?.id]
  );

  const withAuthRetry = useCallback<AuthRetryFn>(
    async (operation, options) => {
      const label = options?.label ?? 'anonymous';
      const hadSession = Boolean(sessionRef.current);

      const run = async () => {
        const result = await operation();

        if (result?.error) {
          devLog('op:error', {
            label,
            status: result.error?.status,
            message: result.error?.message,
            code: result.error?.code,
          });
        }

        if (result?.error && isForbiddenRls(result.error)) {
          devLog('auth:forbidden', {
            label,
            status: result.error?.status,
            message: result.error?.message,
          });

          setAuthError(buildForbiddenMessage());
          return result;
        }

        return result;
      };

      let result = await run();

      if (result?.error && isAuthExpiredOrInvalid(result.error)) {
        if (!hadSession) {
          devLog('auth:skip-refresh:no-session', { label });
          return result;
        }

        devLog('auth:needs-refresh', {
          label,
          status: result.error?.status,
          message: result.error?.message,
        });

        const refreshedSession = await refreshSession(`retry-${label}`);
        if (!refreshedSession) {
          devLog('auth:refresh-failed', { label });
          await signOut({ label: `refresh-failed:${label}` });
          return result;
        }

        result = await run();

        if (result?.error && isAuthExpiredOrInvalid(result.error)) {
          devLog('auth:invalid-session:final', { label });
          await signOut({ label: `retry-failed:${label}` });
        }
      }

      return result;
    },
    [refreshSession, signOut]
  );

  useEffect(() => {
    let mounted = true;

    setLoadingAuth(true);
    setAuthError(null);
    devLog('init:start');

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          setAuthError(error.message ?? 'Falha ao carregar sessão');
          sessionRef.current = null;
          setSession(null);
          setUser(null);
          devLog('init:error', { message: error.message, status: error.status });
        } else {
          sessionRef.current = data.session ?? null;
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
          devLog('init:loaded', { userId: data.session?.user?.id });
        }
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message ?? 'Falha ao carregar sessão';
        setAuthError(message);
        sessionRef.current = null;
        setSession(null);
        setUser(null);
        devLog('init:catch', { message });
      } finally {
        if (!mounted) return;
        setLoadingAuth(false);
        devLog('init:end');
      }
    };

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION' && !nextSession) {
        devLog('event:initial-session:empty');
        return;
      }

      devLog('event', { event, userId: nextSession?.user?.id });

      sessionRef.current = nextSession ?? null;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (event === 'SIGNED_IN') setAuthError(null);
      if (event === 'SIGNED_OUT') setAuthError(null);

      setLoadingAuth(false);
    });

    listenerRef.current = data;

    return () => {
      mounted = false;
      listenerRef.current?.subscription?.unsubscribe();
      listenerRef.current = null;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      loadingAuth,
      authError,
      refreshSession,
      signOut,
      withAuthRetry,
    }),
    [session, user, loadingAuth, authError, refreshSession, signOut, withAuthRetry]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
