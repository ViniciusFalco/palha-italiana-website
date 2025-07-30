import type { SlideProps } from '../types';

const Slide = ({ title, subtitle, text, backgroundImage }: SlideProps) => {
  return (
    <div
      className="relative w-full h-screen bg-cover bg-center bg-no-repeat flex items-center justify-center"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="absolute inset-0 bg-black bg-opacity-50"></div>
      <div className="relative z-10 text-center text-white px-4 max-w-4xl">
        <h1 className="font-bebas text-6xl md:text-8xl mb-4">
          {title}
        </h1>
        <h2 className="font-bebas text-3xl md:text-5xl mb-6 text-primary">
          {subtitle}
        </h2>
        <p className="font-serif text-lg md:text-xl leading-relaxed">
          {text}
        </p>
      </div>
    </div>
  );
};

export default Slide; 