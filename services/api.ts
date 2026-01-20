
import { Product, CartItem, User, Order, Review } from '../types';
import { DUMMY_PRODUCTS } from '../constants';

const API_BASE = 'http://localhost:8000';

// Unified Store Management
const getStore = <T>(key: string, def: T): T => {
  const saved = localStorage.getItem(`nexshop_${key}`);
  return saved ? JSON.parse(saved) : def;
};

const setStore = (key: string, val: any) => {
  localStorage.setItem(`nexshop_${key}`, JSON.stringify(val));
};

// Initialize Stores
if (!localStorage.getItem('nexshop_products')) setStore('products', DUMMY_PRODUCTS);

export class ApiError extends Error {
  status?: number;
  constructor(message: string, status?: number) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

async function safeFetch<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 1500); // Shorter timeout for better UX
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(errorData.detail || 'API Error', res.status);
    }
    return await res.json();
  } catch (err: any) {
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export const api = {
  async register(data: any): Promise<any> {
    try {
      const res = await safeFetch(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      return res;
    } catch (e) {
      // Local Fallback
      const users = getStore<User[]>('users', []);
      if (users.find(u => u.email === data.email)) throw new Error("This email is already registered.");
      const token = Math.random().toString(36).substr(2, 6).toUpperCase();
      const newUser: User = { 
        ...data, 
        id: Math.random().toString(36).substr(2, 9), 
        isLoggedIn: false, 
        isVerified: false, 
        verificationToken: token,
        role: 'buyer'
      };
      users.push(newUser);
      setStore('users', users);
      return { status: 'success', token };
    }
  },

  async login(credentials: any): Promise<User> {
    try {
      const data = await safeFetch<any>(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      return { ...data, isLoggedIn: true };
    } catch (e) {
      // Local Fallback
      const users = getStore<User[]>('users', []);
      const user = users.find(u => u.email === credentials.email && (u.password === credentials.password || u.password_hash === credentials.password));
      if (!user) throw new Error("Invalid email or password. Please check your credentials.");
      return { ...user, isLoggedIn: true };
    }
  },

  async verifyEmail(token: string): Promise<any> {
    try {
      return await safeFetch(`${API_BASE}/verify-email/${token}`);
    } catch (e) {
      const users = getStore<User[]>('users', []);
      const idx = users.findIndex((u: any) => u.verificationToken === token);
      if (idx === -1) throw new Error("Invalid verification token. Please check the code provided.");
      users[idx].isVerified = true;
      delete (users[idx] as any).verificationToken;
      setStore('users', users);
      return { status: 'success' };
    }
  },

  async getProducts(): Promise<Product[]> {
    return await safeFetch(`${API_BASE}/products`, {}, getStore<Product[]>('products', DUMMY_PRODUCTS));
  },

  async updateProfile(id: string, profile: Partial<User>): Promise<void> {
    try {
      await safeFetch(`${API_BASE}/user/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch (e) {
      const users = getStore<User[]>('users', []);
      const idx = users.findIndex(u => u.id === id);
      if (idx > -1) {
        users[idx] = { ...users[idx], ...profile };
        setStore('users', users);
      }
    }
  },

  async getUser(id: string): Promise<User> {
    try {
        const data = await safeFetch<any>(`${API_BASE}/user/${id}`);
        return { ...data };
    } catch(e) {
        const users = getStore<User[]>('users', []);
        return users.find(u => u.id === id) || { id, name: 'Guest', email: '', isLoggedIn: false, isVerified: false, role: 'buyer' };
    }
  },

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    const carts = getStore<Record<string, CartItem[]>>('carts', {});
    const cart = carts[userId] || [];
    const existing = cart.find(i => i.product.id === productId);
    if (existing) existing.quantity += quantity;
    else {
      const products = getStore<Product[]>('products', DUMMY_PRODUCTS);
      const product = products.find(p => p.id === productId);
      if (product) cart.push({ product, quantity });
    }
    carts[userId] = cart;
    setStore('carts', carts);
  },

  async getCart(userId: string): Promise<CartItem[]> {
    const carts = getStore<Record<string, CartItem[]>>('carts', {});
    return carts[userId] || [];
  },

  async clearCart(userId: string): Promise<void> {
    const carts = getStore<Record<string, CartItem[]>>('carts', {});
    carts[userId] = [];
    setStore('carts', carts);
  },

  async checkout(userId: string, address: string, paymentMethod: string, items: CartItem[]): Promise<Order> {
    const orders = getStore<Order[]>('orders', []);
    const total = items.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
    const newOrder: Order = {
      id: 'ORD-' + Math.random().toString(36).substr(2, 6).toUpperCase(),
      user_id: userId,
      date: new Date().toISOString(),
      total,
      shipping_address: address,
      payment_method: paymentMethod,
      status: 'Pending',
      items: items.map(i => ({ product: i.product, price: i.product.price, quantity: i.quantity }))
    };
    orders.push(newOrder);
    setStore('orders', orders);
    return newOrder;
  },

  async getMyOrders(userId: string): Promise<Order[]> {
    const orders = getStore<Order[]>('orders', []);
    return orders.filter(o => o.user_id === userId).reverse();
  },

  async getOrder(orderId: string): Promise<Order | null> {
    const orders = getStore<Order[]>('orders', []);
    return orders.find(o => o.id === orderId) || null;
  },

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    const orders = getStore<Order[]>('orders', []);
    return orders.filter(o => o.items.some(i => i.product.seller_id === sellerId)).reverse();
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    const orders = getStore<Order[]>('orders', []);
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx > -1) {
      orders[idx].status = status as any;
      setStore('orders', orders);
    }
  },

  async getReviews(productId: string): Promise<Review[]> {
    const reviews = getStore<Record<string, Review[]>>('reviews', {});
    return reviews[productId] || [];
  },

  async submitReview(productId: string, review: any): Promise<void> {
    const reviews = getStore<Record<string, Review[]>>('reviews', {});
    if (!reviews[productId]) reviews[productId] = [];
    reviews[productId].push({ ...review, id: Math.random().toString(36).substr(2, 5) });
    setStore('reviews', reviews);
  }
};
