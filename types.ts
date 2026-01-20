
export type Category = 'Electronics' | 'Gaming' | 'Workstation' | 'Audio' | 'Accessories';

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: Category;
  image: string;
  rating: number;
  specs: string[];
  seller_id: string;
  seller_name: string;
}

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  date: string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  seller_id: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
}

export interface Order {
  id: string;
  user_id: string;
  date: string;
  total: number;
  shipping_address: string;
  payment_method: string;
  status: 'Pending' | 'Shipped' | 'Delivered' | 'Cancelled';
  items: OrderItem[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
  isVerified: boolean;
  role: 'buyer' | 'seller' | 'admin';
  address?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
}

export type AppView = 'home' | 'search' | 'cart' | 'product-detail' | 'checkout' | 'checkout-success' | 'seller-dashboard' | 'compare' | 'profile' | 'orders' | 'login' | 'register' | 'verify-email';

export interface MarketplaceState {
  view: AppView;
  selectedProductId: string | null;
  searchQuery: string;
  activeFilters: {
    category: Category | null;
    minPrice: number | null;
    maxPrice: number | null;
  };
  cart: CartItem[];
  user: User | null;
  compareList: string[];
}
