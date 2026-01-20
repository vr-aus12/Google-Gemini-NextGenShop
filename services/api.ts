
import { Product, CartItem, User, Order, Analytics } from '../types';

const API_BASE = 'http://localhost:8000';

export const api = {
  async getProducts(): Promise<Product[]> {
    try {
      const res = await fetch(`${API_BASE}/products`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      return data.map((p: any) => ({
        ...p,
        specs: typeof p.specs === 'string' ? JSON.parse(p.specs) : p.specs
      }));
    } catch (err) {
      console.warn("Backend not reachable. Ensure server.py is running. Using dummy products.");
      // Fallback: returns empty list which triggers App to use DUMMY_PRODUCTS
      return [];
    }
  },

  async createProduct(product: Partial<Product>): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/products`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      return await res.json();
    } catch (e) {
      console.error("Failed to create product on backend:", e);
      return { status: "offline_success", id: Math.random().toString() };
    }
  },

  async updateProduct(id: string, product: Partial<Product>): Promise<any> {
    try {
      const res = await fetch(`${API_BASE}/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(product)
      });
      return await res.json();
    } catch (e) {
      return { status: "offline_success" };
    }
  },

  async getAnalytics(): Promise<Analytics> {
    try {
      const res = await fetch(`${API_BASE}/seller/analytics`);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch (e) {
      return {
        totalRevenue: 5430,
        totalSales: 42,
        topProduct: "Mechanical Gaming Keyboard",
        monthlyRevenue: [
          { month: 'Jan', amount: 1200 },
          { month: 'Feb', amount: 1900 },
          { month: 'Mar', amount: 2330 },
        ]
      };
    }
  },

  async getOrders(): Promise<Order[]> {
    try {
      const res = await fetch(`${API_BASE}/seller/orders`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      return data.map((o: any) => ({
        ...o,
        items: JSON.parse(o.items)
      }));
    } catch (e) {
      return [
        { id: 'offline-1', date: new Date().toISOString(), total: 129.99, status: 'Delivered', items: ['Mechanical Gaming Keyboard'] },
        { id: 'offline-2', date: new Date().toISOString(), total: 447.99, status: 'Shipped', items: ['Sony WH-1000XM5', 'Logitech G Pro Wireless'] }
      ];
    }
  },

  async getCart(userId: string): Promise<CartItem[]> {
    try {
      const res = await fetch(`${API_BASE}/cart/${userId}`);
      if (!res.ok) throw new Error();
      return await res.json();
    } catch (err) {
      return [];
    }
  },

  async addToCart(userId: string, productId: string, quantity: number): Promise<void> {
    try {
      await fetch(`${API_BASE}/cart`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, product_id: productId, quantity })
      });
    } catch (e) {
      console.warn("Could not sync cart to backend.");
    }
  },

  async clearCart(userId: string): Promise<void> {
    try {
      await fetch(`${API_BASE}/cart/${userId}`, {
        method: 'DELETE'
      });
    } catch (e) {
      console.warn("Could not clear cart on backend.");
    }
  }
};
