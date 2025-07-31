export interface CartItem {
  name: string;
  description: string;
  price: number;
  image: string;
  quantity: number;
  flavor?: string;
  coverage?: string;
  packaging?: string;
  size?: string;
  address?: string;
}

export interface FormData {
  name: string;
  phone: string;
  address: string;
  addressComplement?: string;
  coupon: string;
}

export interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onCompleteOrder: (formData: FormData, total: number) => void;
  removeCartItem?: (index: number) => void;
  clearCart?: () => void;
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
  name: string;
  description: string;
  basePrice: number;
  image: string;
  category: 'packaging' | 'party' | 'cake';
  requiresFlavor?: boolean;
  requiresCoverage?: boolean;
  requiresSize?: boolean;
  sizeOptions?: { size: string; price: number }[];
  quantityOptions?: number[];
  allowCustomQuantity?: boolean;
  minQuantity?: number;
}

export interface FlavorOption {
  name: string;
  value: string;
}

export interface CoverageOption {
  name: string;
  value: string;
} 