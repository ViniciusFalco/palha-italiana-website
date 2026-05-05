import { Outlet } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import AdminHeader from '../../components/admin/AdminHeader';
import AdminSidebar from '../../components/admin/AdminSidebar';
import { useDocumentScrollLock } from '../../hooks/useDocumentScrollLock';
import '../../styles/admin-system.css';
import '../../styles/admin.css';

export default function AdminLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false);
  const [mobileMenuActive, setMobileMenuActive] = useState(false);
  const closeTimerRef = useRef<number | null>(null);
  const openRafRef = useRef<number | null>(null);
  useDocumentScrollLock(mobileMenuVisible);

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
    if (mobileMenuOpen) {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      if (openRafRef.current) {
        window.cancelAnimationFrame(openRafRef.current);
        openRafRef.current = null;
      }
      setMobileMenuVisible(true);
      setMobileMenuActive(false);
      openRafRef.current = window.requestAnimationFrame(() => {
        setMobileMenuActive(true);
        openRafRef.current = null;
      });
      return;
    }

    if (mobileMenuVisible) {
      setMobileMenuActive(false);
      closeTimerRef.current = window.setTimeout(() => {
        setMobileMenuVisible(false);
        closeTimerRef.current = null;
      }, 320);
    }
  }, [mobileMenuOpen, mobileMenuVisible]);

  useEffect(() => {
    return () => {
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
      if (openRafRef.current) {
        window.cancelAnimationFrame(openRafRef.current);
      }
    };
  }, []);

  const openMobileMenu = () => setMobileMenuOpen(true);
  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <div className="admin-root">
      <AdminHeader onOpenMobileMenu={openMobileMenu} />
      <div className="admin-body">
        <div className="admin-sidebar-desktop">
          <AdminSidebar />
        </div>
        {mobileMenuVisible && (
          <div
            className={`admin-drawer-overlay ${mobileMenuActive ? 'is-visible' : 'is-closing'}`}
            role="presentation"
            onClick={closeMobileMenu}
          >
            <div
              className="admin-drawer"
              role="dialog"
              aria-modal="true"
              aria-label="Menu lateral"
              onClick={(e) => e.stopPropagation()}
            >
              <AdminSidebar isMobile onNavigate={closeMobileMenu} onCloseMobile={closeMobileMenu} />
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
