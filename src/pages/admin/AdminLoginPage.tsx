import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const locationError = (location.state as { error?: string } | null)?.error ?? null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError || !data.session) {
        throw signInError ?? new Error('Falha ao entrar');
      }

      navigate('/admin', { replace: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao realizar login.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>Login do Admin</h1>
        <p className="admin-login-subtitle">Acesse com email e senha autorizados</p>
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="admin-input"
              placeholder="admin@dominio.com"
              required
            />
          </label>
          <label className="admin-field">
            <span>Senha</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="admin-input"
              placeholder="********"
              required
            />
          </label>
          {(error || locationError) && (
            <div className="admin-inline-error">{error ?? locationError}</div>
          )}
          <button type="submit" className="admin-button" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
          <div className="admin-login-actions">
            <Link to="/admin/forgot-password" className="admin-login-link">
              Esqueci minha senha
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
