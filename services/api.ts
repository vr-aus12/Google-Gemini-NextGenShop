
import { Product, CartItem, User, Order, Review } from '../types';
import { DUMMY_PRODUCTS } from '../constants';

const API_BASE = 'http://localhost:8000';

// Helper to handle fetch with fallback to a local "database" (localStorage)
async function safeFetch<T>(url: string, options?: RequestInit, fallback?: T): Promise<T> {
  try {
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(2000) // Fast fail if server is down
    });
    if (!res.ok) throw new Error('API Error');
    return await res.json();
  } catch (err) {
    console.warn(`API unavailable at ${url}, using fallback logic.`);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export const api = {
  async getProducts(): Promise<Product[]> {
    const data = await safeFetch(`${API_BASE}/products`, {}, DUMMY_PRODUCTS);
    return data.map((p: any) => ({
      ...p,
      specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs
    }));
  },

  async getUser(id: string): Promise<User> {
    const localUser = localStorage.getItem(`user_${id}`);
    const fallback: User = localUser ? JSON.parse(localUser) : { id, name: "Guest User", role: "buyer", isLoggedIn: true };
    return await safeFetch(`${API_BASE}/user/${id}`, {}, fallback);
  },

  async updateProfile(id: string, profile: Partial<User>): Promise<void> {
    // Update local first for immediate feedback
    const current = await this.getUser(id);
    const updated = { ...current, ...profile };
    localStorage.setItem(`user_${id}`, JSON.stringify(updated));
    localStorage.setItem('nexshop_user', JSON.stringify(updated));

    await safeFetch(`${API_BASE}/user/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile)
    }, { status: 'success' });
  },

  async checkout(userId: string, address: string, paymentMethod: string): Promise<any> {
    const orderId = Math.random().toString(36).substr(2, 9);
    return await safeFetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, address, payment_method: paymentMethod })
    }, { status: "success", order_id: orderId });
  },

  async getMyOrders(userId: string): Promise<Order[]> {
    return await safeFetch(`${API_BASE}/orders/${userId}`, {}, []);
  },

  async getSellerOrders(sellerId: string): Promise<Order[]> {
    return await safeFetch(`${API_BASE}/seller/orders/${sellerId}`, {}, []);
  },

  async updateOrderStatus(orderId: string, status: string): Promise<void> {
    await safeFetch(`${API_BASE}/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: orderId, status })
    }, { status: 'success' });
  },

  async getReviews(productId: string): Promise<Review[]> {
    return await safeFetch(`${API_BASE}/reviews/${productId}`, {}, []);
  },

  async submitReview(productId: string, review: Partial<Review>): Promise<void> {
    await safeFetch(`${API_BASE}/reviews/${productId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(review)
    }, { status: 'success' });
  },

  async getCart(userId: string): Promise<CartItem[]> {
    const localCart = localStorage.getItem(`cart_${userId}`);
    const fallback = localCart ? JSON.parse(localCart) : [];
    return await safeFetch(`${API_BASE}/cart/${userId}`, {}, fallback);
  },

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    // Update local storage
    const cart = await this.getCart(userId);
    const products = await this.getProducts();
    const product = products.find(p => p.id === productId);
    if (product) {
      const existing = cart.find(i => i.product.id === productId);
      if (existing) existing.quantity += quantity;
      else cart.push({ product, quantity });
      localStorage.setItem(`cart_${userId}`, JSON.stringify(cart));
    }

    await safeFetch(`${API_BASE}/cart`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, product_id: productId, quantity })
    }, { status: 'success' });
  },

  async clearCart(userId: string): Promise<void> {
    localStorage.removeItem(`cart_${userId}`);
    await safeFetch(`${API_BASE}/cart/${userId}`, { method: 'DELETE' }, { status: 'success' });
  }
};
