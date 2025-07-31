import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import OrderButton from './OrderButton';
import MobileMenu from './MobileMenu';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const goToHome = () => {
    navigate('/');
  };

  return (
    <>
      <header className="bg-background fixed top-0 w-full z-50 flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div 
          className="cursor-pointer flex items-center"
          onClick={goToHome}
        >
          <img 
            src="/logo.png" 
            alt="Palha Italiana" 
            className="h-12 w-auto"
          />
        </div>

        {/* Desktop Navigation - Centralizado */}
        <nav className="hidden md:flex items-center justify-center flex-1 space-x-8">
          <button
            onClick={goToHome}
            className="text-white hover:text-primary transition-colors font-medium"
          >
            Início
          </button>
          <button
            onClick={() => {
              const scrollWithOffset = (id) => {
                const el = document.getElementById(id);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.pageYOffset - 80; // 80px de offset para header
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              };
              if (location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'sabores');
                navigate('/');
              } else {
                scrollWithOffset('sabores');
              }
            }}
            className="text-white hover:text-primary transition-colors font-medium"
          >
            Sabores
          </button>
          <button
            onClick={() => {
              const scrollWithOffset = (id) => {
                const el = document.getElementById(id);
                if (el) {
                  const y = el.getBoundingClientRect().top + window.pageYOffset - 80;
                  window.scrollTo({ top: y, behavior: 'smooth' });
                }
              };
              if (location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'encomendas');
                navigate('/');
              } else {
                scrollWithOffset('encomendas');
              }
            }}
            className="text-white hover:text-primary transition-colors font-medium"
          >
            Encomendas
          </button>
          <a
            href="https://wa.me/553221985767312"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-primary transition-colors font-medium"
          >
            Contato
          </a>
        </nav>

        {/* Desktop Order Button */}
        {location.pathname !== '/pedidos' && (
          <div className="hidden md:block">
            <OrderButton />
          </div>
        )}

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center space-x-4">
          {location.pathname !== '/pedidos' && <OrderButton />}
          <button
            onClick={toggleMobileMenu}
            className="text-white hover:text-primary transition-colors"
          >
            <FaBars size={24} />
          </button>
        </div>
      </header>

      {/* Mobile Menu */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={toggleMobileMenu} />
    </>
  );
};

export default Header; 