import { useEffect, useRef, useState } from 'react';
import type { CartItem, CartState } from '../../types/cart';
import { resolveUnitPriceCents } from '../api/pricing';
import { loadCart, saveCart } from './cartStorage';

function calculateTotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + item.subtotal_cents, 0);
}

function buildCartItemId(item: Omit<CartItem, 'id' | 'subtotal_cents'>) {
  const detailsKey = (item.details ?? [])
    .map((detail) => `${detail.field_key}:${detail.value}`)
    .sort()
    .join('|');
  return `${item.product_id}-${item.option_id || ''}-${detailsKey}-${item.flavor || ''}-${item.size || ''}-${item.coverage || ''}-${item.ribbon_width || ''}-${item.ribbon_color || ''}-${item.form_color || ''}-${item.notes || ''}`;
}

export function useCart() {
  const [cart, setCart] = useState<CartState>(() => loadCart());
  const quantityTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    saveCart(cart);
  }, [cart]);

  useEffect(() => {
    return () => {
      Object.values(quantityTimersRef.current).forEach((t) => window.clearTimeout(t));
      quantityTimersRef.current = {};
    };
  }, []);

  function addItem(item: Omit<CartItem, 'id' | 'subtotal_cents'>) {
    setCart((prev) => {
      const id = buildCartItemId(item);
      const existingIndex = prev.items.findIndex((i) => i.id === id);
      let nextItems: CartItem[];

      if (existingIndex !== -1) {
        nextItems = prev.items.map((existing, idx) =>
          idx === existingIndex
            ? {
                ...existing,
                quantity: existing.quantity + item.quantity,
                subtotal_cents: existing.unit_price_cents * (existing.quantity + item.quantity),
              }
            : existing
        );
      } else {
        const newItem: CartItem = {
          ...item,
          id,
          subtotal_cents: item.unit_price_cents * item.quantity,
        };
        nextItems = [...prev.items, newItem];
      }

      return {
        items: nextItems,
        total_cents: calculateTotal(nextItems),
      };
    });
  }

  async function updateQuantity(id: string, quantity: number) {
    let resolvedPrice: number | null = null;

    const currentItem = cart.items.find((item) => item.id === id);
    if (currentItem?.product_id) {
      try {
        resolvedPrice = await resolveUnitPriceCents(currentItem.product_id, quantity);
      } catch (err) {
        console.error('updateQuantity resolve price failed', err);
        resolvedPrice = null;
      }
    }

    setCart((prev) => {
      const prevItem = prev.items.find((item) => item.id === id);
      if (!prevItem) return prev;

      const unitPrice = resolvedPrice ?? prevItem.unit_price_cents;
      const nextItems = prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity,
              unit_price_cents: unitPrice,
              subtotal_cents: unitPrice * quantity,
            }
          : item
      );

      return {
        items: nextItems,
        total_cents: calculateTotal(nextItems),
      };
    });
  }

  async function updateItemQuantityWithPricing(id: string, quantity: number) {
    const current = cart.items.find((item) => item.id === id);
    if (!current) return;

    let resolvedPrice: number | null = null;
    if (current.product_id) {
      try {
        resolvedPrice = await resolveUnitPriceCents(current.product_id, quantity);
      } catch (err) {
        console.error('updateItemQuantityWithPricing resolve price failed', err);
        resolvedPrice = null;
      }
    }

    setCart((prev) => {
      const prevItem = prev.items.find((item) => item.id === id);
      if (!prevItem) return prev;

      const unitPrice = resolvedPrice ?? prevItem.unit_price_cents;
      const nextItems = prev.items.map((item) =>
        item.id === id
          ? {
              ...item,
              quantity,
              unit_price_cents: unitPrice,
              subtotal_cents: unitPrice * quantity,
            }
          : item
      );

      return {
        items: nextItems,
        total_cents: calculateTotal(nextItems),
      };
    });
  }

  function updateQuantityDebounced(id: string, quantity: number, delayMs = 300) {
    const timers = quantityTimersRef.current;
    if (timers[id]) {
      window.clearTimeout(timers[id]);
    }
    timers[id] = window.setTimeout(() => {
      updateQuantity(id, quantity);
      delete timers[id];
    }, delayMs);
  }

  function removeItem(id: string) {
    setCart((prev) => {
      const nextItems = prev.items.filter((item) => item.id !== id);
      return {
        items: nextItems,
        total_cents: calculateTotal(nextItems),
      };
    });
  }

  function clearCart() {
    setCart({ items: [], total_cents: 0 });
  }

  return {
    cart,
    addItem,
    updateQuantity,
    updateItemQuantityWithPricing,
    updateQuantityDebounced,
    removeItem,
    clearCart,
  };
}
