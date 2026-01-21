import { useEffect } from 'react';
import { checkout } from '../lib/api/checkout';
import { useCart } from '../lib/cart/useCart';

// Componente de teste (não montado no app). Use para validar o fluxo de checkout no console.
export default function TestCheckout() {
  const { cart } = useCart();

  useEffect(() => {
    checkout({ name: 'Cliente Teste', phone: '999999' }, cart)
      .then((orderId) => {
        console.log('Order created:', orderId);
      })
      .catch(console.error);
  }, [cart]);

  return null;
}
