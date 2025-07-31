
import { useState, useEffect, useRef } from 'react';
import Slide from './Slide';

const HeroSlider = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const intervalRef = useRef<number | null>(null);

  const slides = [
    {
      title: 'NOVIDADE:',
      subtitle: 'Sabor Romeu e Julieta',
      text: 'Dupla perfeita para dias frios e aconchegantes, proporcionando o irresistível doce de goiabada com queijo, finalizado com nossa deliciosa palha italiana.',
      backgroundImage: '/images/sabor-romeuejulieta.jpg'
    },
    {
      title: 'NOSSO SABOR ITALIANO!',
      subtitle: 'Cappuccino',
      text: 'Nossa dupla de origem italiana mescla a forte presença do Cappuccino sendo docemente servido na palha italiana.',
      backgroundImage: '' // Fundo preto temporário
    },
    {
      title: 'PRESENÇA CONFIRMADA:',
      subtitle: 'FINC',
      text: 'Estaremos presente no evento da FINC 2025 em Cataguases MG. Venha conhecer a feira e se deliciar nos nossos sabores de palha italianas.',
      backgroundImage: '' // Fundo preto temporário
    }
  ];

  // Função para iniciar o auto-play
  const startAutoPlay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    
    intervalRef.current = window.setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 8000);
  };

  // Função para parar o auto-play
  const stopAutoPlay = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  // Função para resetar o timer
  const resetTimer = () => {
    stopAutoPlay();
    startAutoPlay();
  };

  // Auto-play inicial
  useEffect(() => {
    startAutoPlay();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    resetTimer(); // Reset do timer quando há navegação manual
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
    resetTimer(); // Reset do timer quando há navegação manual
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    resetTimer(); // Reset do timer quando há navegação manual
  };

  return (
    <div className="relative w-full h-screen overflow-hidden">
      {/* Slides */}
      <div className="relative w-full h-full">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
              index === currentSlide ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Slide {...slide} />
          </div>
        ))}
      </div>

      {/* Navigation Buttons */}
      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all duration-300 md:block hidden"
        aria-label="Slide anterior"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 text-white p-3 rounded-full hover:bg-opacity-70 transition-all duration-300 md:block hidden"
        aria-label="Próximo slide"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-20 flex space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all duration-300 ${
              index === currentSlide
                ? 'bg-primary scale-125'
                : 'bg-white bg-opacity-80 hover:bg-opacity-100'
            }`}
            aria-label={`Ir para slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default HeroSlider; 