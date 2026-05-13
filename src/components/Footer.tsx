
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';

type FooterProps = {
  className?: string;
};

const Footer = ({ className }: FooterProps) => {
  return (
    <footer id="contato" className={`bg-background py-8 ${className ?? ''}`}>
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Brand Logo */}
          <div className="text-center md:text-left mb-4 md:mb-0 flex items-center justify-center md:justify-start">
            <img src="/logo.png" alt="Palha Italiana Sweet Child" className="h-12 w-auto" />
          </div>

          {/* Social Media Icons */}
          <div className="flex space-x-4 mb-4 md:mb-0">
            <a
              href="https://wa.me/553221985767312"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-primary transition-colors"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={24} />
            </a>
            <a
              href="https://www.instagram.com/palhaitalianasweetchild/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram size={24} />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-gray-400 text-sm">
            © 2026 Sweet Child. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 
