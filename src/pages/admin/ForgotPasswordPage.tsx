import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

type Message = {
  type: 'error' | 'success';
  text: string;
};

const devLog = (label: string, payload?: Record<string, unknown>) => {
  if (!import.meta.env.DEV) return;
  console.log(`[forgot-password] ${label}`, payload);
};

const resolveSiteUrl = () => {
  const envUrl = import.meta.env.VITE_SITE_URL;
  if (envUrl && typeof envUrl === 'string') {
    return envUrl.replace(/\/$/, '');
  }

  return import.meta.env.PROD
    ? 'https://palha-italiana-website.vercel.app'
    : 'http://localhost:5173';
};

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setMessage({ type: 'error', text: 'Informe um e-mail v\u00e1lido.' });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    devLog('request:start');

    const redirectTo = `${resolveSiteUrl()}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, { redirectTo });

    if (error) {
      const text = error.message ?? 'Falha ao enviar o e-mail de redefini\u00e7\u00e3o.';
      setMessage({ type: 'error', text });
      devLog('request:error', { message: text });
      setSubmitting(false);
      return;
    }

    setMessage({
      type: 'success',
      text: 'Se o e-mail estiver cadastrado, voc\u00ea receber\u00e1 um link de redefini\u00e7\u00e3o.',
    });
    setSubmitting(false);
    devLog('request:success');
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <h1>Esqueci minha senha</h1>
        <p className="admin-login-subtitle">
          Informe seu e-mail para receber o link de redefini\u00e7\u00e3o.
        </p>
        {message && (
          <div className={message.type === 'error' ? 'admin-inline-error' : 'admin-inline-success'}>
            {message.text}
          </div>
        )}
        <form className="admin-login-form" onSubmit={handleSubmit}>
          <label className="admin-field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="admin-input"
              placeholder="admin@dominio.com"
              autoComplete="email"
              required
              disabled={submitting}
            />
          </label>
          <button type="submit" className="admin-button" disabled={submitting}>
            {submitting ? 'Enviando...' : 'Enviar link'}
          </button>
        </form>
        <div className="admin-login-actions">
          <Link to="/admin/login" className="admin-login-link">
            Voltar para login
          </Link>
        </div>
      </div>
    </div>
  );
}
