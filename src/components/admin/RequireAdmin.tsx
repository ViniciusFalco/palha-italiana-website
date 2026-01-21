import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthProvider';
import { supabase } from '../../lib/supabase';

type AdminStatus = 'idle' | 'checking' | 'ready' | 'forbidden' | 'error';

const SLOW_LOADING_MS = 8000;

type RequireAdminProps = {
  children: React.ReactNode;
};

export default function RequireAdmin({ children }: RequireAdminProps) {
  const { user, session, loadingAuth, authError, refreshSession, withAuthRetry } = useAuth();
  const [status, setStatus] = useState<AdminStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowLoading, setSlowLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const navigate = useNavigate();
  const checkedUserIdRef = useRef<string | null>(null);
  const redirectingRef = useRef(false);

  const debugInfo = useMemo(
    () => ({
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      status,
      slowLoading,
      authError,
    }),
    [authError, session, slowLoading, status, user?.id]
  );

  useEffect(() => {
    if (!loadingAuth) {
      setSlowLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => setSlowLoading(true), SLOW_LOADING_MS);
    return () => window.clearTimeout(timeout);
  }, [loadingAuth]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/admin/login', { replace: true });
    }
  }, [loadingAuth, navigate, user]);

  useEffect(() => {
    if (loadingAuth || !user) return;
    if (checkedUserIdRef.current === user.id && status === 'ready') return;

    let aborted = false;
    const checkProfile = async () => {
      setStatus('checking');
      setErrorMessage(null);
      const { data, error } = await withAuthRetry(
        () =>
          supabase
            .from('profiles')
            .select('role, is_active')
            .eq('id', user.id)
            .maybeSingle(),
        { label: 'admin-profile' }
      );

      if (aborted) return;
      if (error) {
        setStatus('error');
        setErrorMessage('Falha ao verificar permissões.');
        return;
      }

      const role = (data as any)?.role;
      const isActive = (data as any)?.is_active;
      const isAdmin = role === 'admin' && isActive === true;

      if (!isAdmin) {
        setStatus('forbidden');
        setErrorMessage('Acesso negado');
        navigate('/admin/login', { replace: true, state: { error: 'Acesso negado' } });
        return;
      }

      checkedUserIdRef.current = user.id;
      setStatus('ready');
    };

    checkProfile();
    return () => {
      aborted = true;
    };
  }, [loadingAuth, navigate, status, user, withAuthRetry]);

  const handleRetry = async () => {
    setRetrying(true);
    setErrorMessage(null);
    setStatus('idle');
    redirectingRef.current = false;
    await refreshSession('manual-retry');
    setRetrying(false);
  };

  const showLoading = loadingAuth || status === 'idle' || status === 'checking';

  if (showLoading && !slowLoading && !authError) {
    return <div className="admin-auth-loading">Autenticando...</div>;
  }

  if (showLoading && (slowLoading || authError)) {
    return (
      <div className="admin-auth-loading">
        <p>{authError ?? 'Autenticação demorando. Tente novamente.'}</p>
        <button type="button" className="admin-button" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Recarregando...' : 'Tentar novamente'}
        </button>
        {import.meta.env.DEV && (
          <div className="admin-debug">
            <small>
              sessão: {debugInfo.hasSession ? 'sim' : 'não'} | status: {debugInfo.status} | slow:{' '}
              {debugInfo.slowLoading ? 'sim' : 'não'}
            </small>
          </div>
        )}
      </div>
    );
  }

  if (status === 'forbidden') {
    return (
      <div className="admin-auth-loading">
        <p>{errorMessage ?? 'Acesso negado'}</p>
        <button
          type="button"
          className="admin-button"
          onClick={() => navigate('/admin/login', { replace: true, state: { error: 'Acesso negado' } })}
        >
          Ir para login
        </button>
      </div>
    );
  }

  if (!user && !loadingAuth) {
    return null;
  }

  if (status === 'error') {
    return (
      <div className="admin-auth-loading">
        <p>{errorMessage ?? 'Falha ao autenticar.'}</p>
        <button type="button" className="admin-button" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Recarregando...' : 'Tentar novamente'}
        </button>
        {import.meta.env.DEV && debugInfo.userId && (
          <div className="admin-debug">
            <small>userId: {debugInfo.userId}</small>
          </div>
        )}
      </div>
    );
  }

  if (status === 'ready') {
    return <>{children}</>;
  }

  return null;
}
