
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingCart, Search, Home, User as UserIcon, Star, Filter, ArrowRight, Package, X, LogOut, Loader2, Store, CheckCircle, Plus, BarChart3, ClipboardList, RefreshCcw, Scale, Trash2, Edit } from 'lucide-react';
import { MarketplaceState, AppView, Product, Category, CartItem, User, Order, Analytics } from './types';
import { DUMMY_PRODUCTS } from './constants';
import { api } from './services/api';
import AIAgent from './components/AIAgent';

const App: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [products, setProducts] = useState<Product[]>(DUMMY_PRODUCTS);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sellerTab, setSellerTab] = useState<'analytics' | 'orders' | 'inventory'>('analytics');
  
  const [state, setState] = useState<MarketplaceState>(() => {
    const savedUser = localStorage.getItem('nexshop_user');
    return {
      view: 'home',
      selectedProductId: null,
      searchQuery: '',
      activeFilters: {
        category: null,
        minPrice: null,
        maxPrice: null
      },
      cart: [],
      user: savedUser ? JSON.parse(savedUser) : null,
      compareList: []
    };
  });

  const refreshProducts = async () => {
    const fetchedProducts = await api.getProducts();
    if (fetchedProducts.length > 0) setProducts(fetchedProducts);
  };

  const loadSellerData = async () => {
    const [stats, recentOrders] = await Promise.all([api.getAnalytics(), api.getOrders()]);
    setAnalytics(stats);
    setOrders(recentOrders);
  };

  useEffect(() => {
    const loadData = async () => {
      await refreshProducts();
      if (state.user) {
        const fetchedCart = await api.getCart(state.user.id);
        setState(prev => ({ ...prev, cart: fetchedCart }));
      }
    };
    loadData();
  }, [state.user?.id]);

  useEffect(() => {
    if (state.view === 'seller-dashboard') {
      loadSellerData();
    }
  }, [state.view]);

  useEffect(() => {
    if (state.user) {
      localStorage.setItem('nexshop_user', JSON.stringify(state.user));
    } else {
      localStorage.removeItem('nexshop_user');
    }
  }, [state.user]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                           p.description.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesCategory = !state.activeFilters.category || p.category === state.activeFilters.category;
      const matchesMin = !state.activeFilters.minPrice || p.price >= state.activeFilters.minPrice;
      const matchesMax = !state.activeFilters.maxPrice || p.price <= state.activeFilters.maxPrice;
      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    });
  }, [products, state.searchQuery, state.activeFilters]);

  const handleLogin = () => {
    setIsAuthenticating(true);
    setTimeout(() => {
      const user: User = { id: 'user_dev_1', name: 'Alex Chen', email: 'alex@example.com', isLoggedIn: true };
      setState(prev => ({ ...prev, user }));
      setIsAuthenticating(false);
    }, 800);
  };

  const handleLogout = () => {
    setState(prev => ({ ...prev, user: null, cart: [] }));
  };

  const handleCheckout = async () => {
    if (state.user) {
      await api.clearCart(state.user.id);
    }
    setState(prev => ({ ...prev, view: 'checkout-success', cart: [] }));
  };

  const actions = {
    search: (query: string, category?: Category, min?: number, max?: number) => {
      setState(prev => ({
        ...prev,
        view: 'search',
        searchQuery: query !== undefined ? query : prev.searchQuery,
        activeFilters: {
          category: category !== undefined ? category : prev.activeFilters.category,
          minPrice: min !== undefined ? min : prev.activeFilters.minPrice,
          maxPrice: max !== undefined ? max : prev.activeFilters.maxPrice
        }
      }));
    },
    addToCart: async (productIdOrName: string, quantity: number = 1) => {
      // Robust product lookup by ID, Name or Partial Name
      const product = products.find(p => 
        p.id === productIdOrName || 
        p.name.toLowerCase() === productIdOrName.toLowerCase() ||
        p.name.toLowerCase().includes(productIdOrName.toLowerCase())
      );

      if (product) {
        setState(prev => {
          const existing = prev.cart.find(item => item.product.id === product.id);
          if (existing) {
            return {
              ...prev,
              cart: prev.cart.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + quantity } : item)
            };
          }
          return { ...prev, cart: [...prev.cart, { product, quantity }] };
        });

        // Use a persistent ID for API sync
        const userId = localStorage.getItem('nexshop_user') 
          ? JSON.parse(localStorage.getItem('nexshop_user')!).id 
          : null;

        if (userId) {
          // Note: we can't reliably use state.cart here due to async setState
          // The backend expects total quantity or delta? assuming delta is safer if logic is matched
          // But here we'll just try to sync the addition
          await api.addToCart(userId, product.id, quantity);
        }
      }
    },
    viewProduct: (productIdOrName: string) => {
      const product = products.find(p => 
        p.id === productIdOrName || 
        p.name.toLowerCase() === productIdOrName.toLowerCase() ||
        p.name.toLowerCase().includes(productIdOrName.toLowerCase())
      );
      if (product) {
        setState(prev => ({ ...prev, view: 'product-detail', selectedProductId: product.id }));
      }
    },
    navigateTo: (view: AppView) => {
      setState(prev => ({ ...prev, view }));
    },
    addProduct: async (p: Partial<Product>) => {
      await api.createProduct(p);
      await refreshProducts();
      setState(prev => ({ ...prev, view: 'search', searchQuery: p.name || '' }));
    },
    toggleCompare: (id: string) => {
      setState(prev => ({
        ...prev,
        compareList: prev.compareList.includes(id) 
          ? prev.compareList.filter(item => item !== id)
          : [...prev.compareList, id].slice(0, 4) // Max 4 items
      }));
    }
  };

  const selectedProduct = useMemo(() => products.find(p => p.id === state.selectedProductId), [products, state.selectedProductId]);
  const compareItems = useMemo(() => products.filter(p => state.compareList.includes(p.id)), [products, state.compareList]);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="sticky top-0 z-40 glass-morphism border-b px-4 py-3 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => actions.navigateTo('home')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
          <span className="text-xl font-bold tracking-tight group-hover:text-indigo-600 transition-colors">NexShop</span>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-8 relative">
          <input 
            type="text" 
            placeholder="Search premium electronics..." 
            className="w-full bg-slate-100 border-none rounded-full px-6 py-2 focus:ring-2 focus:ring-indigo-500 transition-all pl-12"
            value={state.searchQuery}
            onChange={(e) => actions.search(e.target.value)}
          />
          <Search className="absolute left-4 top-2.5 text-slate-400 w-5 h-5" />
        </div>

        <div className="flex items-center gap-4">
          <button 
            className={`p-2 transition-colors flex items-center gap-1.5 ${state.view === 'compare' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`} 
            onClick={() => actions.navigateTo('compare')}
            title="Compare Items"
          >
            <Scale className="w-5 h-5" />
            {state.compareList.length > 0 && <span className="text-xs font-bold">{state.compareList.length}</span>}
          </button>

          <button 
            className={`p-2 transition-colors ${state.view === 'seller-dashboard' ? 'text-indigo-600' : 'text-slate-600 hover:text-indigo-600'}`} 
            onClick={() => actions.navigateTo('seller-dashboard')}
            title="Seller Center"
          >
            <Store className="w-6 h-6" />
          </button>
          
          <button className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors" onClick={() => actions.navigateTo('cart')}>
            <ShoppingCart className="w-6 h-6" />
            {state.cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {state.cart.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </button>
          
          {state.user ? (
            <div className="flex items-center gap-3 bg-white border px-3 py-1.5 rounded-full shadow-sm">
              <div className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center text-xs font-bold">
                {state.user.name.charAt(0)}
              </div>
              <span className="text-sm font-medium hidden lg:inline-block">{state.user.name}</span>
              <button onClick={handleLogout} className="p-1 hover:text-red-500 transition-colors" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} disabled={isAuthenticating} className="flex items-center gap-2 bg-slate-900 text-white px-5 py-2 rounded-full hover:bg-slate-800 transition-all active:scale-95 disabled:opacity-70">
              {isAuthenticating ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserIcon className="w-4 h-4" />}
              <span>{isAuthenticating ? 'Signing in...' : 'Login'}</span>
            </button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-8">
        {state.view === 'home' && (
          <div className="space-y-12">
            <section className="bg-indigo-600 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">Smarter Shopping, Empowered Sellers.</h1>
                <p className="text-indigo-100 text-lg mb-8">Compare products instantly, manage your store with deep analytics, and let Nex handle the heavy lifting via voice.</p>
                <button onClick={() => actions.navigateTo('search')} className="bg-white text-indigo-600 px-8 py-4 rounded-full font-semibold hover:bg-indigo-50 transition-all flex items-center gap-2">
                  Shop Premium <ArrowRight className="w-5 h-5" />
                </button>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-8">Fresh Arrivals</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {products.slice(0, 4).map(product => (
                  <ProductCard key={product.id} product={product} onProductClick={actions.viewProduct} onAddToCart={actions.addToCart} onCompareToggle={actions.toggleCompare} isCompared={state.compareList.includes(product.id)} />
                ))}
              </div>
            </section>
          </div>
        )}

        {state.view === 'search' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 space-y-8">
              <h3 className="text-lg font-bold flex items-center gap-2"><Filter className="w-4 h-4" /> Filters</h3>
              <div className="space-y-4">
                {['Electronics', 'Gaming', 'Workstation', 'Audio'].map(cat => (
                  <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={state.activeFilters.category === cat} onChange={() => actions.search(state.searchQuery, state.activeFilters.category === cat ? null as any : cat as Category)} className="rounded text-indigo-600" />
                    <span className={state.activeFilters.category === cat ? 'font-bold text-indigo-600' : ''}>{cat}</span>
                  </label>
                ))}
              </div>
            </aside>
            <div className="flex-1">
              <h2 className="text-xl font-bold mb-6">{filteredProducts.length} Results for "{state.searchQuery || 'All Items'}"</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onProductClick={actions.viewProduct} onAddToCart={actions.addToCart} onCompareToggle={actions.toggleCompare} isCompared={state.compareList.includes(product.id)} />
                ))}
              </div>
            </div>
          </div>
        )}

        {state.view === 'compare' && (
          <div className="space-y-8">
            <h1 className="text-3xl font-bold">Compare Products</h1>
            {compareItems.length < 2 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                <Scale className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Add at least two items to compare them side-by-side.</p>
                <button onClick={() => actions.navigateTo('search')} className="mt-4 bg-indigo-600 text-white px-8 py-2 rounded-full font-bold">Go to Shop</button>
              </div>
            ) : (
              <div className="bg-white rounded-3xl border overflow-hidden shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="p-6 font-bold text-slate-400 uppercase text-xs tracking-wider">Features</th>
                      {compareItems.map(item => (
                        <th key={item.id} className="p-6 min-w-[200px]">
                          <div className="flex flex-col gap-4">
                            <img src={item.image} className="w-24 h-24 rounded-xl object-cover" />
                            <h3 className="font-bold text-lg">{item.name}</h3>
                            <button onClick={() => actions.toggleCompare(item.id)} className="text-red-500 text-xs font-bold hover:underline">Remove</button>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="p-6 font-bold text-slate-600 bg-slate-50/50">Price</td>
                      {compareItems.map(item => (
                        <td key={item.id} className="p-6 text-xl font-bold">${item.price.toFixed(2)}</td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-6 font-bold text-slate-600 bg-slate-50/50">Rating</td>
                      {compareItems.map(item => (
                        <td key={item.id} className="p-6">
                          <div className="flex items-center gap-1 text-yellow-500">
                             <Star className="w-4 h-4 fill-current" /> {item.rating}
                          </div>
                        </td>
                      ))}
                    </tr>
                    <tr className="border-b">
                      <td className="p-6 font-bold text-slate-600 bg-slate-50/50">Category</td>
                      {compareItems.map(item => (
                        <td key={item.id} className="p-6 text-slate-500">{item.category}</td>
                      ))}
                    </tr>
                    <tr>
                      <td className="p-6 font-bold text-slate-600 bg-slate-50/50">Key Specs</td>
                      {compareItems.map(item => (
                        <td key={item.id} className="p-6">
                          <ul className="space-y-1">
                            {item.specs.map(s => <li key={s} className="text-xs text-slate-500">• {s}</li>)}
                          </ul>
                        </td>
                      ))}
                    </tr>
                    <tr className="bg-slate-50/20">
                      <td className="p-6"></td>
                      {compareItems.map(item => (
                        <td key={item.id} className="p-6">
                           <button onClick={() => actions.addToCart(item.id)} className="w-full bg-indigo-600 text-white py-2 rounded-xl font-bold shadow hover:bg-indigo-700 transition-all">Add to Cart</button>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {state.view === 'seller-dashboard' && (
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <h1 className="text-3xl font-bold">Seller Dashboard</h1>
              <div className="flex bg-slate-100 p-1 rounded-2xl">
                <button onClick={() => setSellerTab('analytics')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${sellerTab === 'analytics' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <BarChart3 className="w-4 h-4 inline mr-2" /> Analytics
                </button>
                <button onClick={() => setSellerTab('orders')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${sellerTab === 'orders' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <ClipboardList className="w-4 h-4 inline mr-2" /> Orders
                </button>
                <button onClick={() => setSellerTab('inventory')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${sellerTab === 'inventory' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
                  <RefreshCcw className="w-4 h-4 inline mr-2" /> Inventory
                </button>
              </div>
            </div>

            {sellerTab === 'analytics' && analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">
                <div className="lg:col-span-2 space-y-8">
                  <div className="bg-white p-8 rounded-3xl border shadow-sm">
                    <h2 className="text-xl font-bold mb-6">Revenue Trend</h2>
                    <div className="flex items-end gap-2 h-48">
                       {analytics.monthlyRevenue.map(m => (
                         <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
                            <div className="w-full bg-indigo-600 rounded-t-xl transition-all duration-1000" style={{ height: `${(m.amount / 3000) * 100}%` }}></div>
                            <span className="text-[10px] font-bold text-slate-400 uppercase">{m.month}</span>
                         </div>
                       ))}
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-3xl border shadow-sm">
                    <h2 className="text-xl font-bold mb-4">Top Performing Products</h2>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl">
                        <div className="flex items-center gap-4">
                          <img src="https://picsum.photos/seed/keyboard/100/100" className="w-12 h-12 rounded-lg object-cover" />
                          <div>
                            <span className="font-bold block">Mechanical Gaming Keyboard</span>
                            <span className="text-xs text-slate-400">Gaming • 48 Units Sold</span>
                          </div>
                        </div>
                        <span className="font-bold text-indigo-600">$6,239</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="bg-slate-900 text-white p-8 rounded-3xl shadow-xl">
                    <span className="text-slate-400 text-sm block mb-1">Total Revenue</span>
                    <span className="text-4xl font-bold">${analytics.totalRevenue.toFixed(2)}</span>
                    <div className="mt-4 flex items-center gap-2 text-green-400 text-sm font-bold">
                       <ArrowRight className="w-4 h-4 -rotate-45" /> +12% from last month
                    </div>
                  </div>
                  <div className="bg-white p-8 rounded-3xl border shadow-sm">
                    <span className="text-slate-400 text-sm block mb-1">Conversion Rate</span>
                    <span className="text-4xl font-bold">3.2%</span>
                  </div>
                  <div className="bg-indigo-600 text-white p-8 rounded-3xl">
                    <h3 className="font-bold mb-2">Sell Faster with Nex</h3>
                    <p className="text-indigo-100 text-sm mb-4">Just say: "Nex, list a new keyboard for $150 with RGB and Brown switches."</p>
                    <button onClick={() => alert('Tell Nex: "I want to list a new item"')} className="w-full py-2 bg-white text-indigo-600 rounded-xl font-bold text-sm">List via Voice</button>
                  </div>
                </div>
              </div>
            )}

            {sellerTab === 'orders' && (
              <div className="bg-white rounded-3xl border shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                <table className="w-full text-left">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="p-6 font-bold text-slate-400 text-xs uppercase">Order ID</th>
                      <th className="p-6 font-bold text-slate-400 text-xs uppercase">Items</th>
                      <th className="p-6 font-bold text-slate-400 text-xs uppercase">Date</th>
                      <th className="p-6 font-bold text-slate-400 text-xs uppercase">Total</th>
                      <th className="p-6 font-bold text-slate-400 text-xs uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {orders.map(o => (
                      <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                        <td className="p-6 font-mono text-xs text-slate-500">{o.id.slice(0, 8)}...</td>
                        <td className="p-6">
                          <div className="text-sm font-bold">{o.items.join(', ')}</div>
                        </td>
                        <td className="p-6 text-slate-500 text-sm">{new Date(o.date).toLocaleDateString()}</td>
                        <td className="p-6 font-bold">${o.total.toFixed(2)}</td>
                        <td className="p-6">
                          <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            o.status === 'Delivered' ? 'bg-green-100 text-green-700' : 
                            o.status === 'Shipped' ? 'bg-blue-100 text-blue-700' : 'bg-yellow-100 text-yellow-700'
                          }`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {sellerTab === 'inventory' && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-in fade-in duration-500">
                <div className="bg-indigo-50 border border-dashed border-indigo-300 rounded-3xl p-8 flex flex-col items-center justify-center text-center group cursor-pointer hover:bg-indigo-100 transition-all" onClick={() => alert('Tell Nex to list an item!')}>
                   <div className="w-12 h-12 bg-indigo-600 text-white rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform"><Plus className="w-6 h-6" /></div>
                   <h3 className="font-bold text-indigo-900">Add New Listing</h3>
                   <p className="text-indigo-600 text-sm">Let Nex handle the product description and categorization.</p>
                </div>
                {products.map(p => (
                  <div key={p.id} className="bg-white p-6 rounded-3xl border shadow-sm group">
                    <div className="flex gap-4 mb-6">
                      <img src={p.image} className="w-20 h-20 rounded-2xl object-cover" />
                      <div className="flex-1">
                        <h4 className="font-bold text-lg leading-tight group-hover:text-indigo-600 transition-colors">{p.name}</h4>
                        <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{p.category}</span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between pt-4 border-t">
                      <span className="font-bold text-xl">${p.price.toFixed(0)}</span>
                      <div className="flex gap-2">
                        <button className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition-all"><Edit className="w-4 h-4" /></button>
                        <button className="p-2 bg-slate-100 rounded-xl text-slate-500 hover:text-red-500 hover:bg-red-50 transition-all"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Existing Views (cart, search, checkout, detail) remain here */}
        {state.view === 'checkout-success' && (
          <div className="max-w-xl mx-auto text-center py-20 space-y-6">
            <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-12 h-12" />
            </div>
            <h1 className="text-4xl font-bold">Order Confirmed!</h1>
            <p className="text-slate-500 text-lg">Thank you for shopping with NexShop. Your items will be delivered shortly.</p>
            <button onClick={() => actions.navigateTo('home')} className="bg-indigo-600 text-white px-8 py-3 rounded-full font-bold">Return Home</button>
          </div>
        )}

        {state.view === 'product-detail' && selectedProduct && (
          <div className="bg-white rounded-3xl p-6 sm:p-12 border shadow-sm flex flex-col lg:flex-row gap-12">
            <div className="lg:w-1/2 aspect-square rounded-2xl overflow-hidden bg-slate-50">
              <img src={selectedProduct.image} className="w-full h-full object-cover" />
            </div>
            <div className="lg:w-1/2 space-y-6">
              <div className="flex justify-between items-start">
                <span className="text-indigo-600 font-bold uppercase tracking-widest text-xs">{selectedProduct.category}</span>
                <button 
                  onClick={() => actions.toggleCompare(selectedProduct.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-bold transition-all ${state.compareList.includes(selectedProduct.id) ? 'bg-indigo-600 border-indigo-600 text-white' : 'hover:border-indigo-600 hover:text-indigo-600'}`}
                >
                  <Scale className="w-3 h-3" /> {state.compareList.includes(selectedProduct.id) ? 'Compared' : 'Compare'}
                </button>
              </div>
              <h1 className="text-4xl font-bold">{selectedProduct.name}</h1>
              <p className="text-slate-600 text-lg">{selectedProduct.description}</p>
              <div className="pt-8 border-t flex items-center justify-between">
                <span className="text-3xl font-bold">${selectedProduct.price.toFixed(2)}</span>
                <button onClick={() => actions.addToCart(selectedProduct.id)} className="bg-indigo-600 text-white px-10 py-3 rounded-full font-bold shadow-lg hover:bg-indigo-700 transition-all">
                  Add to Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {state.view === 'cart' && (
          <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Shopping Cart</h1>
            {state.cart.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-3xl">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Cart is empty.</p>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  {state.cart.map(item => (
                    <div key={item.product.id} className="bg-white p-4 border rounded-2xl flex items-center gap-6">
                      <img src={item.product.image} className="w-20 h-20 rounded-xl object-cover" />
                      <div className="flex-1 font-bold">{item.product.name}</div>
                      <div className="font-bold">${(item.product.price * item.quantity).toFixed(2)}</div>
                      <button 
                        onClick={async () => {
                          // No direct remove API shown in snippet, but assuming state handle
                          setState(prev => ({ ...prev, cart: prev.cart.filter(i => i.product.id !== item.product.id) }));
                        }}
                        className="text-slate-300 hover:text-red-500"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="bg-slate-900 text-white p-8 rounded-3xl flex justify-between items-center">
                  <span className="text-2xl font-bold">Total: ${state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0).toFixed(2)}</span>
                  <button onClick={handleCheckout} className="bg-indigo-500 px-8 py-3 rounded-full font-bold">Checkout</button>
                </div>
              </>
            )}
          </div>
        )}
      </main>

      <AIAgent 
        actions={{...actions, compareProduct: actions.toggleCompare}} 
        currentCart={state.cart} 
        products={products} 
        user={state.user} 
        currentView={state.view}
        selectedProductId={state.selectedProductId}
        searchQuery={state.searchQuery}
        sellerTab={sellerTab}
      />
    </div>
  );
};

const ProductCard: React.FC<{ 
  product: Product; 
  onProductClick: (id: string) => void; 
  onAddToCart: (id: string) => void; 
  onCompareToggle: (id: string) => void; 
  isCompared: boolean; 
}> = ({ product, onProductClick, onAddToCart, onCompareToggle, isCompared }) => (
  <div className="group bg-white rounded-2xl border hover:border-indigo-300 transition-all hover:shadow-xl p-4 relative">
    <button 
      onClick={() => onCompareToggle(product.id)}
      className={`absolute top-6 right-6 z-10 p-2 rounded-full transition-all border shadow-sm ${isCompared ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-400 hover:text-indigo-600'}`}
      title="Add to Comparison"
    >
      <Scale className="w-4 h-4" />
    </button>
    <div className="aspect-square bg-slate-50 rounded-xl overflow-hidden cursor-pointer mb-4" onClick={() => onProductClick(product.id)}>
      <img src={product.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
    </div>
    <div className="flex justify-between items-center mb-4">
      <h3 className="font-bold truncate pr-2">{product.name}</h3>
      <span className="font-bold">${product.price.toFixed(0)}</span>
    </div>
    <button onClick={() => onAddToCart(product.id)} className="w-full py-2 bg-slate-100 rounded-xl font-bold hover:bg-indigo-600 hover:text-white transition-all text-sm">Add to Cart</button>
  </div>
);

export default App;
