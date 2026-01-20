
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
  product: Product; // Use the full product object for persistence
  price: number;
  quantity: number;
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
  password?: string; // Needed for local persistence login
  // Fix: Added password_hash and verificationToken to resolve type errors in services/api.ts
  password_hash?: string;
  verificationToken?: string;
  isLoggedIn: boolean;
  isVerified: boolean;
  role: 'buyer' | 'seller' | 'admin';
  address?: string;
  cardNumber?: string;
  cardExpiry?: string;
  cardCvv?: string;
}

export type AppView = 'home' | 'search' | 'cart' | 'product-detail' | 'checkout' | 'checkout-success' | 'seller-dashboard' | 'compare' | 'profile' | 'orders' | 'order-detail' | 'login' | 'register' | 'verify-email' | 'tests';

export interface MarketplaceState {
  view: AppView;
  selectedProductId: string | null;
  selectedOrderId: string | null;
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
