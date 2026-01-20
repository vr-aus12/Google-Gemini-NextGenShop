
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

export interface User {
  id: string;
  name: string;
  email: string;
  isLoggedIn: boolean;
}

export type AppView = 'home' | 'search' | 'cart' | 'product-detail' | 'checkout';

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
}
