import type { SlideProps } from '../types';

const Slide = ({ title, subtitle, text, backgroundImage }: SlideProps) => {
  const isCappuccinoSlide = subtitle === 'Cappuccino';
  const hasBackgroundImage = !!backgroundImage?.trim();

  return (
    <div className="relative w-full h-screen bg-black flex items-center justify-center">
      {hasBackgroundImage && (
        <>
          <img src={backgroundImage} alt={`${title} – ${subtitle}`} className="absolute inset-0 w-full h-full object-cover" />
          <div className="absolute inset-0 bg-black bg-opacity-60" />
        </>
      )}

      {/* Título/Subtítulo */}
      <div className="absolute top-8 left-8 z-10 text-white">
        <h1 className="font-bebas text-3xl md:text-5xl lg:text-6xl mb-2 text-primary">{title}</h1>
        <h2 className={`font-bebas text-xl md:text-3xl lg:text-4xl ${isCappuccinoSlide ? 'italic' : ''}`}>{subtitle}</h2>
      </div>

      {/* Texto centralizado */}
      <div className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 px-4 max-w-4xl w-full">
        <div className="bg-black bg-opacity-80 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <p className="font-serif text-base md:text-lg lg:text-xl leading-relaxed text-center text-white">{text}</p>
        </div>
      </div>
    </div>
  );
};

export default Slide;
