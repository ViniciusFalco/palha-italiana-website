import { useState, useEffect } from 'react';
import { FaTimes, FaShoppingCart, FaPlus, FaMinus } from 'react-icons/fa';
import type { ProductOption, CartItem, FlavorOption, CoverageOption, RibbonWidthOption, ColorOption } from '../types';

interface ProductSelectorProps {
  product: ProductOption;
  onAddToCart: (item: CartItem) => void;
  onClose: () => void;
}

const FLAVORS: FlavorOption[] = [
  { name: 'Chocolate', value: 'CHOCOLATE' },
  { name: 'Leite Ninho', value: 'LEITE_NINHO' },
  { name: 'Churros', value: 'CHURROS' },
  { name: 'Prestígio', value: 'PRESTIGIO' },
  { name: 'Paçoca', value: 'PACOCA' },
  { name: 'Cappuccino', value: 'CAPPUCINO' },
  { name: 'Limão Siciliano', value: 'LIMAO_SICILIANO' },
];

const RIBBON_WIDTHS: RibbonWidthOption[] = [
  { name: '3mm', value: '3MM' },
  { name: '7mm', value: '7MM' },
  { name: '10mm', value: '10MM' },
];

const RIBBON_COLORS: ColorOption[] = [
  { name: 'Rosa', value: 'ROSA' },
  { name: 'Azul', value: 'AZUL' },
  { name: 'Verde', value: 'VERDE' },
  { name: 'Amarelo', value: 'AMARELO' },
  { name: 'Roxo', value: 'ROXO' },
  { name: 'Vermelho', value: 'VERMELHO' },
  { name: 'Preto', value: 'PRETO' },
  { name: 'Branco', value: 'BRANCO' },
  { name: 'Dourado', value: 'DOURADO' },
  { name: 'Prata', value: 'PRATA' },
];

const FORM_COLORS: ColorOption[] = [
  { name: 'Rosa', value: 'ROSA' },
  { name: 'Azul', value: 'AZUL' },
  { name: 'Verde', value: 'VERDE' },
  { name: 'Amarelo', value: 'AMARELO' },
  { name: 'Roxo', value: 'ROXO' },
  { name: 'Vermelho', value: 'VERMELHO' },
  { name: 'Preto', value: 'PRETO' },
  { name: 'Branco', value: 'BRANCO' },
  { name: 'Dourado', value: 'DOURADO' },
  { name: 'Prata', value: 'PRATA' },
];

const ProductSelector = ({ product, onAddToCart, onClose }: ProductSelectorProps) => {
  const [selectedFlavor, setSelectedFlavor] = useState('');
  const [selectedCoverage, setSelectedCoverage] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedRibbonWidth, setSelectedRibbonWidth] = useState('');
  const [selectedRibbonColor, setSelectedRibbonColor] = useState('');
  const [selectedFormColor, setSelectedFormColor] = useState('');
  const [quantity, setQuantity] = useState(product.minQuantity || 1);
  const [subtotal, setSubtotal] = useState(0);

  /* ---------- cálculo de subtotal ---------- */
  useEffect(() => {
    let currentPrice = product.basePrice;

    if (product.requiresSize && selectedSize) {
      const sizeOption = product.sizeOptions?.find(opt => opt.size === selectedSize);
      if (sizeOption) currentPrice = sizeOption.price;
    }

    setSubtotal(currentPrice * quantity);
  }, [selectedSize, quantity, product]);

  /* ---------- adicionar ao carrinho ---------- */
  const handleAddToCart = () => {
    if (product.minQuantity && quantity < product.minQuantity) {
      alert(`Quantidade mínima é ${product.minQuantity}`);
      return;
    }

    let finalPrice = product.basePrice;

    if (product.requiresSize && selectedSize) {
      const sizeOption = product.sizeOptions?.find(opt => opt.size === selectedSize);
      if (sizeOption) finalPrice = sizeOption.price;
    }

    const cartItem: CartItem = {
      name: product.name,
      description: product.description,
      price: finalPrice,
      image: product.image,
      flavor: selectedFlavor,
      coverage: selectedCoverage,
      size: selectedSize,
      ribbonWidth: selectedRibbonWidth,
      ribbonColor: selectedRibbonColor,
      formColor: selectedFormColor,
      quantity,
    };

    onAddToCart(cartItem);
    onClose();
  };

  const canAddToCart =
    (!product.requiresFlavor || selectedFlavor) &&
    (!product.requiresCoverage || selectedCoverage) &&
    (!product.requiresSize || selectedSize) &&
    (!product.requiresRibbonWidth || selectedRibbonWidth) &&
    (!product.requiresRibbonColor || selectedRibbonColor) &&
    (!product.requiresFormColor || selectedFormColor) &&
    (!product.minQuantity || quantity >= product.minQuantity);

  const formatPrice = (price: number) => `R$ ${price.toFixed(2).replace('.', ',')}`;

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

          {/* Largura da Fita */}
          {product.requiresRibbonWidth && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Largura da fita <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRibbonWidth}
                  onChange={(e) => setSelectedRibbonWidth(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresRibbonWidth && !selectedRibbonWidth ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione a largura da fita</option>
                  {RIBBON_WIDTHS.map((width) => (
                    <option key={width.value} value={width.value} style={{ color: '#111827' }}>
                      {width.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresRibbonWidth && !selectedRibbonWidth && (
                <p className="text-red-500 text-xs mt-1">Largura da fita é obrigatória</p>
              )}
            </div>
          )}

          {/* Cor da Fita */}
          {product.requiresRibbonColor && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Cor da fita <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedRibbonColor}
                  onChange={(e) => setSelectedRibbonColor(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresRibbonColor && !selectedRibbonColor ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione a cor da fita</option>
                  {RIBBON_COLORS.map((color) => (
                    <option key={color.value} value={color.value} style={{ color: '#111827' }}>
                      {color.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresRibbonColor && !selectedRibbonColor && (
                <p className="text-red-500 text-xs mt-1">Cor da fita é obrigatória</p>
              )}
            </div>
          )}

          {/* Cor da Forminha */}
          {product.requiresFormColor && (
            <div className="mb-5">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Cor da forminha <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={selectedFormColor}
                  onChange={(e) => setSelectedFormColor(e.target.value)}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className={`w-full p-3 border rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent appearance-none ${product.requiresFormColor && !selectedFormColor ? 'border-red-300' : 'border-gray-300'}`}
                >
                  <option value="" style={{ color: '#6B7280' }}>Selecione a cor da forminha</option>
                  {FORM_COLORS.map((color) => (
                    <option key={color.value} value={color.value} style={{ color: '#111827' }}>
                      {color.name}
                    </option>
                  ))}
                </select>
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-pink-400 pointer-events-none">
                  <svg width="20" height="20" fill="currentColor" viewBox="0 0 20 20"><path d="M7 7l3 3 3-3"/></svg>
                </span>
              </div>
              {product.requiresFormColor && !selectedFormColor && (
                <p className="text-red-500 text-xs mt-1">Cor da forminha é obrigatória</p>
              )}
            </div>
          )}

          {/* Quantidade */}
          <div className="mb-6">
            <label className="block text-sm font-bold text-pink-600 mb-2">
              Quantidade <span className="text-red-500">*</span>
            </label>
            
            {/* Botões rápidos para produtos com quantidade mínima */}
            {product.minQuantity && product.minQuantity > 1 && (
              <div className="grid grid-cols-3 gap-2 mb-3">
                <button
                  type="button"
                  onClick={() => setQuantity(product.minQuantity || 1)}
                  className={`py-2 px-3 rounded-lg transition-colors text-sm ${
                    quantity === (product.minQuantity || 1) 
                      ? 'bg-pink-600 text-white' 
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                  }`}
                >
                  {product.minQuantity} und
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(product.minQuantity === 100 ? 150 : 50)}
                  className={`py-2 px-3 rounded-lg transition-colors text-sm ${
                    quantity === (product.minQuantity === 100 ? 150 : 50)
                      ? 'bg-pink-600 text-white' 
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                  }`}
                >
                  {product.minQuantity === 100 ? '150 und' : '50 und'}
                </button>
                <button
                  type="button"
                  onClick={() => setQuantity(product.minQuantity === 100 ? 200 : 100)}
                  className={`py-2 px-3 rounded-lg transition-colors text-sm ${
                    quantity === (product.minQuantity === 100 ? 200 : 100)
                      ? 'bg-pink-600 text-white' 
                      : 'bg-pink-100 text-pink-600 hover:bg-pink-200'
                  }`}
                >
                  {product.minQuantity === 100 ? '200 und' : '100 und'}
                </button>
              </div>
            )}
            
            <div className="flex items-center justify-center space-x-4">
              <button
                type="button"
                onClick={() => {
                  const minQty = product.minQuantity || 1;
                  setQuantity(prev => prev > minQty ? prev - 1 : minQty);
                }}
                className="w-12 h-12 flex items-center justify-center text-pink-600 hover:text-pink-700 bg-pink-100 hover:bg-pink-200 rounded-lg transition-colors"
              >
                <FaMinus size={16} />
              </button>
              <div className="relative w-24">
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value);
                    if (!isNaN(value)) {
                      const minQty = product.minQuantity || 1;
                      if (value >= minQty) {
                        setQuantity(value);
                      }
                    }
                  }}
                  min={product.minQuantity || 1}
                  style={{ backgroundColor: 'white', color: '#374151' }}
                  className="w-full p-3 text-center border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent text-lg font-medium"
                />
              </div>
              <button
                type="button"
                onClick={() => setQuantity(prev => prev + 1)}
                className="w-12 h-12 flex items-center justify-center text-pink-600 hover:text-pink-700 bg-pink-100 hover:bg-pink-200 rounded-lg transition-colors"
              >
                <FaPlus size={16} />
              </button>
            </div>
            {product.minQuantity && quantity < product.minQuantity && (
              <p className="text-red-500 text-xs mt-2">Quantidade mínima é {product.minQuantity}</p>
            )}
          </div>

          {/* Subtotal */}
          <div className="mb-8 p-4 bg-pink-50 rounded-xl shadow flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="font-bold text-pink-600">Subtotal:</span>
              <span className="font-bold text-lg text-gray-900">{formatPrice(subtotal)}</span>
            </div>
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
  disabled={!canAddToCart}              
  className={`flex-1 px-4 py-3 rounded-lg flex items-center justify-center gap-2 font-semibold
    ${canAddToCart
      ? 'bg-pink-500 text-white hover:bg-pink-600'
      : 'bg-gray-300 text-gray-500 cursor-not-allowed'}`}
>
  <FaShoppingCart size={16} />
  Adicionar ao carrinho
</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductSelector; 