import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import Checkout from '../components/Checkout';
import ProductSelector from '../components/ProductSelector';
import { FaShoppingCart, FaPlus } from 'react-icons/fa';
import type { CartItem, FormData, ProductOption } from '../types';

const OrderPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);

  // Check for pending order status on component mount
  useEffect(() => {
    const orderStatus = localStorage.getItem('order_status');
    if (orderStatus === 'pending') {
      setShowSuccessMessage(true);
      localStorage.removeItem('order_status');
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, []);

  const updateItemQuantity = (index: number, newQuantity: number) => {
    setCartItems(prevItems => {
      const newItems = [...prevItems];
      newItems[index] = { ...newItems[index], quantity: newQuantity };
      return newItems;
    });
  };

  const productOptions: ProductOption[] = [
    // EMBALAGENS
    {
      name: 'Embalagem com Fita',
      description: 'Embalagem com fita - Tamanho 5x5',
      basePrice: 3.50,
      image: '/images/embalagem-fita.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    {
      name: 'Embalagem Tipo Bem Casado/Bem Vivido',
      description: 'Embalagem tipo bem casado/bem vivido - Tamanho 5x5',
      basePrice: 4.50,
      image: '/images/embalagem-jutaefita.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    {
      name: 'Embalagem com Adesivos',
      description: 'Embalagem com adesivos - Tamanho 5x5',
      basePrice: 3.50,
      image: '/images/embalagem-adesivos.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    {
      name: 'Caixa Milk com Tema',
      description: 'Caixa milk com tema à escolha',
      basePrice: 14.90,
      image: '/images/embalagem-milkcomtema.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    {
      name: 'Palhas Juta e Fita',
      description: 'Palhas juta e fita - Tamanho 5x5',
      basePrice: 4.50,
      image: '/images/embalagem-jutaefita.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    {
      name: 'Palhas de Colher Pote 100ml',
      description: 'Palhas de colher pote 100ml personalizada',
      basePrice: 14.90,
      image: '/images/embalagem-colherpote100ml.jpg',
      category: 'packaging',
      requiresFlavor: true
    },
    
    // DOCES DE FESTAS
    {
      name: 'Docinho de Palha Italiana - Na Forminha',
      description: 'Docinho de palha italiana na forminha - Preço por cento',
      basePrice: 120.00,
      image: '/images/docesdefestas-forminha.jpg',
      category: 'party',
      requiresFlavor: true,
      minQuantity: 50
    },
    {
      name: 'Docinho de Palha Italiana - Embaladas com Fita',
      description: 'Docinho de palha italiana embaladas com fita - Preço por cento',
      basePrice: 160.00,
      image: '/images/docesdefestas-fita.jpg',
      category: 'party',
      requiresFlavor: true,
      minQuantity: 50
    },
    
    // TORTAS
    {
      name: 'Torta Rústica',
      description: 'Torta rústica com cobertura simples',
      basePrice: 69.90,
      image: '/images/tortas-rustica.jpg',
      category: 'cake',
      requiresFlavor: true,
      requiresSize: true,
      sizeOptions: [
        { size: '1Kg', price: 69.90 },
        { size: '2Kg', price: 89.90 }
      ]
    },
    {
      name: 'Torta Personalizada',
      description: 'Torta personalizada com cobertura à escolha',
      basePrice: 79.90,
      image: '/images/tortas-personalizada.jpg',
      category: 'cake',
      requiresFlavor: true,
      requiresCoverage: true,
      requiresSize: true,
      sizeOptions: [
        { size: '1Kg', price: 79.90 },
        { size: '2Kg', price: 99.90 }
      ]
    }
  ];

  const addToCart = (item: CartItem) => {
    setCartItems(prev => {
      const existingItem = prev.find(cartItem => 
        cartItem.name === item.name && 
        cartItem.flavor === item.flavor && 
        cartItem.coverage === item.coverage &&
        cartItem.size === item.size
      );
      
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem === existingItem
            ? { ...cartItem, quantity: cartItem.quantity + item.quantity }
            : cartItem
        );
      }
      return [...prev, item];
    });
  };

  const handleCompleteOrder = (formData: FormData, total: number) => {
    // Format order message for WhatsApp
    const orderItems = cartItems.map(item => {
      let itemText = `${item.name} x${item.quantity}`;
      if (item.flavor) itemText += ` - Sabor: ${item.flavor}`;
      if (item.coverage) itemText += ` - Cobertura: ${item.coverage}`;
      if (item.size) itemText += ` - Tamanho: ${item.size}`;
      itemText += ` - R$ ${(item.price * item.quantity).toFixed(2)}`;
      return itemText;
    }).join('\n');

    // Sem emojis para garantir compatibilidade
    let message = `*NOVO PEDIDO - PALHA ITALIANA*\n\n*Cliente:* ${formData.name}\n*Telefone:* ${formData.phone}\n*Endereço:* ${formData.address}\n\n*ITENS DO PEDIDO:*\n${orderItems}\n\n*TOTAL:* R$ ${total.toFixed(2)}\n`;
    if (formData.coupon) message += `*Cupom aplicado:* ${formData.coupon}\n`;
    message += `*Horário do pedido:* ${new Date().toLocaleString('pt-BR')}`;

    // Set order status and redirect to WhatsApp
    localStorage.setItem('order_status', 'pending');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/5532984669122?text=${encodedMessage}`, '_blank');
    
    // Close checkout and clear cart
    setIsCheckoutOpen(false);
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

  const getProductsByCategory = (category: 'packaging' | 'party' | 'cake') => {
    return productOptions.filter(product => product.category === category);
  };

  const formatPrice = (price: number) => {
    return `R$ ${price.toFixed(2).replace('.', ',')}`;
  };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      {/* Success Message */}
      {showSuccessMessage && (
        <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg">
          Pedido enviado com sucesso! Aguarde nosso contato.
        </div>
      )}

      <main className="pt-20 pb-24">
        <div className="container mx-auto px-4">
          <h1 className="font-bebas text-5xl md:text-6xl text-primary text-center mb-12 mt-4 md:mt-8">
            FAÇA SEU PEDIDO
          </h1>

          {/* Menu Sections */}
          <div className="space-y-16">
            {/* EMBALAGENS */}
            <section className="virtualized-container">
              <h2 className="font-bebas text-3xl text-primary mb-8">EMBALAGENS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 optimize-gpu">
                {getProductsByCategory('packaging').map((product, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                      <div className="flex flex-col space-y-3">
                        <span className="text-primary font-bold text-lg">
                          {formatPrice(product.basePrice)}
                        </span>
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="w-full bg-primary text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex items-center justify-center space-x-2"
                        >
                          <FaPlus size={14} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* DOCES DE FESTAS */}
            <section>
              <h2 className="font-bebas text-3xl text-primary mb-8">DOCES DE FESTAS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getProductsByCategory('party').map((product, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-bold text-lg">
                          {formatPrice(product.basePrice)} o cento
                        </span>
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex items-center space-x-2"
                        >
                          <FaPlus size={14} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* TORTAS */}
            <section>
              <h2 className="font-bebas text-3xl text-primary mb-8">TORTAS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {getProductsByCategory('cake').map((product, index) => (
                  <div key={index} className="bg-white rounded-lg shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                    <div className="h-48 bg-gray-200 flex items-center justify-center">
                      <img 
                        src={product.image} 
                        alt={product.name}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="p-6">
                      <h3 className="font-bold text-lg text-gray-900 mb-2">{product.name}</h3>
                      <p className="text-gray-600 text-sm mb-4">{product.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-primary font-bold text-lg">
                          A partir de {formatPrice(product.basePrice)}
                        </span>
                        <button
                          onClick={() => setSelectedProduct(product)}
                          className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-pink-600 transition-colors flex items-center space-x-2"
                        >
                          <FaPlus size={14} />
                          <span>Adicionar</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </main>

      {/* Cart Summary */}
      {cartItems.length > 0 && (
        <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 p-4">
          <div className="container mx-auto flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <FaShoppingCart className="text-primary" size={24} />
              <div>
                <p className="text-white font-serif">
                  {cartItems.length} item(s) no carrinho
                </p>
                <p className="text-primary font-bold">
                  Total: R$ {cartTotal.toFixed(2)}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsCheckoutOpen(true)}
              className="bg-primary text-white px-6 py-3 rounded-lg font-bold hover:bg-pink-600 transition-colors"
            >
              Finalizar Pedido
            </button>
          </div>
        </div>
      )}

      {/* Product Selector Modal */}
      {selectedProduct && (
        <ProductSelector
          product={selectedProduct}
          onAddToCart={addToCart}
          onClose={() => setSelectedProduct(null)}
        />
      )}

      {/* Checkout Modal */}
      <Checkout
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onCompleteOrder={handleCompleteOrder}
        removeCartItem={(index) => setCartItems(prev => prev.filter((_, i) => i !== index))}
        updateItemQuantity={updateItemQuantity}
        clearCart={() => setCartItems([])}
      />

      <Footer />
    </div>
  );
};

export default OrderPage;