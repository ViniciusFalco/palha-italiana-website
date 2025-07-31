import { useState } from 'react';
import { FaMedal } from 'react-icons/fa';
import type { FlavorCardProps } from '../types';

const FlavorCard = ({ image, name, isFavorite = false }: FlavorCardProps) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  return (
    <div className="relative group cursor-pointer">
      <div className="relative overflow-hidden rounded-lg bg-gray-800 aspect-[4/3]">
        {/* Placeholder enquanto carrega */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-700 animate-pulse flex items-center justify-center">
            <div className="text-gray-500 text-sm">Carregando...</div>
          </div>
        )}
        
        {/* Imagem com lazy loading */}
        <img
          src={image}
          alt={name}
          loading="lazy"
          onLoad={handleImageLoad}
          onError={handleImageError}
          className={`w-full h-full object-cover transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          } ${imageError ? 'hidden' : ''}`}
        />
        
        {/* Fallback para erro de imagem */}
        {imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-gray-700 to-gray-800 flex items-center justify-center">
            <div className="text-center text-gray-400">
              <div className="text-4xl mb-2">🍰</div>
              <div className="text-sm">{name}</div>
            </div>
          </div>
        )}
        
        {/* Overlay hover */}
        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300"></div>
        
        {/* Favorite Badge */}
        {isFavorite && (
          <div className="absolute top-2 right-2 flex items-center space-x-1 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold z-10">
            <FaMedal size={12} />
            <span>Favorito</span>
          </div>
        )}
        
        {/* Nome do sabor */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
          <h3 className="font-gummy text-white text-lg font-bold">
            {name}
          </h3>
        </div>
      </div>
    </div>
  );
};

export default FlavorCard; 