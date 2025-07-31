
import { useNavigate } from 'react-router-dom';
import { FaTimes } from 'react-icons/fa';
import OrderButton from './OrderButton';

interface MobileMenuProps {
  isOpen: boolean;
  onClose: () => void;
}

const MobileMenu = ({ isOpen, onClose }: MobileMenuProps) => {
  const navigate = useNavigate();

  const goToHome = () => {
    navigate('/');
    onClose();
  };

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
        <div 
          className="cursor-pointer flex items-center mb-8"
          onClick={goToHome}
        >
          <img 
            src="/logo.png" 
            alt="Palha Italiana" 
            className="h-16 w-auto"
          />
        </div>

        {/* Navigation Links */}
        <nav className="flex flex-col items-center space-y-6">
          <button
            onClick={goToHome}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Início
          </button>
          <button
            onClick={() => {
              if (window.location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'sabores');
                navigate('/');
              } else {
                const el = document.getElementById('sabores');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
              onClose();
            }}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Sabores
          </button>
          <button
            onClick={() => {
              if (window.location.pathname === '/pedidos') {
                localStorage.setItem('scrollTo', 'encomendas');
                navigate('/');
              } else {
                const el = document.getElementById('encomendas');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }
              onClose();
            }}
            className="text-white hover:text-primary transition-colors text-lg"
          >
            Encomendas
          </button>
          <a
            href="https://wa.me/553221985767312"
            target="_blank"
            rel="noopener noreferrer"
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