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

export type AccessRole = 'admin' | 'staff';

export type AccessProfile = {
  id: string;
  email: string | null;
  role: AccessRole;
  is_active: boolean;
  created_at?: string | null;
  updated_at?: string | null;
};

export type AccessState =
  | 'loading'
  | 'anonymous'
  | 'ready'
  | 'missing_profile'
  | 'inactive'
  | 'forbidden'
  | 'error';

export type AuthRetryFn = <R extends RetryableResult>(
  operation: () => PromiseLike<R>,
  options?: WithAuthRetryOptions
) => Promise<R>;

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: AccessProfile | null;
  accessState: AccessState;
  isAdmin: boolean;
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

const isAbortLikeError = (error: any) => {
  const name = normalizeMessage((error as any)?.name).toLowerCase();
  const message = normalizeMessage((error as any)?.message).toLowerCase();
  return name === 'aborterror' || message.includes('aborterror') || message.includes('aborted');
};

// ✅ corrigido: sem parâmetro não usado
const buildForbiddenMessage = () => {
  return 'Conta sem permissão para acessar esta área. Solicite liberação do administrador.';
};

const normalizeRole = (role: unknown): AccessRole | null => {
  if (role === 'admin' || role === 'staff') return role;
  return null;
};

const normalizeProfile = (payload: any): AccessProfile | null => {
  if (!payload?.id) return null;

  const role = normalizeRole(payload.role);
  if (!role) return null;

  return {
    id: String(payload.id),
    email: payload.email ? String(payload.email) : null,
    role,
    is_active: payload.is_active === true,
    created_at: payload.created_at ? String(payload.created_at) : null,
    updated_at: payload.updated_at ? String(payload.updated_at) : null,
  };
};

const resolveAccessState = (profile: AccessProfile | null): AccessState => {
  if (!profile) return 'missing_profile';
  if (!profile.is_active) return 'inactive';
  if (profile.role !== 'admin') return 'forbidden';
  return 'ready';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<AccessProfile | null>(null);
  const [accessState, setAccessState] = useState<AccessState>('loading');
  const [loadingAuth, setLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const listenerRef =
    useRef<ReturnType<typeof supabase.auth.onAuthStateChange>['data'] | null>(null);
  const refreshingRef = useRef(false);
  const syncRunRef = useRef(0);
  const mountedRef = useRef(false);

  const sessionRef = useRef<Session | null>(null);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const clearResolvedState = useCallback(() => {
    if (!mountedRef.current) return;
    sessionRef.current = null;
    setSession(null);
    setUser(null);
    setProfile(null);
    setAccessState('anonymous');
    setAuthError(null);
    setLoadingAuth(false);
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, email, role, is_active, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (!error) return normalizeProfile(data);

      if (attempt === 0 && isAbortLikeError(error)) {
        devLog('profile:abort-retry', { userId, message: error?.message ?? null });
        continue;
      }

      throw error;
    }

    return null;
  }, []);

  const syncSessionState = useCallback(
    async (nextSession: Session | null, note: string) => {
      if (!mountedRef.current) return;

      const runId = syncRunRef.current + 1;
      syncRunRef.current = runId;

      sessionRef.current = nextSession;
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setProfile(null);
        setAccessState('anonymous');
        setAuthError(null);
        setLoadingAuth(false);
        devLog('profile:skip:no-user', { note });
        return;
      }

      setLoadingAuth(true);
      setAuthError(null);
      setAccessState('loading');
      devLog('profile:start', { note, userId: nextSession.user.id });

      try {
        const nextProfile = await fetchProfile(nextSession.user.id);
        if (!mountedRef.current || syncRunRef.current !== runId) return;

        const nextAccessState = resolveAccessState(nextProfile);
        setProfile(nextProfile);
        setAccessState(nextAccessState);
        devLog('profile:end', {
          note,
          userId: nextSession.user.id,
          role: nextProfile?.role ?? null,
          isActive: nextProfile?.is_active ?? null,
          accessState: nextAccessState,
        });
      } catch (err: any) {
        if (!mountedRef.current || syncRunRef.current !== runId) return;

        const message = err?.message ?? 'Falha ao carregar perfil de acesso';
        setProfile(null);
        setAccessState('error');
        setAuthError(message);
        devLog('profile:error', { note, message, status: err?.status });
      } finally {
        if (mountedRef.current && syncRunRef.current === runId) {
          setLoadingAuth(false);
        }
      }
    },
    [fetchProfile]
  );

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

      await syncSessionState(data.session ?? null, `refresh:${note}`);
      devLog('refresh:success', { userId: data.session?.user?.id, note });

      return data.session ?? null;
    } catch (err: any) {
      const message = err?.message ?? 'Erro ao renovar sessão';
      clearResolvedState();
      setAuthError(message);
      devLog('refresh:error', { note, message, status: err?.status });

      return null;
    } finally {
      refreshingRef.current = false;
      setLoadingAuth(false);
      devLog('refresh:end', { note });
    }
  }, [clearResolvedState, syncSessionState]);

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
        clearResolvedState();
        devLog('signout:end');
      }
    },
    [clearResolvedState, user?.id]
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
    mountedRef.current = true;

    setLoadingAuth(true);
    setAuthError(null);
    devLog('init:start');

    const bootstrap = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (!mounted) return;

        if (error) {
          clearResolvedState();
          setAuthError(error.message ?? 'Falha ao carregar sessão');
          devLog('init:error', { message: error.message, status: error.status });
        } else {
          devLog('init:loaded', { userId: data.session?.user?.id });
          await syncSessionState(data.session ?? null, 'init');
        }
      } catch (err: any) {
        if (!mounted) return;
        const message = err?.message ?? 'Falha ao carregar sessão';
        clearResolvedState();
        setAuthError(message);
        devLog('init:catch', { message });
      } finally {
        devLog('init:end');
      }
    };

    bootstrap();

    const { data } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;

      if (event === 'INITIAL_SESSION') {
        devLog('event:initial-session:ignored', { userId: nextSession?.user?.id });
        return;
      }

      devLog('event', { event, userId: nextSession?.user?.id });
      void syncSessionState(nextSession ?? null, `event:${event}`);
    });

    listenerRef.current = data;

    return () => {
      mounted = false;
      mountedRef.current = false;
      listenerRef.current?.subscription?.unsubscribe();
      listenerRef.current = null;
    };
  }, [clearResolvedState, syncSessionState]);

  const isAdmin = accessState === 'ready';

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user,
      profile,
      accessState,
      isAdmin,
      loadingAuth,
      authError,
      refreshSession,
      signOut,
      withAuthRetry,
    }),
    [
      session,
      user,
      profile,
      accessState,
      isAdmin,
      loadingAuth,
      authError,
      refreshSession,
      signOut,
      withAuthRetry,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
