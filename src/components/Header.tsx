import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaBars } from 'react-icons/fa';
import OrderButton from './OrderButton';
import MobileMenu from './MobileMenu';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

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

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <button
            onClick={goToHome}
            className="text-white hover:text-primary transition-colors"
          >
            Início
          </button>
          <a href="#sabores" className="text-white hover:text-primary transition-colors">Sabores</a>
          <a href="#encomendas" className="text-white hover:text-primary transition-colors">Encomendas</a>
          <a href="#contato" className="text-white hover:text-primary transition-colors">Contato</a>
        </nav>

        {/* Desktop Order Button */}
        <div className="hidden md:block">
          <OrderButton />
        </div>

        {/* Mobile Menu Button */}
        <div className="md:hidden flex items-center space-x-4">
          <OrderButton />
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