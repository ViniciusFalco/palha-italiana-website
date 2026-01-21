import type { Option } from '../../types/option';
import type { Product } from '../../types/product';
import type { ProductDetailField, ProductDetailOption } from '../../types/productDetail';
import type { AuthRetryFn } from '../auth/AuthProvider';
import { supabase } from '../supabase';

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('is_active', true);

  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function fetchProductOptions(productId: string): Promise<Option[]> {
  const { data, error } = await supabase
    .from('product_options')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true);

  if (error) throw error;
  return (data ?? []) as Option[];
}

export async function fetchProductQuantityPrices(
  productId: string,
  options?: { withAuthRetry?: AuthRetryFn }
) {
  const query = () =>
    supabase
      .from('product_quantity_prices')
      .select('id, product_id, min_quantity, max_quantity, unit_price_cents, currency')
      .eq('product_id', productId)
      .order('min_quantity', { ascending: true });

  const { data, error } = options?.withAuthRetry
    ? await options.withAuthRetry(query, { label: 'fetch-product-quantity-prices' })
    : await query();

  if (error) throw error;
  return data ?? [];
}

export async function fetchProductDetailFields(
  productId: string,
  options?: { onlyActive?: boolean; withOptions?: boolean }
): Promise<ProductDetailField[]> {
  const onlyActive = options?.onlyActive ?? false;
  const withOptions = options?.withOptions ?? true;

  let fieldsQuery = supabase
    .from('product_detail_fields')
    .select(
      'id, product_id, field_key, label, input_type, help_text, is_required, sort_order, is_active'
    )
    .eq('product_id', productId)
    .order('sort_order', { ascending: true });

  if (onlyActive) {
    fieldsQuery = fieldsQuery.eq('is_active', true);
  }

  const { data: fieldsData, error: fieldsError } = await fieldsQuery;
  if (fieldsError) throw fieldsError;

  const fields = (fieldsData ?? []) as ProductDetailField[];
  if (!withOptions || fields.length === 0) return fields;

  const fieldIds = fields.map((field) => field.id).filter(Boolean) as string[];
  if (fieldIds.length === 0) return fields.map((field) => ({ ...field, options: [] }));

  const { data: optionsData, error: optionsError } = await supabase
    .from('product_detail_options')
    .select('id, field_id, label, value, extra_price_delta_cents, sort_order')
    .in('field_id', fieldIds)
    .order('sort_order', { ascending: true });

  if (optionsError) throw optionsError;

  const detailOptions = (optionsData ?? []) as ProductDetailOption[];

  return fields.map((field) => ({
    ...field,
    options: detailOptions
      .filter((opt) => opt.field_id === field.id)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  }));
}
