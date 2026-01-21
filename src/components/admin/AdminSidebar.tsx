import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth/AuthProvider';
import { supabase } from '../../lib/supabase';

const sections = [
  {
    title: 'Operacao',
    links: [
      { to: '/admin/dashboard', label: 'Dashboard' },
      { to: '/admin/pedidos', label: 'Pedidos' },
      { to: '/admin/produtos', label: 'Produtos' },
    ],
  },
  {
    title: 'Financeiro',
    links: [
      { to: '/admin/financeiro', label: 'Dashboard Financeiro' },
      { to: '/admin/recibos', label: 'Recibos' },
    ],
  },
];

type AdminSidebarProps = {
  onNavigate?: () => void;
  isMobile?: boolean;
};

export default function AdminSidebar({ onNavigate, isMobile }: AdminSidebarProps) {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const clearSupabaseStorage = () => {
    const keysToRemove: string[] = [];
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index);
      if (!key) continue;
      if (key.startsWith('sb-') || key.includes('supabase.auth')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const result = await signOut({ label: 'admin-sidebar:logout' });
      if (result.error) {
        await supabase.auth.signOut();
      }
    } catch (error) {
      await supabase.auth.signOut();
      alert('Falha ao sair do Supabase. SessÇãÇ§o encerrada localmente.');
    } finally {
      clearSupabaseStorage();
      navigate('/admin/login', { replace: true });
      setLoggingOut(false);
      if (onNavigate) onNavigate();
    }
  };

  return (
    <aside className={`admin-sidebar${isMobile ? ' admin-sidebar-mobile' : ''}`}>
      <div className="admin-sidebar-brand">
        <div className="admin-logo">
          <img src="/logo.png" alt="Sweet Child" />
        </div>
        <div className="admin-branding">
          <span className="admin-brand">Sweet Child</span>
          <p className="admin-brand-subtitle">Painel administrativo</p>
        </div>
      </div>
      <nav className="admin-sidebar-nav">
        {sections.map((section, sectionIndex) => (
          <div key={section.title} className="admin-sidebar-section">
            <span className="admin-sidebar-section-title">{section.title}</span>
            <div className="admin-sidebar-section-links">
              {section.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  end
                  className={({ isActive }) =>
                    `admin-sidebar-link${isActive ? ' active' : ''}`
                  }
                  onClick={onNavigate}
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
            {sectionIndex < sections.length - 1 && (
              <span className="admin-sidebar-section-divider" aria-hidden="true" />
            )}
          </div>
        ))}
      </nav>
      <div className="admin-sidebar-footer">
        <span className="admin-sidebar-divider" aria-hidden="true" />
        <button type="button" className="admin-logout" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Saindo...' : 'Sair da conta'}
        </button>
        <a
          className="admin-sidebar-credit"
          href="https://deltacode-eight.vercel.app/"
          target="_blank"
          rel="noreferrer"
        >
          Desenvolvido por Delta Code
        </a>
        <span className="admin-sidebar-version">versão beta 1.0</span>
      </div>
    </aside>
  );
}
