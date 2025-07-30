export interface CartItem {
  name: string;
  description: string;
  price: number;
  image: string;
  quantity: number;
}

export interface FormData {
  name: string;
  phone: string;
  address: string;
  coupon: string;
}

export interface CheckoutProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onCompleteOrder: (formData: FormData, total: number) => void;
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