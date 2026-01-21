export type ProductDetailInputType = 'text' | 'textarea' | 'select';

export interface ProductDetailOption {
  id?: string;
  field_id?: string;
  label: string;
  value: string;
  extra_price_delta_cents: number;
  sort_order: number;
}

export interface ProductDetailField {
  id?: string;
  product_id?: string;
  field_key: string;
  label: string;
  input_type: ProductDetailInputType;
  help_text: string | null;
  is_required: boolean;
  sort_order: number;
  is_active: boolean;
  options?: ProductDetailOption[];
}

export interface ProductDetailSelection {
  fieldId: string;
  fieldKey: string;
  label: string;
  value: string;
  displayValue: string;
  extraPriceDeltaCents: number;
  inputType: ProductDetailInputType;
}
