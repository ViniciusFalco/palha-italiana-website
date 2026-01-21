export type ProductCategory = 'packaging' | 'party' | 'cake';

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  image_url?: string;
  category: ProductCategory;
  base_price_cents: number;
  sale_price_cents?: number;
  min_quantity?: number;
  is_active: boolean;
}

export interface ProductTag {
  id?: string;
  product_id?: string;
  tag: string;
}
