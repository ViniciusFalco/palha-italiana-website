import { useState } from 'react';
import { FaTimes } from 'react-icons/fa';
import type { CheckoutProps, FormData, CartItem } from '../types';

const Checkout = ({ isOpen, onClose, cartItems, onCompleteOrder, removeCartItem, clearCart, updateItemQuantity }: CheckoutProps) => {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    phone: '',
    address: '',
    addressComplement: '',
    coupon: ''
  });
  const [discount, setDiscount] = useState(0);
  const [discountApplied, setDiscountApplied] = useState(false);

  const subtotal = cartItems.reduce((total: number, item: CartItem) => total + (item.price * item.quantity), 0);
  const shipping = 5.00;
  const total = subtotal - discount + shipping;

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const coupon = e.target.value.toUpperCase();
    setFormData(prev => ({ ...prev, coupon }));
    
    if (coupon === 'PRIMEIRACOMPRA' && !discountApplied) {
      setDiscount(subtotal * 0.05);
      setDiscountApplied(true);
    } else if (coupon !== 'PRIMEIRACOMPRA' && discountApplied) {
      setDiscount(0);
      setDiscountApplied(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCompleteOrder(formData, total);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="font-bebas text-2xl text-white">Finalizar Pedido</h2>
            <button
              onClick={onClose}
              className="text-white hover:text-primary transition-colors"
            >
              <FaTimes size={24} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white font-serif mb-2">Nome:</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white font-serif mb-2">Telefone:</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                required
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white font-serif mb-2">Endereço:</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                rows={2}
                placeholder="Digite seu endereço completo..."
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
              <input
                type="text"
                name="addressComplement"
                value={formData.addressComplement || ''}
                onChange={handleInputChange}
                placeholder="Complemento: número, apto, bloco..."
                className="mt-2 w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-white font-serif mb-2">Cupom (opcional):</label>
              <input
                type="text"
                name="coupon"
                value={formData.coupon}
                onChange={handleCouponChange}
                placeholder="PRIMEIRACOMPRA"
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Endereço de Entrega - Mapa */}
            <div className="mb-6">
              <label className="block text-sm font-bold text-pink-600 mb-2">
                Endereço de entrega
              </label>
              <input
                type="text"
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                required
                placeholder="Digite o endereço de entrega..."
                className="w-full p-3 rounded-lg bg-gray-800 text-white border border-gray-600 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Order Summary */}
            <div className="border-t border-gray-600 pt-4 mt-6">
              <h3 className="font-bebas text-lg text-white mb-3">Resumo do Pedido</h3>
              
              {cartItems.map((item: CartItem, index: number) => (
                <div key={index} className="flex justify-between items-center text-white text-sm mb-2">
                  <span className="flex-1">{item.name}</span>
                  <div className="flex items-center space-x-3 mx-4">
                    <button
                      type="button"
                      className="text-primary hover:text-pink-600 w-6 h-6 flex items-center justify-center"
                      onClick={() => {
                        if (item.quantity > 1 && updateItemQuantity) {
                          updateItemQuantity(index, item.quantity - 1);
                        }
                      }}
                    >
                      −
                    </button>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      className="text-primary hover:text-pink-600 w-6 h-6 flex items-center justify-center"
                      onClick={() => {
                        if (updateItemQuantity) {
                          updateItemQuantity(index, item.quantity + 1);
                        }
                      }}
                    >
                      +
                    </button>
                  </div>
                  <span className="w-24 text-right">R$ {(item.price * item.quantity).toFixed(2)}</span>
                  {typeof removeCartItem === 'function' && (
                    <button
                      type="button"
                      className="ml-2 text-red-400 hover:text-red-600"
                      title="Remover item"
                      onClick={() => {
                        if (window.confirm('Remover este item do carrinho?')) {
                          removeCartItem(index);
                        }
                      }}
                    >
                      <FaTimes size={14} />
                    </button>
                  )}
                </div>
              ))}
              {cartItems.length > 0 && typeof clearCart === 'function' && (
                <button
                  type="button"
                  className="mt-2 w-full text-sm text-red-400 hover:text-red-600 underline"
                  onClick={() => {
                    if (window.confirm('Limpar todo o carrinho?')) {
                      clearCart();
                    }
                  }}
                >
                  Limpar carrinho
                </button>
              )}

              <div className="border-t border-gray-600 pt-2 mt-3">
                <div className="flex justify-between text-white">
                  <span>Subtotal:</span>
                  <span>R$ {subtotal.toFixed(2)}</span>
                </div>
                
                {discount > 0 && (
                  <>
                    <div className="flex justify-between text-gray-400 line-through">
                      <span>Subtotal original:</span>
                      <span>R$ {subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-400">
                      <span>Desconto (5%):</span>
                      <span>-R$ {discount.toFixed(2)}</span>
                    </div>
                  </>
                )}
                
                <div className="flex justify-between text-white">
                  <span>Taxa de entrega:</span>
                  <span>R$ {shipping.toFixed(2)}</span>
                </div>
                
                <div className="flex justify-between text-primary font-bold text-lg mt-2">
                  <span>Total:</span>
                  <span>R$ {total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-pink-600 transition-colors"
            >
              Concluir Pedido
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Checkout;