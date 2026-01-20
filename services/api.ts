
import { Product, CartItem, User, Order, Review, ChatSentiment } from '../types';
import { DUMMY_PRODUCTS } from '../constants';

// Keys for our "Tables"
const DB_KEYS = {
  PRODUCTS: 'nex_db_products',
  USERS: 'nex_db_users',
  CARTS: 'nex_db_carts',
  ORDERS: 'nex_db_orders',
  REVIEWS: 'nex_db_reviews',
  SENTIMENTS: 'nex_db_sentiments'
};

// Seed Data
const SEED_USERS: User[] = [
  { id: 'admin-id', name: 'NexShop Admin', email: 'admin@nexshop.ai', password: 'admin', role: 'admin', isLoggedIn: false, isVerified: true },
  { id: 'user-sam', name: 'Sam Sample', email: 'sam@example.com', password: 'password', role: 'buyer', isLoggedIn: false, isVerified: true, address: '456 Buyer Blvd, San Francisco, CA' },
  { id: 'user-jane', name: 'Jane Seller', email: 'jane@techstudio.com', password: 'password', role: 'seller', isLoggedIn: false, isVerified: true }
];

const SEED_SENTIMENTS: ChatSentiment[] = [
  { id: 's1', user_id: 'user-sam', user_name: 'Sam Sample', timestamp: new Date().toISOString(), score: 'Positive', summary: 'User expressed high interest in the Mechanical Gaming Keyboard specs.', raw_messages: 5 },
  { id: 's2', user_id: 'guest-1', user_name: 'Guest User', timestamp: new Date(Date.now() - 3600000).toISOString(), score: 'Neutral', summary: 'Inquiry about international shipping rates for Audio gear.', raw_messages: 3 },
  { id: 's3', user_id: 'user-jane', user_name: 'Jane Seller', timestamp: new Date(Date.now() - 7200000).toISOString(), score: 'Negative', summary: 'Frustration reported regarding seller dashboard analytics loading time.', raw_messages: 8 }
];

// Helper to interact with our "DB"
const getTable = <T>(key: string): T[] => {
  const data = localStorage.getItem(key);
  return data ? JSON.parse(data) : [];
};

const setTable = (key: string, data: any) => {
  localStorage.setItem(key, JSON.stringify(data));
};

// Initialize DB if empty
const initDB = () => {
  if (getTable(DB_KEYS.PRODUCTS).length === 0) setTable(DB_KEYS.PRODUCTS, DUMMY_PRODUCTS);
  if (getTable(DB_KEYS.USERS).length === 0) setTable(DB_KEYS.USERS, SEED_USERS);
  if (getTable(DB_KEYS.SENTIMENTS).length === 0) setTable(DB_KEYS.SENTIMENTS, SEED_SENTIMENTS);
  if (!localStorage.getItem(DB_KEYS.CARTS)) setTable(DB_KEYS.CARTS, {});
};

initDB();

export const api = {
  async register(data: any): Promise<any> {
    const users = getTable<User>(DB_KEYS.USERS);
    if (users.find(u => u.email === data.email)) throw new Error("Email exists.");
    const newUser: User = { 
      ...data, 
      id: 'u-' + Math.random().toString(36).substr(2, 9), 
      role: 'buyer', 
      isVerified: true, 
      isLoggedIn: false 
    };
    users.push(newUser);
    setTable(DB_KEYS.USERS, users);
    return { status: 'success', user: newUser };
  },

  async login(credentials: any): Promise<User> {
    const users = getTable<User>(DB_KEYS.USERS);
    const user = users.find(u => u.email === credentials.email && (u.password === credentials.password || u.password_hash === credentials.password));
    if (!user) throw new Error("Invalid credentials. Use admin@nexshop.ai / admin");
    return { ...user, isLoggedIn: true };
  },

  async getAllUsers(): Promise<User[]> {
    return getTable<User>(DB_KEYS.USERS);
  },

  async getProducts(): Promise<Product[]> {
    return getTable<Product>(DB_KEYS.PRODUCTS);
  },

  async updateProfile(id: string, profile: Partial<User>): Promise<void> {
    const users = getTable<User>(DB_KEYS.USERS);
    const idx = users.findIndex(u => u.id === id);
    if (idx > -1) {
      users[idx] = { ...users[idx], ...profile };
      setTable(DB_KEYS.USERS, users);
    }
  },

  async getUser(id: string): Promise<User> {
    const user = getTable<User>(DB_KEYS.USERS).find(u => u.id === id);
    if (!user) throw new Error("User not found");
    return user;
  },

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    const carts = JSON.parse(localStorage.getItem(DB_KEYS.CARTS) || '{}');
    const userCart = carts[userId] || [];
    const prod = getTable<Product>(DB_KEYS.PRODUCTS).find(p => p.id === productId);
    if (!prod) return;

    const existing = userCart.find((i: any) => i.product.id === productId);
    if (existing) {
      existing.quantity += quantity;
    } else {
      userCart.push({ product: prod, quantity });
    }
    carts[userId] = userCart;
    setTable(DB_KEYS.CARTS, carts);
  },

  async getCart(userId: string): Promise<CartItem[]> {
    const carts = JSON.parse(localStorage.getItem(DB_KEYS.CARTS) || '{}');
    return carts[userId] || [];
  },

  async clearCart(userId: string): Promise<void> {
    const carts = JSON.parse(localStorage.getItem(DB_KEYS.CARTS) || '{}');
    carts[userId] = [];
    setTable(DB_KEYS.CARTS, carts);
  },

  async checkout(userId: string, address: string, paymentMethod: string, items: CartItem[]): Promise<Order> {
    const orders = getTable<Order>(DB_KEYS.ORDERS);
    const newOrder: Order = {
      id: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      user_id: userId,
      date: new Date().toISOString(),
      total: items.reduce((a, c) => a + (c.product.price * c.quantity), 0),
      shipping_address: address,
      payment_method: paymentMethod,
      status: 'Pending',
      items: items.map(i => ({ product: i.product, price: i.product.price, quantity: i.quantity }))
    };
    orders.push(newOrder);
    setTable(DB_KEYS.ORDERS, orders);
    return newOrder;
  },

  async getAllOrders(): Promise<Order[]> {
    return getTable<Order>(DB_KEYS.ORDERS).reverse();
  },

  async getMyOrders(userId: string): Promise<Order[]> {
    return getTable<Order>(DB_KEYS.ORDERS).filter(o => o.user_id === userId).reverse();
  },

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    return getTable<Order>(DB_KEYS.ORDERS).filter(o => o.items.some(i => i.product.seller_id === sellerId)).reverse();
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const orders = getTable<Order>(DB_KEYS.ORDERS);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx > -1) {
      orders[idx].status = status as any;
      setTable(DB_KEYS.ORDERS, orders);
    }
  },

  async getAllSentiments(): Promise<ChatSentiment[]> {
    return getTable<ChatSentiment>(DB_KEYS.SENTIMENTS).reverse();
  },

  async submitReview(productId: string, review: any): Promise<void> {
    const reviews = getTable<Review>(DB_KEYS.REVIEWS);
    reviews.push({ ...review, id: Math.random().toString(36).substr(2, 5), date: new Date().toISOString() });
    setTable(DB_KEYS.REVIEWS, reviews);
  },

  async getReviews(productId: string): Promise<Review[]> {
    return getTable<Review>(DB_KEYS.REVIEWS).filter(r => (r as any).product_id === productId);
  }
};
