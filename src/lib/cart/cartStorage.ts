import type { CartState } from '../../types/cart';

const CART_KEY = 'cart';

export function saveCart(cart: CartState) {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

export function loadCart(): CartState {
  const data = localStorage.getItem(CART_KEY);
  if (!data) return { items: [], total_cents: 0 };
  return JSON.parse(data) as CartState;
}
