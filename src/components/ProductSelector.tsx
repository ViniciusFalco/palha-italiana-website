import { useState, useEffect } from 'react';
import { FaTimes, FaShoppingCart } from 'react-icons/fa';
import type { ProductOption, CartItem, FlavorOption, CoverageOption } from '../types';

interface ProductSelectorProps {
  product: ProductOption;
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void;
  onClose: () => void;
}

const FLAVORS: FlavorOption[] = [
  { name: 'Chocolate', value: 'CHOCOLATE' },
  { name: 'Leite Ninho', value: 'LEITE_NINHO' },
  { name: 'Churros', value: 'CHURROS' },
  { name: 'Prestígio', value: 'PRESTIGIO' },
  { name: 'Paçoca', value: 'PACOCA' },
  { name: 'Cappuccino', value: 'CAPPUCINO' },
  { name: 'Limão Siciliano', value: 'LIMAO_SICILIANO' }
];

const COVERAGES: CoverageOption[] = [
  { name: 'Chocolate', value: 'CHOCOLATE' },
  { name: 'Morango', value: 'MORANGO' },
  { name: 'Limão', value: 'LIMAO' },
  { name: 'Caramelo', value: 'CARAMELO' },
  { name: 'Doce de Leite', value: 'DOCE_DE_LEITE' }
];

const ProductSelector = ({ product, onAddToCart, onClose }: ProductSelectorProps) => {
  const [selectedFlavor, setSelectedFlavor] = useState<string>('');
  const [selectedCoverage, setSelectedCoverage] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [customQuantity, setCustomQuantity] = useState<string>('');
  const [subtotal, setSubtotal] = useState<number>(0);

  // Calcular subtotal sempre que algo mudar
  useEffect(() => {
    let currentQuantity = quantity;
    if (product.allowCustomQuantity && customQuantity) {
      const customQty = parseInt(customQuantity);
      if (customQty >= (product.minQuantity || 50)) {
        currentQuantity = customQty;
      }
    }

    let currentPrice = product.basePrice;
    if (product.requiresSize && selectedSize) {
      const sizeOption = product.sizeOptions?.find(opt => opt.size === selectedSize);
      if (sizeOption) {
        currentPrice = sizeOption.price;
      }
    }

    // Para doces de festa, calcular baseado no cento
    if (product.category === 'party') {
      // Para doces de festa, o preço base é por cento (100 unidades)
      // Calculamos o valor proporcional baseado na quantidade
      const pricePerHundred = currentPrice;
      const proportion = currentQuantity / 100;
      setSubtotal(pricePerHundred * proportion);
    } else {
      setSubtotal(currentPrice * currentQuantity);
    }
  }, [selectedSize, quantity, customQuantity, product]);

  const handleAddToCart = () => {
    if (product.allowCustomQuantity && customQuantity) {
      const customQty = parseInt(customQuantity);
      if (customQty < (product.minQuantity || 50)) {
        alert(`Quantidade mínima é ${product.minQuantity || 50}`);
        return;
      }
    }

    let finalPrice = product.basePrice;
    if (product.requiresSize && selectedSize) {
      const sizeOption = product.sizeOptions?.find(opt => opt.size === selectedSize);
      if (sizeOption) {
        finalPrice = sizeOption.price;
      }
    }

    // Para doces de festa, mantemos o preço por cento e calculamos a proporção
    if (product.category === 'party') {
      // O preço já está correto por cento, não precisamos ajustar aqui
      // O cálculo da quantidade será feito no momento da exibição do carrinho
    }

    const cartItem: Omit<CartItem, 'quantity'> = {
      name: product.name,
      description: product.description,
      price: finalPrice,
      image: product.image,
      flavor: selectedFlavor,
      coverage: selectedCoverage,
      size: selectedSize
    };

    onAddToCart(cartItem);
    onClose();
  };

  const canAddToCart = () => {
    if (product.requiresFlavor && !selectedFlavor) return false;
    if (product.requiresCoverage && !selectedCoverage) return false;
    if (product.requiresSize && !selectedSize) return false;
    if (product.allowCustomQuantity && customQuantity) {
      const customQty = parseInt(customQuantity);
      return customQty >= (product.minQuantity || 50);
    }
    return true;
  };

  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 animate-fade-in">
      <div className="bg-white rounded-2xl shadow-2xl border border-pink-100 max-w-md w-full max-h-[90vh] overflow-y-auto transition-all duration-300">
        <div className="p-6 md:p-8">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bebas text-primary tracking-wide drop-shadow-lg">{product.name}</h3>
            <button
              onClick={onClose}
              className="text-pink-400 hover:text-pink-600 bg-pink-50 rounded-full p-2 shadow-md transition-colors"
              title="Fechar"
            >
              <FaTimes size={20} />
            </button>
          </div>

          <p className="text-gray-600 mb-6 text-base font-serif leading-relaxed">{product.description}</p>

          {/* Sabor */}
          {product.requiresFlavor && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Escolha o sabor <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedFlavor}
                  onChange={(e) => setSelectedFlavor(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresFlavor && !selectedFlavor ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione um sabor</option>
                  {FLAVORS.map((flavor) => (
                    <option key={flavor.value} value={flavor.value} style={{ color: '#111827' }}>
                      {flavor.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresFlavor && !selectedFlavor && (
                <p className="text-red-500 text-xs mt-1">Sabor é obrigatório</p>
              )}
            </div>
          )}

          {/* Cobertura */}
          {product.requiresCoverage && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Escolha a cobertura <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedCoverage}
                  onChange={(e) => setSelectedCoverage(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresCoverage && !selectedCoverage ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione uma cobertura</option>
                  {COVERAGES.map((coverage) => (
                    <option key={coverage.value} value={coverage.value} style={{ color: '#111827' }}>
                      {coverage.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresCoverage && !selectedCoverage && (
                <p className="text-red-500 text-xs mt-1">Cobertura é obrigatória</p>
              )}
            </div>
          )}

          {/* Tamanho */}
          {product.requiresSize && product.sizeOptions && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Escolha o tamanho <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedSize}
                  onChange={(e) => setSelectedSize(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresSize && !selectedSize ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione um tamanho</option>
                  {product.sizeOptions.map((sizeOption) => (
                    <option key={sizeOption.size} value={sizeOption.size} style={{ color: '#111827' }}>
                      {sizeOption.size} - {formatPrice(sizeOption.price)}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresSize && !selectedSize && (
                <p className="text-red-500 text-xs mt-1">Tamanho é obrigatório</p>
              )}
            </div>
          )}

          {/* Quantidade */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-pink-600 mb-2">
              Quantidade <span className="text-red-500">*</span>
            </label>
            {product.allowCustomQuantity ? (
              <div className="space-y-3">
                {product.category === 'party' && (
                  <div className="flex gap-2 mb-2">
                    {[50, 100, 200].map((qty) => (
                      <button
                        key={qty}
                        onClick={() => setCustomQuantity(qty.toString())}
                        className={`flex-1 py-2 px-4 rounded-lg border font-bold shadow-sm transition-all duration-150 text-base ${customQuantity === qty.toString() ? 'bg-pink-500 text-white border-pink-500 scale-105' : 'border-gray-300 hover:border-pink-500 text-gray-700 hover:bg-pink-50'}`}
                      >
                        {qty}
                      </button>
                    ))}
                  </div>
                )}
                <div className="relative">
                  <input
                    type="number"
                    value={customQuantity}
                    onChange={(e) => setCustomQuantity(e.target.value)}
                    min={product.minQuantity || 50}
                    placeholder={`Mínimo: ${product.minQuantity || 50}`}
                    style={{ backgroundColor: 'white', color: '#374151' }}
                    className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base pr-10 ${customQuantity && parseInt(customQuantity) < (product.minQuantity || 50) ? 'border-red-300' : 'border-gray-300'}`}
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                    <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none"/><text x="10" y="15" textAnchor="middle" fontSize="10" fill="currentColor">#</text></svg>
                  </span>
                </div>
              </div>
            ) : product.quantityOptions ? (
              <div className="relative">
                <select
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value))}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none text-base"
                >
                  {product.quantityOptions.map((qty) => (
                    <option key={qty} value={qty} style={{ color: '#111827' }}>
                      {qty}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
                  min="1"
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className="w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent text-base pr-10"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="2" fill="none"/><text x="10" y="15" textAnchor="middle" fontSize="10" fill="currentColor">#</text></svg>
                </span>
              </div>
            )}
            {product.allowCustomQuantity && customQuantity && parseInt(customQuantity) < (product.minQuantity || 50) && (
              <p className="text-red-500 text-xs mt-2">Quantidade mínima é {product.minQuantity || 50}</p>
            )}
          </div>

          {/* Subtotal */}
          <div className="mb-8 p-4 bg-pink-50 rounded-xl shadow flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-pink-600">Subtotal:</span>
              <span className="font-bold text-lg text-gray-900">{formatPrice(subtotal)}</span>
            </div>
            {product.category === 'party' && (
              <p className="text-xs text-gray-500 mt-1">
                Preço por cento: <span className="font-bold text-pink-600">{formatPrice(product.basePrice)}</span>
              </p>
            )}
          </div>

          <div className="flex space-x-3 mt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg bg-white hover:bg-pink-50 font-bold shadow-sm transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAddToCart}
              disabled={!canAddToCart()}
              className="flex-1 px-4 py-3 bg-pink-500 text-white rounded-lg font-bold shadow-lg hover:bg-pink-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
            >
              <FaShoppingCart size={16} />
              <span>Adicionar</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSelector; 