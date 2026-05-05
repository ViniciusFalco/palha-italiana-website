export type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean | null;
};

export interface Product {
  id: string;
  sku: string;
  name: string;
  description?: string;
  image_url?: string;
  category_id?: string | null;
  category?: Category | null;
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
