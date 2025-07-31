import { FaMedal } from 'react-icons/fa';
import type { FlavorCardProps } from '../types';

const FlavorCard = ({ image, name, isFavorite = false }: FlavorCardProps) => (
  <div className="relative group cursor-pointer">
    <div className="relative overflow-hidden rounded-lg bg-gray-800 aspect-[4/3]">
      <img src={image} alt={name} className="w-full h-full object-cover" />

      {/* Overlay ao passar o mouse */}
      <div className="absolute inset-0 bg-black bg-opacity-20 group-hover:bg-opacity-30 transition-all duration-300" />

      {/* Selo de favorito */}
      {isFavorite && (
        <div className="absolute top-2 right-2 flex items-center space-x-1 bg-yellow-500 text-black px-2 py-1 rounded-full text-xs font-bold z-10">
          <FaMedal size={12} />
          <span>Favorito</span>
        </div>
      )}

      {/* Nome do sabor */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black via-black/80 to-transparent p-4">
        <h3 className="font-gummy text-white text-lg font-bold">{name}</h3>
      </div>
    </div>
  </div>
);

export default FlavorCard;
