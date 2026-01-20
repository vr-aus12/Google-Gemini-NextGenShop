
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
  aiInsight?: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface Review {
  id: string;
  user_id: string;
  user_name: string;
  rating: number;
  comment: string;
  date: string;
}

export interface ChatSentiment {
  id: string;
  user_id: string;
  user_name: string;
  timestamp: string;
  score: 'Positive' | 'Neutral' | 'Negative';
  summary: string;
  raw_messages: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface OrderItem {
  product: Product;
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
  password?: string;
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

export type AppView = 'home' | 'search' | 'cart' | 'product-detail' | 'checkout' | 'checkout-success' | 'seller-dashboard' | 'compare' | 'profile' | 'orders' | 'order-detail' | 'login' | 'register' | 'verify-email' | 'admin' | 'presentation';

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
