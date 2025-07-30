import { FaMedal } from 'react-icons/fa';
import type { FlavorCardProps } from '../types';

const FlavorCard = ({ image, name, isFavorite = false }: FlavorCardProps) => {
  return (
    <div className="relative group cursor-pointer">
      <div className="relative overflow-hidden rounded-lg bg-gray-800">
        <img
          src={image}
          alt={name}
          className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-300"
        />
        <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300"></div>
        
        {/* Favorite Badge */}
        {isFavorite && (
          <div className="absolute top-2 right-2 flex items-center space-x-1 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold">
            <FaMedal size={12} />
            <span>Favorito</span>
          </div>
        )}
        
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
          <h3 className="font-gummy text-white text-lg font-bold">
            {name}
          </h3>
        </div>
      </div>
    </div>
  );
};

export default FlavorCard; 