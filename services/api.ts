
import { Product, CartItem, User, Order, Review } from '../types';
import { DUMMY_PRODUCTS } from '../constants';

const API_BASE = 'http://localhost:8000';

// Mock storage for demo purposes when backend is offline
const getLocalUsers = () => JSON.parse(localStorage.getItem('mock_users') || '[]');
const saveLocalUsers = (users: any[]) => localStorage.setItem('mock_users', JSON.stringify(users));

const saveLocalUserToMocks = (user: any) => {
  const users = getLocalUsers();
  const idx = users.findIndex((u: any) => u.id === user.id || u.email === user.email);
  if (idx > -1) users[idx] = { ...users[idx], ...user };
  else users.push(user);
  saveLocalUsers(users);
};

// Local Cart Management for Offline Fallback
const getLocalCart = (userId: string): CartItem[] => {
  const carts = JSON.parse(localStorage.getItem('mock_carts') || '{}');
  return carts[userId] || [];
};

const saveLocalCart = (userId: string, cart: CartItem[]) => {
  const carts = JSON.parse(localStorage.getItem('mock_carts') || '{}');
  carts[userId] = cart;
  localStorage.setItem('mock_carts', JSON.stringify(carts));
};

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
    const res = await fetch(url, {
      ...options,
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ detail: 'Unknown error' }));
      throw new ApiError(errorData.detail || 'API Error', res.status);
    }
    return await res.json();
  } catch (err: any) {
    if (err instanceof ApiError) {
      if (fallback !== undefined) return fallback;
      throw err;
    }
    console.warn(`Network error at ${url}: ${err.message}`);
    if (fallback !== undefined) return fallback;
    throw err;
  }
}

export const api = {
  async register(data: any): Promise<any> {
    const fallbackToken = 'MOCK-' + Math.random().toString(36).substr(2, 5).toUpperCase();
    try {
      return await safeFetch<any>(`${API_BASE}/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const mockUser = { ...data, id: 'mock-' + Date.now(), isVerified: false, verificationToken: fallbackToken, role: 'buyer' };
      saveLocalUserToMocks(mockUser);
      return { status: 'success', token: fallbackToken };
    }
  },

  async login(credentials: any): Promise<User> {
    try {
      const data = await safeFetch<any>(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(credentials)
      });
      return { ...data, isLoggedIn: true, isVerified: !!data.isVerified };
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) throw e;
      const users = getLocalUsers();
      const user = users.find((u: any) => u.email === credentials.email && u.password === credentials.password);
      if (user) return { ...user, isLoggedIn: true, isVerified: !!user.isVerified };
      throw new Error("Invalid credentials or backend offline.");
    }
  },

  async verifyEmail(token: string): Promise<any> {
    try {
      return await safeFetch(`${API_BASE}/verify-email/${token}`);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      const users = getLocalUsers();
      const userIdx = users.findIndex((u: any) => u.verificationToken === token);
      if (userIdx !== -1) {
        users[userIdx].isVerified = true;
        users[userIdx].verificationToken = null;
        saveLocalUsers(users);
        return { status: 'success' };
      }
      throw new Error("Invalid token.");
    }
  },

  async googleAuth(authData: any): Promise<User> {
    try {
      const data = await safeFetch<any>(`${API_BASE}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authData)
      });
      return { ...data, isLoggedIn: true, isVerified: true };
    } catch (e) {
      const mockUser = { ...authData, id: 'google-' + Date.now(), role: 'buyer', isVerified: true };
      saveLocalUserToMocks(mockUser);
      return { ...mockUser, isLoggedIn: true };
    }
  },

  async getProducts(): Promise<Product[]> {
    const data = await safeFetch(`${API_BASE}/products`, {}, DUMMY_PRODUCTS);
    return data.map((p: any) => ({
      ...p,
      specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs
    }));
  },

  async getUser(id: string): Promise<User> {
    try {
      const data = await safeFetch<any>(`${API_BASE}/user/${id}`);
      return { ...data, isLoggedIn: true, isVerified: !!data.isVerified };
    } catch (e) {
      const users = getLocalUsers();
      const mockUser = users.find((u: any) => u.id === id);
      if (mockUser) return { ...mockUser, isLoggedIn: true, isVerified: !!mockUser.isVerified };
      
      const sessionUser = JSON.parse(localStorage.getItem('nexshop_user') || '{}');
      if (sessionUser.id === id) return sessionUser;
      
      return { id, name: 'Guest', email: '', isLoggedIn: false, isVerified: false, role: 'buyer' };
    }
  },

  async updateProfile(id: string, profile: Partial<User>): Promise<void> {
    try {
      await safeFetch(`${API_BASE}/user/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });
    } catch (e) {
      // Mock Persistence Sync for Tests
      const users = getLocalUsers();
      const idx = users.findIndex((u: any) => u.id === id);
      if (idx > -1) {
        users[idx] = { ...users[idx], ...profile };
        saveLocalUsers(users);
      } else {
        // Handle current session user if not in mock array
        const sessionUser = JSON.parse(localStorage.getItem('nexshop_user') || '{}');
        if (sessionUser.id === id) {
          const updated = { ...sessionUser, ...profile };
          localStorage.setItem('nexshop_user', JSON.stringify(updated));
          saveLocalUserToMocks(updated);
        } else {
          saveLocalUserToMocks({ id, ...profile });
        }
      }
    }
  },

  async checkout(userId: string, address: string, paymentMethod: string): Promise<any> {
    return await safeFetch(`${API_BASE}/checkout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, address, payment_method: paymentMethod })
    }, { status: 'success', order_id: 'ORDER-' + Date.now() });
  },

  async getCart(userId: string): Promise<CartItem[]> {
    const data = await safeFetch<CartItem[]>(`${API_BASE}/cart/${userId}`, {}, getLocalCart(userId));
    return data.map(item => ({
      ...item,
      product: {
        ...item.product,
        specs: typeof item.product.specs === 'string' ? JSON.parse(item.product.specs) : item.product.specs
      }
    }));
  },

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    try {
      await safeFetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, product_id: productId, quantity })
      });
    } catch (e) {
      const cart = getLocalCart(userId);
      const existing = cart.find(i => i.product.id === productId);
      if (existing) existing.quantity += quantity;
      else {
        const product = DUMMY_PRODUCTS.find(p => p.id === productId);
        if (product) cart.push({ product, quantity });
      }
      saveLocalCart(userId, cart);
    }
  },

  async clearCart(userId: string): Promise<void> {
    try {
      await safeFetch(`${API_BASE}/cart/${userId}`, { method: 'DELETE' });
    } catch (e) {
      saveLocalCart(userId, []);
    }
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
  }
};
