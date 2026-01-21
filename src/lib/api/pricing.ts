import { supabase } from '../supabase';

export async function resolveUnitPriceCents(productId: string, quantity: number): Promise<number | null> {
  try {
    const { data, error } = await supabase.rpc('resolve_unit_price_cents', {
      p_product_id: productId,
      p_quantity: quantity,
    });

    if (error) {
      console.error('resolveUnitPriceCents rpc error', { error, productId, quantity });
      throw error;
    }

    const rpcValue = data as number | null;
    return typeof rpcValue === 'number' && Number.isFinite(rpcValue) ? rpcValue : null;
  } catch (err) {
    console.error('resolveUnitPriceCents failed', err);
    throw err;
  }
}
