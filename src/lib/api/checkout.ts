import { supabase } from '../supabase';
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
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      customer_name: customer.name,
      customer_phone: customer.phone,
      customer_email: customer.email ?? null,
      event_date: customer.event_date ?? null,
      note: customer.note ?? null,
      status: 'pending',
      total_cents: cart.total_cents,
    })
    .select('id')
    .single();

  if (orderError || !order) {
    throw orderError ?? new Error('Falha ao criar pedido');
  }

  if (cart.items.length > 0) {
    const itemsPayload = cart.items.map((item: CartItem) => ({
      order_id: order.id,
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

    const { error: itemsError } = await supabase
      .from('order_items')
      .insert(itemsPayload);

    if (itemsError) throw itemsError;
  }

  return order.id as string;
}
