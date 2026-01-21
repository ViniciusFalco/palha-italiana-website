import { Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminSidebar from '../../components/admin/AdminSidebar';
import '../../styles/admin.css';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, []);

  useEffect(() => {
    document.body.classList.toggle('admin-lock-scroll', mobileMenuOpen);
    return () => {
      document.body.classList.remove('admin-lock-scroll');
    };
  }, [mobileMenuOpen]);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="admin-root">
      <AdminHeader onOpenMobileMenu={() => setMobileMenuOpen(true)} />
      <div className="admin-body">
        <div className="admin-sidebar-desktop">
          <AdminSidebar />
        </div>
        {mobileMenuOpen && (
          <div
            className="admin-drawer-overlay"
            role="presentation"
            onClick={closeMobileMenu}
          >
            <div
              className="admin-drawer"
              role="dialog"
              aria-modal="true"
              onClick={(e) => e.stopPropagation()}
            >
              <AdminSidebar isMobile onNavigate={closeMobileMenu} />
            </div>
          </div>
        )}
        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
