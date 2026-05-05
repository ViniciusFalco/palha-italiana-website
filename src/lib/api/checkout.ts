import { createPublicUuid, insertPublicRows } from '../supabasePublic';
import type { CartItem, CartState } from '../../types/cart';

export async function checkout(
  customer: {
    name: string;
    phone: string;
    email?: string;
    event_date?: string;
    note?: string;
  },
  cart: CartState
): Promise<string> {
  const orderId = createPublicUuid();
  const { error: orderError } = await insertPublicRows<null>(
    'orders',
    {
      id: orderId,
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email ?? null,
      event_date: customer.event_date ?? null,
      note: customer.note ?? null,
      status: 'pending',
      total_cents: cart.total_cents,
    }
  );

  if (orderError) {
    throw orderError;
  }

  if (cart.items.length > 0) {
    const itemsPayload = cart.items.map((item: CartItem) => ({
      id: createPublicUuid(),
      order_id: orderId,
      product_id: item.product_id,
      product_option_id: item.option_id ?? null,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      subtotal_cents: item.subtotal_cents,
      flavor: item.flavor ?? null,
      coverage: item.coverage ?? null,
      size: item.size ?? null,
      ribbon_width: item.ribbon_width ?? null,
      ribbon_color: item.ribbon_color ?? null,
      form_color: item.form_color ?? null,
    }));

    const { error: itemsError } = await insertPublicRows<null>('order_items', itemsPayload);

    if (itemsError) throw itemsError;
  }

  return orderId;
}
