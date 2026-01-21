export interface CartItem {
  id: string;
  product_id: string;
  product_name: string;
  option_id?: string;
  option_name?: string;
  quantity: number;
  unit_price_cents: number;
  subtotal_cents: number;
  details?: { field_key: string; label: string; value: string; display_value?: string }[];
  flavor?: string;
  coverage?: string;
  size?: string;
  ribbon_width?: string;
  ribbon_color?: string;
  form_color?: string;
  notes?: string;
}

export interface CartState {
  items: CartItem[];
  total_cents: number;
}
