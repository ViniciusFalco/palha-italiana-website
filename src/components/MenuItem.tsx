import { useState } from 'react';
import type { MenuItemProps } from '../types';

const MenuItem = ({ item, onAddToCart }: MenuItemProps) => {
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
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      <div className="relative aspect-[4/3] bg-gray-700">
        {/* Placeholder enquanto carrega */}
        {!imageLoaded && (
          <div className="absolute inset-0 bg-gray-700 animate-pulse flex items-center justify-center">
            <div className="text-gray-500 text-sm">Carregando...</div>
          </div>
        )}
        
        {/* Imagem com lazy loading */}
        <img
          src={item.image}
          alt={item.name}
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
              <div className="text-sm">{item.name}</div>
            </div>
          </div>
        )}
      </div>
      
      <div className="p-4">
        <h3 className="font-gummy text-white text-lg font-bold mb-2">
          {item.name}
        </h3>
        <p className="font-serif text-gray-300 text-sm mb-3">
          {item.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="font-bebas text-primary text-xl">
            R$ {item.price.toFixed(2)}
          </span>
          <button
            onClick={() => onAddToCart(item)}
            className="bg-primary text-white px-4 py-2 rounded-lg font-bold hover:bg-pink-600 transition-colors"
          >
            Adicionar
          </button>
        </div>
      </div>
    </div>
  );
};

export default MenuItem; 