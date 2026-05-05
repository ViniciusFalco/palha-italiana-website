import { supabase } from './supabase';

export type CatalogRow = {
  product_id?: string;
  sku: string;
  name: string;
  description: string | null;
  image_url: string | null;
  category?: string | null;
  category_id?: string | null;
  category_slug?: string | null;
  category_name?: string | null;
  min_quantity: number | null;
  requires_flavor: boolean;
  requires_coverage: boolean;
  requires_size: boolean;
  requires_ribbon_width: boolean;
  requires_ribbon_color: boolean;
  requires_form_color: boolean;
  option_key: string | null;
  option_name: string | null;
  effective_price_cents: number;
  base_price_cents: number | null;
  sale_price_cents: number | null;
  is_on_sale: boolean;
};

export type UIProduct = {
  id?: string;
  sku: string;
  name: string;
  description?: string;
  image: string;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  basePrice: number; // em centavos
  salePrice?: number; // em centavos
  minQuantity?: number;
  requiresFlavor?: boolean;
  requiresCoverage?: boolean;
  requiresSize?: boolean;
  requiresRibbonWidth?: boolean;
  requiresRibbonColor?: boolean;
  requiresFormColor?: boolean;
  sizeOptions?: Array<{ id?: string; size: string; price: number; optionKey: string }>;
};

export async function fetchCatalog(): Promise<UIProduct[]> {
  const baseSelect = [
    'sku',
    'name',
    'description',
    'image_url',
    'category',
    'min_quantity',
    'requires_flavor',
    'requires_coverage',
    'requires_size',
    'requires_ribbon_width',
    'requires_ribbon_color',
    'requires_form_color',
    'option_key',
    'option_name',
    'effective_price_cents',
    'base_price_cents',
    'sale_price_cents',
    'is_on_sale',
    'product_id',
  ].join(', ');

  const extendedSelect = [
    'sku',
    'name',
    'description',
    'image_url',
    'category',
    'category_id',
    'category_slug',
    'category_name',
    'min_quantity',
    'requires_flavor',
    'requires_coverage',
    'requires_size',
    'requires_ribbon_width',
    'requires_ribbon_color',
    'requires_form_color',
    'option_key',
    'option_name',
    'effective_price_cents',
    'base_price_cents',
    'sale_price_cents',
    'is_on_sale',
    'product_id',
  ].join(', ');

  let data: unknown;
  let error: any;

  const viewName = 'catalog_effective_prices_with_category_v';
  const fallbackViewName = 'catalog_effective_prices_v';

  ({ data, error } = await supabase.from(viewName).select(extendedSelect));
  if (error) {
    const message = String(error?.message ?? '');
    const shouldFallback =
      message.includes('category_id') ||
      message.includes('category_slug') ||
      message.includes('category_name') ||
      message.includes(viewName);
    if (shouldFallback) {
      const fallback = await supabase.from(fallbackViewName).select(baseSelect);
      data = fallback.data;
      error = fallback.error;
    }
  }

  if (error) throw error;
  if (!Array.isArray(data) || data.length === 0) return [];

  const rows = Array.isArray(data) ? ((data as unknown) as CatalogRow[]) : [];

  const skuSet = new Set(rows.map((row) => row.sku).filter(Boolean));
  let idsBySku = new Map<string, string>();
  if (skuSet.size > 0) {
    try {
      const { data: productIds } = await supabase
        .from('products')
        .select('id, sku')
        .in('sku', Array.from(skuSet));

      idsBySku = new Map(
        (productIds ?? [])
          .filter((p): p is { id: string; sku: string } => Boolean(p?.id) && Boolean(p?.sku))
          .map((p) => [p.sku, p.id])
      );
    } catch (err) {
      // fallback silencioso para evitar quebrar a tela caso a consulta falhe
      console.warn('Falha ao mapear IDs dos produtos do catalogo.', err);
    }
  }

  const bySku = new Map<string, CatalogRow[]>();
  rows.forEach((row) => {
    const arr = bySku.get(row.sku) ?? [];
    arr.push(row);
    bySku.set(row.sku, arr);
  });

  const products: UIProduct[] = [];
  for (const [sku, group] of bySku.entries()) {
    const meta = group[0];
    const hasOptions = group.some((g) => g.option_key);
    const productId = meta.product_id ?? idsBySku.get(sku);

    if (hasOptions) {
      const sizeOptions = group
        .filter((g) => g.option_key && g.option_name)
        .map((g) => ({
          size: g.option_name as string,
          price: g.effective_price_cents / 100,
          optionKey: g.option_key as string,
        }));

      const minEffectiveCents = Math.min(
        ...group
          .filter((g) => g.option_key)
          .map((g) => g.effective_price_cents)
      );

      products.push({
        id: productId,
        sku,
        name: meta.name,
        description: meta.description ?? undefined,
        image: meta.image_url ?? '',
        categoryId: meta.category_id ?? null,
        categorySlug: meta.category_slug ?? meta.category ?? null,
        categoryName: meta.category_name ?? undefined,
        basePrice: minEffectiveCents / 100,
        minQuantity: meta.min_quantity ?? undefined,
        requiresFlavor: meta.requires_flavor,
        requiresCoverage: meta.requires_coverage,
        requiresSize: meta.requires_size,
        requiresRibbonWidth: meta.requires_ribbon_width,
        requiresRibbonColor: meta.requires_ribbon_color,
        requiresFormColor: meta.requires_form_color,
        sizeOptions,
      });
    } else {
      const effective = group[0].effective_price_cents;
      const salePriceCents = group[0].sale_price_cents ?? undefined;

      products.push({
        id: productId,
        sku,
        name: meta.name,
        description: meta.description ?? undefined,
        image: meta.image_url ?? '',
        categoryId: meta.category_id ?? null,
        categorySlug: meta.category_slug ?? meta.category ?? null,
        categoryName: meta.category_name ?? undefined,
        basePrice: effective / 100,
        salePrice: salePriceCents ? salePriceCents / 100 : undefined,
        minQuantity: meta.min_quantity ?? undefined,
        requiresFlavor: meta.requires_flavor,
        requiresCoverage: meta.requires_coverage,
        requiresSize: meta.requires_size,
        requiresRibbonWidth: meta.requires_ribbon_width,
        requiresRibbonColor: meta.requires_ribbon_color,
        requiresFormColor: meta.requires_form_color,
      });
    }
  }

  return products;
}
