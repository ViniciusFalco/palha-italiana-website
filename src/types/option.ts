export interface Option {
  id: string;
  product_id: string;
  option_key: string;
  option_name: string;
  base_price_cents: number;
  sale_price_cents?: number;
  price_cents?: number;
  is_active: boolean;
}
