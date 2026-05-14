import type { ProductDetailSelection } from './productDetail';

export interface CartItem {
  name: string;
  description: string;
  price: number;
  image: string;
  quantity: number;
  product_id?: string;
  unit_price_cents?: number;
  details?: ProductDetailSelection[];
  flavor?: string;
  coverage?: string;
  packaging?: string;
  size?: string;
  ribbonWidth?: string;
  ribbonColor?: string;
  formColor?: string;
  address?: string;
  notes?: string;
}

export interface FormData {
  name: string;
  phone: string;
  deliveryDate: string;
  street: string;
  houseNumber: string;
  addressComplement?: string;
  noComplement: boolean;
  paymentMethod: 'pix' | 'credit' | 'debit' | 'cash';
  cashChangeNeeded: boolean;
  cashChangeForCents?: number | null;
  address?: string;
  cep?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  addressLatitude?: number | null;
  addressLongitude?: number | null;
  addressSource?: 'mapbox' | 'viacep' | 'map' | 'manual' | '';
}

export interface CheckoutPricingPayload {
  subtotal_cents: number;
  shipping_cents: number;
  discount_cents: number;
  total_cents: number;
  coupon_id?: string | null;
  coupon_code?: string | null;
}

export interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onCompleteOrder: (formData: FormData, pricing: CheckoutPricingPayload) => Promise<void>;
  removeCartItem?: (index: number) => void;
  clearCart?: () => void;
  updateItemQuantity?: (index: number, quantity: number) => void;
  updateItemQuantityWithPricing?: (id: string, quantity: number) => void;
  onEditCartItem?: (index: number) => void;
  preserveStateOnClose?: boolean;
}

export interface MenuItemProps {
  item: Omit<CartItem, 'quantity'>;
  onAddToCart: (item: Omit<CartItem, 'quantity'>) => void;
}

export interface FlavorCardProps {
  image: string;
  name: string;
  isFavorite?: boolean;
}

export interface SlideProps {
  title: string;
  subtitle: string;
  text: string;
  backgroundImage: string;
}

export interface ProductOption {
  id?: string;
  name: string;
  description: string;
  basePrice: number;
  image: string;
  categoryId?: string | null;
  categorySlug?: string | null;
  categoryName?: string | null;
  sku?: string;
  requiresFlavor?: boolean;
  requiresCoverage?: boolean;
  requiresSize?: boolean;
  requiresRibbonWidth?: boolean;
  requiresRibbonColor?: boolean;
  requiresFormColor?: boolean;
  sizeOptions?: { size: string; price: number; id?: string }[];
  minQuantity?: number;
  quickQuantities?: number[];
  priceTiers?: { minQuantity: number; maxQuantity?: number | null; price: number }[];
}

export interface FlavorOption {
  name: string;
  value: string;
}

export interface CoverageOption {
  name: string;
  value: string;
}

export interface RibbonWidthOption {
  name: string;
  value: string;
}

export interface ColorOption {
  name: string;
  value: string;
} 
