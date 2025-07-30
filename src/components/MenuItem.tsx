import type { MenuItemProps } from '../types';

const MenuItem = ({ item, onAddToCart }: MenuItemProps) => {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden shadow-lg">
      <img
        src={item.image}
        alt={item.name}
        className="w-full h-48 object-cover"
      />
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