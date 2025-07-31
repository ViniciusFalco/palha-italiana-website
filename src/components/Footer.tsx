
import { FaWhatsapp, FaInstagram } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer id="contato" className="bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Brand Name */}
          <div className="text-center md:text-left mb-4 md:mb-0">
            <div className="text-white text-xl font-bold mb-1">
              Sweet Child
            </div>
            <div className="text-gray-300 text-sm font-light">
              Doces artesanais
            </div>
          </div>

          {/* Social Media Icons */}
          <div className="flex space-x-4 mb-4 md:mb-0">
            <a
              href="https://wa.me/5532984669122"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-primary transition-colors"
              aria-label="WhatsApp"
            >
              <FaWhatsapp size={24} />
            </a>
            <a
              href="#"
              className="text-white hover:text-primary transition-colors"
              aria-label="Instagram"
            >
              <FaInstagram size={24} />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-gray-400 text-sm">
            © 2025 Sweet Child. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 