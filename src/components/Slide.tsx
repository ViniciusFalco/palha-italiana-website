import type { SlideProps } from '../types';

const Slide = ({ title, subtitle, text, backgroundImage }: SlideProps) => {
  // Verificar se é o segundo slide (Cappuccino) para aplicar itálico
  const isCappuccinoSlide = subtitle === 'Cappuccino';

  return (
    <div
      className="relative w-full h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      {/* Overlay escuro para melhor legibilidade */}
      <div className="absolute inset-0 bg-black bg-opacity-60"></div>
      
      {/* Conteúdo centralizado */}
      <div className="relative z-10 text-center text-white px-4 max-w-4xl mx-auto">
        {/* Título principal */}
        <h1 className="font-bebas text-4xl md:text-6xl lg:text-8xl mb-4 text-primary">
          {title}
        </h1>
        
        {/* Subtítulo */}
        <h2 className={`font-bebas text-2xl md:text-4xl lg:text-5xl mb-6 text-white ${
          isCappuccinoSlide ? 'italic' : ''
        }`}>
          {subtitle}
        </h2>
        
        {/* Texto descritivo */}
        <p className="font-serif text-base md:text-lg lg:text-xl leading-relaxed max-w-3xl mx-auto">
          {text}
        </p>
      </div>
    </div>
  );
};

export default Slide; 