import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import OrderButton from './OrderButton';
import MobileMenu from './MobileMenu';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const toggleMobileMenu = () => setIsMobileMenuOpen(!isMobileMenuOpen);
  const goToHome = () => navigate('/');

  /* Auxilia no scroll com offset */
  const scrollWithOffset = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    const y = el.getBoundingClientRect().top + window.pageYOffset - 80; // 80 px = altura aproximada do header
    window.scrollTo({ top: y, behavior: 'smooth' });
  };

  return (
    <>
      <header className="bg-background fixed top-0 w-full z-50 flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="cursor-pointer flex items-center" onClick={goToHome}>
          <img src="/logo.png" alt="Palha Italiana" className="h-10 w-auto md:h-11" />
        </div>

        {/* Navegação desktop */}
        <nav className="hidden md:flex items-center justify-center flex-1 space-x-8">
          <button onClick={goToHome} className="text-white hover:text-primary font-medium transition-colors">
            Início
          </button>

          <button
            onClick={() => {
              if (location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'sabores');
                navigate('/');
              } else {
                scrollWithOffset('sabores');
              }
            }}
            className="text-white hover:text-primary font-medium transition-colors"
          >
            Sabores
          </button>

          <button
            onClick={() => {
              if (location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'encomendas');
                navigate('/');
              } else {
                scrollWithOffset('encomendas');
              }
            }}
            className="text-white hover:text-primary font-medium transition-colors"
          >
            Encomendas
          </button>

          <a
            href="https://wa.me/553221985767312"
            target="_blank"
            rel="noopener noreferrer"
            className="text-white hover:text-primary font-medium transition-colors"
          >
            Contato
          </a>
        </nav>

        {/* Botão “Fazer pedido” no desktop */}
        {location.pathname !== '/pedidos' && <div className="hidden md:block"><OrderButton /></div>}

        {/* Menu/botão mobile */}
        <div className="md:hidden flex items-center space-x-4">
          {location.pathname !== '/pedidos' && <OrderButton />}
          <button onClick={toggleMobileMenu} className="text-white hover:text-primary transition-colors">
            <FaBars size={24} />
          </button>
        </div>
      </header>

      {/* Menu mobile */}
      <MobileMenu isOpen={isMobileMenuOpen} onClose={toggleMobileMenu} />
    </>
  );
};

export default Header;
