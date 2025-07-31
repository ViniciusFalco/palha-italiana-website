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
          <a href="#sabores" className="text-white hover:text-primary transition-colors font-medium">Sabores</a>
          <a href="#encomendas" className="text-white hover:text-primary transition-colors font-medium">Encomendas</a>
          <a href="#contato" className="text-white hover:text-primary transition-colors font-medium">Contato</a>
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