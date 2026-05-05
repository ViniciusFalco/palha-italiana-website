import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthProvider';

const SLOW_LOADING_MS = 8000;

type RequireAdminProps = {
  children: React.ReactNode;
};

const ACCESS_ERROR_BY_STATE = {
  missing_profile:
    'Seu usuario foi autenticado, mas ainda nao possui um profile em public.profiles.',
  inactive: 'Sua conta esta inativa. Solicite reativacao ao administrador.',
  forbidden: 'Sua conta nao possui permissao de admin para acessar o painel.',
} as const;

export default function RequireAdmin({ children }: RequireAdminProps) {
  const { user, session, profile, accessState, isAdmin, loadingAuth, authError, refreshSession } = useAuth();
  const [slowLoading, setSlowLoading] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const navigate = useNavigate();
  const redirectingRef = useRef(false);

  const debugInfo = useMemo(
    () => ({
      userId: user?.id ?? null,
      hasSession: Boolean(session),
      profileRole: profile?.role ?? null,
      accessState,
      slowLoading,
      authError,
    }),
    [accessState, authError, profile?.role, session, slowLoading, user?.id]
  );

  useEffect(() => {
    if (!loadingAuth && accessState !== 'loading') {
      setSlowLoading(false);
      return;
    }

    const timeout = window.setTimeout(() => setSlowLoading(true), SLOW_LOADING_MS);
    return () => window.clearTimeout(timeout);
  }, [accessState, loadingAuth]);

  useEffect(() => {
    if (loadingAuth) return;
    if (!user && !redirectingRef.current) {
      redirectingRef.current = true;
      navigate('/admin/login', { replace: true });
    }
  }, [loadingAuth, navigate, user]);

  useEffect(() => {
    if (loadingAuth || !user) return;
    if (redirectingRef.current) return;

    if (accessState === 'missing_profile' || accessState === 'inactive' || accessState === 'forbidden') {
      redirectingRef.current = true;
      navigate('/admin/login', {
        replace: true,
        state: { error: ACCESS_ERROR_BY_STATE[accessState] },
      });
    }
  }, [accessState, loadingAuth, navigate, user]);

  const handleRetry = async () => {
    setRetrying(true);
    redirectingRef.current = false;
    await refreshSession('manual-retry');
    setRetrying(false);
  };

  const showLoading = loadingAuth || accessState === 'loading';

  if (showLoading && !slowLoading && !authError) {
    return <div className="admin-auth-loading">Validando sessao e permissoes...</div>;
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
              sessao: {debugInfo.hasSession ? 'sim' : 'nao'} | access: {debugInfo.accessState} | role:{' '}
              {debugInfo.profileRole ?? 'n/a'} | slow: {debugInfo.slowLoading ? 'sim' : 'nao'}
            </small>
          </div>
        )}
      </div>
    );
  }

  if (accessState === 'error') {
    return (
      <div className="admin-auth-loading">
        <p>{authError ?? 'Falha ao autenticar.'}</p>
        <button type="button" className="admin-button" onClick={handleRetry} disabled={retrying}>
          {retrying ? 'Recarregando...' : 'Tentar novamente'}
        </button>
        {import.meta.env.DEV && (
          <div className="admin-debug">
            <small>
              userId: {debugInfo.userId ?? 'n/a'} | access: {debugInfo.accessState}
            </small>
          </div>
        )}
      </div>
    );
  }

  if (!user && !loadingAuth) {
    return null;
  }

  if (isAdmin) {
    return <>{children}</>;
  }

  return null;
}
