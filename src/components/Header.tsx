import { useState } from 'react';
import { FaBars } from 'react-icons/fa';
import OrderButton from './OrderButton';
import MobileMenu from './MobileMenu';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <>
      <header className="bg-background fixed top-0 w-full z-50 flex items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="text-white text-xl font-bold">
          Palha Italiana
        </div>

        {/* Desktop Navigation */}
        <nav className="hidden md:flex items-center space-x-6">
          <a href="#home" className="text-white hover:text-primary transition-colors">Início</a>
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