
import { FaTimes } from 'react-icons/fa';
import OrderButton from './OrderButton';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  return (
    <div
      className={`fixed inset-0 w-screen h-screen bg-background z-50 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : 'translate-x-full'
      }`}
    >
      <div className="flex flex-col items-center justify-center h-full space-y-8">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-white hover:text-primary transition-colors"
        >
          <FaTimes size={24} />
        </button>

        {/* Logo */}
        <div className="text-white text-2xl font-bold mb-8">
          Palha Italiana
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col items-center space-y-6">
          <a
            href="#home"
            onClick={onClose}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Início
          </a>
          <a
            href="#sabores"
            onClick={onClose}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Sabores
          </a>
          <a
            href="#encomendas"
            onClick={onClose}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Encomendas
          </a>
          <a
            href="#contato"
            onClick={onClose}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Contato
          </a>
        </nav>

        {/* Order Button */}
        <div className="mt-8">
          <OrderButton />
        </div>
      </div>
    </div>
  );
};

export default MobileMenu; 