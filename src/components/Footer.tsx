
import { FaWhatsapp, FaInstagram, FaFacebook } from 'react-icons/fa';

const Footer = () => {
  return (
    <footer id="contato" className="bg-background py-8">
      <div className="container mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Logo */}
          <div className="text-white text-xl font-bold mb-4 md:mb-0">
            Palha Italiana
          </div>

          {/* Social Media Icons */}
          <div className="flex space-x-4 mb-4 md:mb-0">
            <a
              href="https://wa.me/5532984669122"
              target="_blank"
              rel="noopener noreferrer"
              className="text-white hover:text-primary transition-colors"
            >
              <FaWhatsapp size={24} />
            </a>
            <a
              href="#"
              className="text-white hover:text-primary transition-colors"
            >
              <FaInstagram size={24} />
            </a>
            <a
              href="#"
              className="text-white hover:text-primary transition-colors"
            >
              <FaFacebook size={24} />
            </a>
          </div>

          {/* Copyright */}
          <div className="text-gray-400 text-sm">
            © 2024 Palha Italiana. Todos os direitos reservados.
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer; 