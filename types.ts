
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
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export interface Order {
  id: string;
  date: string;
  total: number;
  status: 'Pending' | 'Shipped' | 'Delivered';
  items: string[];
}

export interface Analytics {
  totalRevenue: number;
  totalSales: number;
  topProduct: string;
  monthlyRevenue: { month: string; amount: number }[];
}

export interface User {
  id: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export type AppView = 'home' | 'search' | 'cart' | 'product-detail' | 'checkout' | 'checkout-success' | 'seller-dashboard' | 'compare';

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
  compareList: string[]; // List of product IDs to compare
}
