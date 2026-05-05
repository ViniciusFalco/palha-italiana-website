import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AdminButton, AdminField, AdminInput } from '../../components/admin/AdminPrimitives';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth/AuthProvider';

export default function AdminLoginPage() {
  const { isAdmin, loadingAuth } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  const locationError = (location.state as { error?: string } | null)?.error ?? null;

  useEffect(() => {
    if (!loadingAuth && isAdmin) {
      navigate('/admin', { replace: true });
    }
  }, [isAdmin, loadingAuth, navigate]);

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
        <div className="admin-login-brand">
          <img
            src="/logo.svg"
            alt="Sweet Child"
            onError={(event) => {
              event.currentTarget.src = '/logo.png';
            }}
          />
        </div>
        <h1>Login do painel</h1>

        <form className="admin-login-form" onSubmit={handleSubmit}>
          <AdminField label="Email">
            <AdminInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@dominio.com"
              required
            />
          </AdminField>
          <AdminField label="Senha">
            <AdminInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
            />
          </AdminField>
          {(error || locationError) && (
            <div className="admin-inline-error">{error ?? locationError}</div>
          )}
          <AdminButton type="submit" disabled={loading}>
            {loading ? 'Entrando...' : 'Entrar'}
          </AdminButton>
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
