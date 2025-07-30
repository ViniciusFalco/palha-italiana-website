import { useState, useEffect } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import MenuItem from '../components/MenuItem';
import Checkout from '../components/Checkout';
import { FaShoppingCart } from 'react-icons/fa';
import type { CartItem, FormData } from '../types';

const OrderPage = () => {
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  // Check for pending order status on component mount
  useEffect(() => {
    const orderStatus = localStorage.getItem('order_status');
    if (orderStatus === 'pending') {
      setShowSuccessMessage(true);
      localStorage.removeItem('order_status');
      setTimeout(() => setShowSuccessMessage(false), 5000);
    }
  }, []);

  const menuItems: Record<string, Omit<CartItem, 'quantity'>[]> = {
    festas: [
      {
        name: 'Kit Festa 50 Unidades',
        description: '50 palhas italianas em embalagem especial para festas',
        price: 120.00,
        image: '/images/kit-festa-50.jpg'
      },
      {
        name: 'Kit Festa 100 Unidades',
        description: '100 palhas italianas em embalagem especial para festas',
        price: 220.00,
        image: '/images/kit-festa-100.jpg'
      }
    ],
    palhas: [
      {
        name: 'Palha Italiana Individual',
        description: 'Palha italiana artesanal, sabor à escolha',
        price: 3.50,
        image: '/images/palha-individual.jpg'
      },
      {
        name: 'Caixa 6 Palhas Italianas',
        description: '6 palhas italianas em caixa decorativa',
        price: 18.00,
        image: '/images/caixa-6-palhas.jpg'
      },
      {
        name: 'Caixa 12 Palhas Italianas',
        description: '12 palhas italianas em caixa decorativa',
        price: 32.00,
        image: '/images/caixa-12-palhas.jpg'
      }
    ],
    tortas: [
      {
        name: 'Torta Rústica 1kg',
        description: 'Torta rústica de palha italiana, 1kg',
        price: 45.00,
        image: '/images/torta-rustica-1kg.jpg'
      },
      {
        name: 'Torta Rústica 2kg',
        description: 'Torta rústica de palha italiana, 2kg',
        price: 85.00,
        image: '/images/torta-rustica-2kg.jpg'
      },
      {
        name: 'Torta Personalizada 1kg',
        description: 'Torta personalizada com cobertura à escolha, 1kg',
        price: 55.00,
        image: '/images/torta-personalizada-1kg.jpg'
      },
      {
        name: 'Torta Personalizada 2kg',
        description: 'Torta personalizada com cobertura à escolha, 2kg',
        price: 105.00,
        image: '/images/torta-personalizada-2kg.jpg'
      }
    ]
  };

  const addToCart = (item: Omit<CartItem, 'quantity'>) => {
    setCartItems(prev => {
      const existingItem = prev.find(cartItem => cartItem.name === item.name);
      if (existingItem) {
        return prev.map(cartItem =>
          cartItem.name === item.name
            ? { ...cartItem, quantity: cartItem.quantity + 1 }
            : cartItem
        );
      }
      return [...prev, { ...item, quantity: 1 }];
    });
  };



  const handleCompleteOrder = (formData: FormData, total: number) => {
    // Format order message for WhatsApp
    const orderItems = cartItems.map(item => 
      `${item.name} x${item.quantity} - R$ ${(item.price * item.quantity).toFixed(2)}`
    ).join('\n');

    const message = `🍰 *NOVO PEDIDO - PALHA ITALIANA* 🍰

👤 *Cliente:* ${formData.name}
📱 *Telefone:* ${formData.phone}
📍 *Endereço:* ${formData.address}

🛒 *ITENS DO PEDIDO:*
${orderItems}

💰 *TOTAL:* R$ ${total.toFixed(2)}

${formData.coupon ? `🎫 *Cupom aplicado:* ${formData.coupon}` : ''}

⏰ *Horário do pedido:* ${new Date().toLocaleString('pt-BR')}`;

    // Set order status and redirect to WhatsApp
    localStorage.setItem('order_status', 'pending');
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/5532984669122?text=${encodedMessage}`, '_blank');
    
    // Close checkout and clear cart
    setIsCheckoutOpen(false);
    setCartItems([]);
  };

  const cartTotal = cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);

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
          <h1 className="font-bebas text-5xl md:text-6xl text-white text-center mb-12">
            FAÇA SEU PEDIDO
          </h1>

          {/* Menu Sections */}
          <div className="space-y-16">
            {/* FESTAS */}
            <section>
              <h2 className="font-bebas text-3xl text-primary mb-8">FESTAS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {menuItems.festas.map((item, index) => (
                  <MenuItem key={index} item={item} onAddToCart={addToCart} />
                ))}
              </div>
            </section>

            {/* DOCINHO DE PALHA ITALIANA */}
            <section>
              <h2 className="font-bebas text-3xl text-primary mb-8">DOCINHO DE PALHA ITALIANA</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {menuItems.palhas.map((item, index) => (
                  <MenuItem key={index} item={item} onAddToCart={addToCart} />
                ))}
              </div>
            </section>

            {/* TORTAS */}
            <section>
              <h2 className="font-bebas text-3xl text-primary mb-8">TORTAS</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {menuItems.tortas.map((item, index) => (
                  <MenuItem key={index} item={item} onAddToCart={addToCart} />
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

      {/* Checkout Modal */}
      <Checkout
        isOpen={isCheckoutOpen}
        onClose={() => setIsCheckoutOpen(false)}
        cartItems={cartItems}
        onCompleteOrder={handleCompleteOrder}
      />

      <Footer />
    </div>
  );
};

export default OrderPage; 