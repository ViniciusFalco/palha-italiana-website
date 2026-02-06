import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth/AuthProvider';

type Message = {
  type: 'error' | 'success';
  text: string;
};

const devLog = (label: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.log(`[reset-password] ${label}`, payload);
};

export default function ResetPasswordPage() {
  const { session, loadingAuth } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const hasSession = Boolean(session);
  const isSuccess = message?.type === 'success';

  useEffect(() => {
    if (!loadingAuth) {
      devLog('session-check', { hasSession });
    }
  }, [hasSession, loadingAuth]);

  useEffect(() => {
    if (!isSuccess) return;
    const timeout = window.setTimeout(() => {
      navigate('/admin/login', { replace: true });
    }, 3500);
    return () => window.clearTimeout(timeout);
  }, [isSuccess, navigate]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!session) {
      setMessage({
        type: 'error',
        text: 'Link inv\u00e1lido ou expirado. Solicite um novo e-mail de redefini\u00e7\u00e3o.',
      });
      return;
    }

    if (password.length < 8) {
      setMessage({ type: 'error', text: 'A senha deve ter pelo menos 8 caracteres.' });
      return;
    }

    if (password !== confirmPassword) {
      setMessage({ type: 'error', text: 'As senhas n\u00e3o conferem.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    devLog('update:start');

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      const text = error.message ?? 'Falha ao atualizar senha.';
      setMessage({ type: 'error', text });
      devLog('update:error', { message: text });
      setSubmitting(false);
      return;
    }

    setMessage({ type: 'success', text: 'Senha atualizada com sucesso' });
    setPassword('');
    setConfirmPassword('');
    setSubmitting(false);
    devLog('update:success');
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>Redefinir senha</h1>
        {loadingAuth ? (
          <p className="admin-login-subtitle">Verificando link...</p>
        ) : !hasSession ? (
          <>
            <div className="admin-inline-error">
              Link inv\u00e1lido ou expirado. Solicite um novo e-mail de redefini\u00e7\u00e3o.
            </div>
            <div className="admin-login-actions">
              <Link to="/admin/forgot-password" className="admin-login-link">
                Solicitar novo e-mail
              </Link>
              <button
                type="button"
                className="admin-button-ghost"
                onClick={() => navigate('/admin/login', { replace: true })}
              >
                Ir para login
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="admin-login-subtitle">Crie uma nova senha para sua conta.</p>
            {message && (
              <div className={message.type === 'error' ? 'admin-inline-error' : 'admin-inline-success'}>
                {message.text}
              </div>
            )}
            <form className="admin-login-form" onSubmit={handleSubmit}>
              <label className="admin-field">
                <span>Nova senha</span>
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="admin-input"
                  placeholder="M\u00ednimo 8 caracteres"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={submitting || isSuccess}
                />
              </label>
              <label className="admin-field">
                <span>Confirmar senha</span>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className="admin-input"
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  minLength={8}
                  required
                  disabled={submitting || isSuccess}
                />
              </label>
              <button type="submit" className="admin-button" disabled={submitting || isSuccess}>
                {submitting ? 'Salvando...' : 'Salvar'}
              </button>
            </form>
            {isSuccess && (
              <div className="admin-login-actions">
                <button
                  type="button"
                  className="admin-button-ghost"
                  onClick={() => navigate('/admin/login', { replace: true })}
                >
                  Ir para login
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
