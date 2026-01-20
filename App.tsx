
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Home, User as UserIcon, Star, Filter, ArrowRight, X, LogOut, Loader2, Store, CheckCircle, Plus, BarChart3, ClipboardList, RefreshCcw, Scale, Trash2, Edit, CreditCard, ShieldCheck, Truck, Sparkles, Hash, MapPin, Package, Clock, MessageCircle, PlayCircle, ShieldAlert, Mail, Lock, User as UserIconSmall, ArrowLeft, BellRing, ClipboardCheck, Terminal, TrendingUp, Users, DollarSign, PackageOpen, ChevronDown, Calendar, CreditCard as CardIcon, Save, AlertCircle, LayoutDashboard, ListPlus } from 'lucide-react';
import { MarketplaceState, AppView, Product, Category, CartItem, User, Order, Review } from './types';
import { DUMMY_PRODUCTS } from './constants';
import { api } from './services/api';
import AIAgent from './components/AIAgent';
import { runFunctionalTests, TestResult } from './services/testRunner';

const App: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [products, setProducts] = useState<Product[]>(DUMMY_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sellerTab, setSellerTab] = useState<'analytics' | 'orders' | 'inventory'>('analytics');
  
  const [notification, setNotification] = useState<{ message: string; sub: string; icon: any; type?: 'info' | 'error' | 'success' } | null>(null);

  const [state, setState] = useState<MarketplaceState>(() => {
    const savedUser = localStorage.getItem('nexshop_user');
    return {
      view: 'home',
      selectedProductId: null,
      selectedOrderId: null,
      searchQuery: '',
      activeFilters: { category: null, minPrice: null, maxPrice: null },
      cart: [],
      user: savedUser ? JSON.parse(savedUser) : null,
      compareList: []
    };
  });

  const showNotify = (message: string, sub: string, icon: any = BellRing, type: 'info' | 'error' | 'success' = 'info') => {
    setNotification({ message, sub, icon, type });
    if (type !== 'error') {
        setTimeout(() => setNotification(null), 5000);
    }
  };

  const refreshProducts = async () => {
    const fetched = await api.getProducts();
    if (fetched.length > 0) setProducts(fetched);
  };

  const refreshOrders = async () => {
    if (state.user) {
      if (state.view === 'seller-dashboard') {
        const fetched = await api.getSellerOrders(state.user.id);
        setOrders(fetched);
      } else {
        const myOrders = await api.getMyOrders(state.user.id);
        setOrders(myOrders);
      }
    }
  };

  useEffect(() => {
    refreshProducts();
    if (state.user) {
      api.getCart(state.user.id).then(c => setState(prev => ({ ...prev, cart: c })));
    }
  }, [state.user?.id]);

  useEffect(() => {
    if (state.user && (state.view === 'orders' || state.view === 'order-detail' || state.view === 'seller-dashboard')) {
      refreshOrders();
    }
    if (state.view === 'product-detail' && state.selectedProductId) {
      api.getReviews(state.selectedProductId).then(setReviews);
    }
  }, [state.view, state.user, state.selectedProductId]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesCategory = !state.activeFilters.category || p.category === state.activeFilters.category;
      const matchesMinPrice = state.activeFilters.minPrice === null || p.price >= state.activeFilters.minPrice;
      const matchesMaxPrice = state.activeFilters.maxPrice === null || p.price <= state.activeFilters.maxPrice;
      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });
  }, [products, state.searchQuery, state.activeFilters]);

  const actions = {
    search: (query: string, category?: Category, min?: number, max?: number) => {
      setState(prev => ({ 
        ...prev, 
        view: 'search', 
        searchQuery: query, 
        activeFilters: { 
          ...prev.activeFilters, 
          category: category || null,
          minPrice: min ?? null,
          maxPrice: max ?? null
        } 
      }));
    },
    addToCart: async (idOrName: string, qty: number = 1) => {
      if (!state.user) {
        showNotify("Login Required", "Please log in to add items to your cart.", Lock, 'error');
        setState(prev => ({ ...prev, view: 'login' }));
        return;
      }
      if (!state.user.isVerified) {
        showNotify("Verification Required", "Verify your email before shopping.", ShieldAlert, 'error');
        setState(prev => ({ ...prev, view: 'verify-email' }));
        return;
      }
      const product = products.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
      if (!product) return;
      await api.addToCart(state.user.id, product.id, qty);
      const newCart = await api.getCart(state.user.id);
      setState(prev => ({ ...prev, cart: newCart }));
      showNotify("Added to Cart", `${product.name} added.`, ShoppingCart, 'success');
    },
    viewProduct: (idOrName: string) => {
      const product = products.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
      if (product) setState(prev => ({ ...prev, view: 'product-detail', selectedProductId: product.id }));
    },
    viewOrder: (orderId: string) => {
      setState(prev => ({ ...prev, view: 'order-detail', selectedOrderId: orderId }));
    },
    navigateTo: (view: AppView) => setState(prev => ({ ...prev, view })),
    updateProfile: async (p: Partial<User>) => {
      if (state.user) {
        await api.updateProfile(state.user.id, p);
        const updated = await api.getUser(state.user.id);
        setState(prev => ({ ...prev, user: updated }));
        localStorage.setItem('nexshop_user', JSON.stringify(updated));
        showNotify("Profile Updated", "Your changes have been saved.", CheckCircle, 'success');
      }
    },
    postReview: async (productId: string, rating: number, comment: string) => {
      if (state.user) {
        await api.submitReview(productId, { user_id: state.user.id, user_name: state.user.name, rating, comment, date: new Date().toISOString() });
        api.getReviews(productId).then(setReviews);
        showNotify("Review Posted", "Thank you for your feedback!", Star, 'success');
      }
    },
    updateOrderStatus: async (id: string, status: string) => {
      await api.updateOrderStatus(id, status);
      if (state.user) {
        const fetched = await api.getSellerOrders(state.user.id);
        setOrders(fetched);
      }
    },
    addProduct: async (p: Partial<Product>) => {
      const newProduct: Product = {
        id: Math.random().toString(36).substr(2, 9),
        name: p.name || 'Untitled',
        description: p.description || '',
        price: p.price || 0,
        category: (p.category as Category) || 'Electronics',
        image: p.image || `https://picsum.photos/seed/${Math.random()}/400/400`,
        rating: 5,
        specs: p.specs || [],
        seller_id: state.user?.id || 's1',
        seller_name: state.user?.name || 'Nex Seller'
      };
      setProducts(prev => [newProduct, ...prev]);
      showNotify("Product Added", "Listing is now live.", Package, 'success');
    },
    compareProduct: (id: string) => {
      setState(prev => ({
        ...prev,
        compareList: prev.compareList.includes(id) ? prev.compareList : [...prev.compareList, id]
      }));
    },
    login: () => setState(prev => ({ ...prev, view: 'login' })),
    checkout: async () => {
      if (!state.user) {
        showNotify("Authentication Error", "Login is required to checkout.", Lock, 'error');
        setState(prev => ({ ...prev, view: 'login' }));
        return;
      }
      if (!state.user.isVerified) {
        showNotify("Verification Required", "Verify your email to continue checkout.", ShieldCheck, 'error');
        setState(prev => ({ ...prev, view: 'verify-email' }));
        return;
      }
      if (state.cart.length === 0) {
        showNotify("Empty Cart", "Add items to your cart before checking out.", ShoppingCart, 'error');
        return;
      }
      if (!state.user?.address || !state.user?.cardNumber) {
        showNotify("Incomplete Profile", "Shipping address and card number are required.", MapPin, 'error');
        setState(prev => ({ ...prev, view: 'profile' }));
        return;
      }
      setIsProcessingPayment(true);
      try {
        const paymentMethod = 'Visa **** ' + state.user.cardNumber.slice(-4);
        await api.checkout(state.user.id, state.user.address, paymentMethod, state.cart);
        await api.clearCart(state.user.id);
        await refreshOrders();
        setState(prev => ({ ...prev, view: 'checkout-success', cart: [] }));
      } catch (err) {
        showNotify("Checkout Failed", (err as Error).message, AlertCircle, 'error');
      } finally {
        setIsProcessingPayment(false);
      }
    },
    setSellerTab: (tab: 'analytics' | 'orders' | 'inventory') => setSellerTab(tab)
  };

  const handleEmailLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    setIsAuthenticating(true);
    try {
      const user = await api.login({ email, password });
      setState(prev => ({ ...prev, user, view: 'home' }));
      localStorage.setItem('nexshop_user', JSON.stringify(user));
      showNotify("Welcome Back", `Logged in as ${user.name}`, UserIconSmall, 'success');
    } catch (err: any) {
      showNotify("Login Failed", err.message, ShieldAlert, 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleEmailRegister = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    setIsAuthenticating(true);
    try {
      const res = await api.register({ email, password, name });
      showNotify("Verification Sent", `Code: ${res.token}. Please enter it to verify.`, Mail, 'info');
      setState(prev => ({ ...prev, view: 'verify-email' }));
    } catch (err: any) {
      showNotify("Registration Error", err.message, ShieldAlert, 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const handleVerify = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const token = formData.get('token') as string;
    try {
      await api.verifyEmail(token);
      showNotify("Success!", "Account verified. You can now log in.", CheckCircle, 'success');
      setState(prev => ({ ...prev, view: 'login' }));
    } catch (err: any) {
      showNotify("Verification Failed", err.message, ShieldAlert, 'error');
    }
  };

  const selectedProduct = products.find(p => p.id === state.selectedProductId);
  const selectedOrder = orders.find(o => o.id === state.selectedOrderId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {notification && (
        <div className={`fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-sm p-5 rounded-[24px] shadow-2xl flex items-start gap-4 animate-in slide-in-from-top-12 duration-500 ${
            notification.type === 'error' ? 'bg-red-50 text-red-900 border border-red-200' : 
            notification.type === 'success' ? 'bg-green-50 text-green-900 border border-green-200' : 'bg-slate-900 text-white'
        }`}>
          <div className={`p-2.5 rounded-xl ${notification.type === 'error' ? 'bg-red-500 text-white' : notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-indigo-500 text-white'}`}>
              <notification.icon size={20}/>
          </div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm">{notification.message}</h4>
            <p className="text-xs opacity-80 leading-relaxed">{notification.sub}</p>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-black/5 rounded-lg"><X size={16}/></button>
        </div>
      )}

      {(isAuthenticating || isProcessingPayment) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{isAuthenticating ? 'Authenticating...' : 'Processing Payment...'}</h3>
              <p className="text-sm text-slate-500">Wait a moment please.</p>
            </div>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 glass-morphism border-b px-4 py-3 sm:px-8 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => actions.navigateTo('home')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold">N</div>
          <span className="text-xl font-bold tracking-tight">NexShop</span>
        </div>

        <div className="hidden md:flex flex-1 max-w-xl mx-8">
          <div className="w-full relative">
            <input 
              type="text" placeholder="Search premium tech..." 
              className="w-full bg-slate-100 border-none rounded-full px-12 py-2.5 text-sm focus:ring-2 focus:ring-indigo-500/10"
              value={state.searchQuery}
              onChange={(e) => actions.search(e.target.value)}
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          </div>
        </div>

        <div className="flex items-center gap-3">
          {state.user ? (
             <>
               {state.user.role === 'buyer' ? (
                 <button onClick={() => actions.updateProfile({ role: 'seller' })} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border px-4 py-2 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm">
                   <Store size={14}/> Start Selling
                 </button>
               ) : (
                 <button onClick={() => actions.navigateTo('seller-dashboard')} className={`flex items-center gap-2 text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full shadow-sm transition-all ${state.view === 'seller-dashboard' ? 'bg-slate-900 text-white' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>
                    <BarChart3 size={14}/> Console
                 </button>
               )}
             </>
          ) : (
            <button onClick={() => actions.navigateTo('login')} className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white border px-4 py-2 rounded-full hover:bg-indigo-50 hover:text-indigo-600 transition-all shadow-sm">
              <Store size={14}/> Become a Seller
            </button>
          )}

          <button onClick={() => actions.navigateTo('orders')} className={`p-2.5 transition-colors ${state.view === 'orders' ? 'text-indigo-600' : 'text-slate-400 hover:text-indigo-600'}`} title="Orders">
            <ClipboardCheck className="w-5 h-5" />
          </button>
          
          <button className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => actions.navigateTo('cart')}>
            <ShoppingCart className="w-5 h-5" />
            {state.cart.length > 0 && <span className="absolute top-1 right-1 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{state.cart.length}</span>}
          </button>
          
          {state.user ? (
            <div className="flex items-center gap-2 pl-2 border-l">
              <button onClick={() => actions.navigateTo('profile')} className={`flex items-center gap-2 bg-white border px-3 py-1.5 rounded-full shadow-sm hover:border-indigo-200 transition-colors ${state.view === 'profile' ? 'border-indigo-500' : ''}`}>
                <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-[10px]">{state.user.name.charAt(0)}</div>
                <span className="text-xs font-semibold hidden sm:inline">{state.user.name.split(' ')[0]}</span>
              </button>
              <button onClick={() => { localStorage.removeItem('nexshop_user'); setState(prev => ({ ...prev, user: null, view: 'home' })); }} className="p-2 text-slate-400 hover:text-red-500">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => actions.navigateTo('login')} className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold">Login</button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {state.view === 'seller-dashboard' && state.user && (
          <div className="space-y-10 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div className="space-y-1">
                <h1 className="text-4xl font-black tracking-tight">Seller Console</h1>
                <p className="text-slate-500">Welcome back, {state.user.name}. Manage your store presence.</p>
              </div>
              <div className="flex bg-slate-200/50 p-1.5 rounded-2xl gap-1">
                 {(['analytics', 'orders', 'inventory'] as const).map(tab => (
                   <button 
                    key={tab}
                    onClick={() => setSellerTab(tab)}
                    className={`px-6 py-2 rounded-xl text-xs font-bold capitalize transition-all ${sellerTab === tab ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
                   >
                     {tab}
                   </button>
                 ))}
              </div>
            </div>

            {sellerTab === 'analytics' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-widest">Total Sales</span>
                    <TrendingUp size={16}/>
                  </div>
                  <div className="text-4xl font-black text-slate-900">$12,482.00</div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-3/4"></div>
                  </div>
                  <p className="text-[10px] text-green-600 font-bold">+12% from last month</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-widest">Active Orders</span>
                    <PackageOpen size={16}/>
                  </div>
                  <div className="text-4xl font-black text-slate-900">{orders.length}</div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-indigo-600 w-1/2"></div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">Fulfillment rate: 98%</p>
                </div>
                <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-4">
                  <div className="flex justify-between items-center text-slate-400">
                    <span className="text-[10px] font-black uppercase tracking-widest">Store Rating</span>
                    <Star size={16}/>
                  </div>
                  <div className="text-4xl font-black text-slate-900">4.9/5</div>
                  <div className="h-1 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-yellow-400 w-full"></div>
                  </div>
                  <p className="text-[10px] text-slate-400 font-bold">Based on 142 reviews</p>
                </div>
              </div>
            )}

            {sellerTab === 'orders' && (
              <div className="bg-white border rounded-[40px] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Order ID</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Customer</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                        <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {orders.map(o => (
                        <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-8 py-6 font-mono text-xs">{o.id}</td>
                          <td className="px-8 py-6 font-bold text-sm">Customer ID: {o.user_id.slice(0, 8)}...</td>
                          <td className="px-8 py-6 font-bold text-indigo-600">${o.total.toFixed(2)}</td>
                          <td className="px-8 py-6">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${
                              o.status === 'Delivered' ? 'bg-green-50 text-green-600 border-green-100' : 
                              o.status === 'Shipped' ? 'bg-blue-50 text-blue-600 border-blue-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                            }`}>
                              {o.status}
                            </span>
                          </td>
                          <td className="px-8 py-6 text-right space-x-2">
                             <button onClick={() => actions.updateOrderStatus(o.id, 'Shipped')} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-white rounded-xl transition-all"><Truck size={16}/></button>
                             <button onClick={() => actions.updateOrderStatus(o.id, 'Delivered')} className="p-2 text-slate-400 hover:text-green-600 hover:bg-white rounded-xl transition-all"><CheckCircle size={16}/></button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {orders.length === 0 && <div className="p-20 text-center text-slate-400 italic">No incoming orders yet.</div>}
                </div>
              </div>
            )}

            {sellerTab === 'inventory' && (
              <div className="space-y-8">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-black">Your Listings</h3>
                  <button onClick={() => {
                    const name = prompt("Product Name?");
                    const price = parseFloat(prompt("Price?") || "0");
                    const category = prompt("Category? (Electronics, Gaming, Audio, Workstation, Accessories)") as any;
                    if (name && price) actions.addProduct({ name, price, category });
                  }} className="bg-indigo-600 text-white px-6 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-2 hover:scale-105 transition-all shadow-lg shadow-indigo-100">
                    <ListPlus size={16}/> Add New Product
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
                  {products.filter(p => p.seller_id === state.user?.id).map(p => (
                    <div key={p.id} className="bg-white border p-6 rounded-[32px] flex items-center gap-6 group">
                       <img src={p.image} className="w-20 h-20 rounded-2xl object-cover" />
                       <div className="flex-1">
                         <h4 className="font-bold text-sm">{p.name}</h4>
                         <p className="text-xs text-slate-400">${p.price}</p>
                       </div>
                       <button className="p-2 text-slate-300 hover:text-red-500 rounded-xl hover:bg-red-50 transition-all"><Trash2 size={16}/></button>
                    </div>
                  ))}
                  {products.filter(p => p.seller_id === state.user?.id).length === 0 && (
                    <div className="col-span-full py-20 border-2 border-dashed rounded-[40px] text-center text-slate-400">
                      You haven't listed any products yet.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {state.view === 'login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center"><Lock size={32}/></div>
              <h1 className="text-3xl font-black">Welcome Back</h1>
            </div>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <input name="email" type="email" placeholder="Email Address" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              <input name="password" type="password" placeholder="Password" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Sign In</button>
            </form>
            <p className="text-center text-sm text-slate-500">New here? <button onClick={() => actions.navigateTo('register')} className="text-indigo-600 font-bold hover:underline">Create Account</button></p>
          </div>
        )}

        {state.view === 'register' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center"><Plus size={32}/></div>
              <h1 className="text-3xl font-black">Join NexShop</h1>
            </div>
            <form onSubmit={handleEmailRegister} className="space-y-4">
              <input name="name" type="text" placeholder="Full Name" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              <input name="email" type="email" placeholder="Email Address" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              <input name="password" type="password" placeholder="Password" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Register</button>
            </form>
          </div>
        )}

        {state.view === 'verify-email' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in duration-500">
             <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-3xl mx-auto flex items-center justify-center"><CheckCircle size={32}/></div>
              <h1 className="text-3xl font-black">Verify Email</h1>
              <p className="text-slate-500 text-sm">Enter the code from your notification.</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <input name="token" type="text" placeholder="Enter Token" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-indigo-500/20" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Verify</button>
            </form>
          </div>
        )}

        {state.view === 'home' && (
          <div className="space-y-12">
            <div className="relative h-96 rounded-[40px] overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-transparent flex flex-col justify-center p-12">
                <h1 className="text-6xl font-black text-white max-w-xl leading-tight mb-6">Future Tech. <span className="text-indigo-500">NexShop.</span></h1>
                <p className="text-slate-300 text-lg max-w-md mb-8">Secure your workspace with next-gen retail technology.</p>
                <button onClick={() => actions.navigateTo('search')} className="bg-white text-slate-900 self-start px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-transform">Explore Catalog</button>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={actions.addToCart} onClick={actions.viewProduct} onCompare={actions.compareProduct} />)}
            </div>
          </div>
        )}

        {state.view === 'profile' && state.user && (
          <div className="max-w-2xl mx-auto space-y-10 animate-in fade-in duration-500">
             <div className="space-y-2">
                <h1 className="text-4xl font-black">Your Profile</h1>
                <p className="text-slate-500">Complete your profile to enable checkout.</p>
             </div>

             <form className="space-y-6" onSubmit={(e) => {
               e.preventDefault();
               const formData = new FormData(e.currentTarget);
               actions.updateProfile({
                 name: formData.get('name') as string,
                 address: formData.get('address') as string,
                 cardNumber: formData.get('cardNumber') as string
               });
             }}>
               <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                 <div className="grid grid-cols-1 gap-4">
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Full Name</label>
                       <input name="name" defaultValue={state.user.name} required className="w-full bg-slate-100 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Shipping Address</label>
                       <textarea name="address" rows={3} defaultValue={state.user.address} placeholder="Enter full shipping details..." required className="w-full bg-slate-100 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                    <div>
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1.5 block">Payment Card Number</label>
                       <input name="cardNumber" maxLength={16} defaultValue={state.user.cardNumber} placeholder="1234567812345678" required className="w-full bg-slate-100 border-none rounded-2xl px-6 py-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
                    </div>
                 </div>
               </div>
               <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-3xl font-bold text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-2 shadow-lg">
                 <Save size={20}/> Save Changes
               </button>
             </form>
          </div>
        )}

        {state.view === 'orders' && (
          <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            <h1 className="text-4xl font-black">My Orders</h1>
            {orders.length === 0 ? <p className="text-slate-400 text-center py-10 italic">Your order history is empty.</p> : (
              <div className="grid grid-cols-1 gap-4">
                {orders.map(o => (
                  <div 
                    key={o.id} 
                    onClick={() => actions.viewOrder(o.id)}
                    className="bg-white p-6 rounded-[32px] border hover:border-indigo-500 transition-all cursor-pointer flex justify-between items-center group"
                  >
                    <div className="flex items-center gap-6">
                      <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-900 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Package size={20}/>
                      </div>
                      <div>
                        <h4 className="font-bold text-slate-900">Order #{o.id}</h4>
                        <p className="text-xs text-slate-400">{new Date(o.date).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-lg">${o.total.toFixed(2)}</div>
                      <span className="text-[10px] font-black uppercase tracking-widest px-2 py-1 bg-indigo-50 text-indigo-600 rounded-lg">{o.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.view === 'order-detail' && selectedOrder && (
          <div className="max-w-4xl mx-auto space-y-10 animate-in fade-in duration-500">
            <button onClick={() => actions.navigateTo('orders')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-indigo-600 font-bold">
              <ArrowLeft size={16}/> Back to History
            </button>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
               <div className="space-y-2">
                 <h1 className="text-4xl font-black tracking-tight">Order Details</h1>
                 <p className="text-slate-500 flex items-center gap-2"><Calendar size={14}/> ID: {selectedOrder.id} • {new Date(selectedOrder.date).toLocaleString()}</p>
               </div>
               <div className="px-4 py-2 bg-green-50 text-green-600 rounded-xl font-bold text-xs uppercase tracking-widest border border-green-100">
                 {selectedOrder.status}
               </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-4">
                 <div className="bg-white border rounded-[32px] overflow-hidden shadow-sm">
                   <div className="bg-slate-50 px-8 py-4 border-b">
                     <h3 className="text-xs font-black uppercase tracking-widest text-slate-500">Items Ordered</h3>
                   </div>
                   <div className="divide-y">
                     {selectedOrder.items.map((item, idx) => (
                       <div key={idx} className="px-8 py-6 flex items-center gap-6">
                         <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover" />
                         <div className="flex-1">
                           <h4 className="font-bold">{item.product.name}</h4>
                           <p className="text-xs text-slate-400">Sold by {item.product.seller_name}</p>
                         </div>
                         <div className="text-right">
                           <div className="font-bold text-indigo-600">${item.price.toFixed(2)}</div>
                           <div className="text-xs text-slate-400">Qty: {item.quantity}</div>
                         </div>
                       </div>
                     ))}
                   </div>
                   <div className="bg-slate-50 px-8 py-6 border-t flex justify-between items-center">
                     <span className="font-bold text-slate-500 uppercase text-xs tracking-widest">Grand Total</span>
                     <span className="text-2xl font-black text-indigo-600">${selectedOrder.total.toFixed(2)}</span>
                   </div>
                 </div>
              </div>

              <div className="space-y-6">
                 <div className="bg-white border rounded-[32px] p-6 space-y-4 shadow-sm">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900"><MapPin size={18} className="text-indigo-600"/> Delivery To</h3>
                    <p className="text-sm text-slate-500 leading-relaxed whitespace-pre-wrap">{selectedOrder.shipping_address}</p>
                 </div>
                 <div className="bg-white border rounded-[32px] p-6 space-y-4 shadow-sm">
                    <h3 className="font-bold flex items-center gap-2 text-slate-900"><CardIcon size={18} className="text-indigo-600"/> Payment Method</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{selectedOrder.payment_method}</p>
                 </div>
              </div>
            </div>
          </div>
        )}

        {state.view === 'checkout-success' && (
           <div className="max-w-xl mx-auto py-20 text-center space-y-8 animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
               <CheckCircle size={48} />
             </div>
             <div className="space-y-4">
               <h1 className="text-4xl font-black">Payment Confirmed</h1>
               <p className="text-slate-500">Order recorded. The seller is preparing your premium tech for dispatch.</p>
             </div>
             <div className="flex gap-4 justify-center">
               <button onClick={() => actions.navigateTo('orders')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold hover:scale-105 transition-transform">View Order History</button>
               <button onClick={() => actions.navigateTo('home')} className="bg-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-bold hover:bg-slate-200 transition-all">Go Home</button>
             </div>
           </div>
        )}

        {state.view === 'product-detail' && selectedProduct && (
           <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-in fade-in duration-500">
             <div className="aspect-square rounded-[40px] overflow-hidden bg-white shadow-xl">
               <img src={selectedProduct.image} className="w-full h-full object-cover" />
             </div>
             <div className="space-y-8 py-4">
               <div className="space-y-4">
                 <h1 className="text-5xl font-black text-slate-900 leading-tight">{selectedProduct.name}</h1>
                 <p className="text-slate-500 text-lg leading-relaxed">{selectedProduct.description}</p>
                 <div className="text-4xl font-bold text-indigo-600">${selectedProduct.price}</div>
               </div>
               <button onClick={() => actions.addToCart(selectedProduct.id)} className="w-full bg-slate-900 text-white py-5 rounded-3xl font-bold text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                 <ShoppingCart size={24} /> Add to Cart
               </button>
             </div>
           </div>
        )}

        {state.view === 'cart' && (
           <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in duration-300">
             <h1 className="text-3xl font-bold">Shopping Cart</h1>
             {state.cart.length === 0 ? <p className="text-slate-400 text-center py-10 italic">Empty cart. Browse our premium catalog to add items.</p> : (
               <div className="bg-white border rounded-[40px] p-8 space-y-6 shadow-sm">
                 {state.cart.map(item => (
                   <div key={item.product.id} className="flex justify-between items-center border-b pb-4">
                     <div className="flex items-center gap-4">
                       <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover" />
                       <div className="font-bold">{item.product.name} (x{item.quantity})</div>
                     </div>
                     <div className="font-bold text-indigo-600">${(item.product.price * item.quantity).toFixed(2)}</div>
                   </div>
                 ))}
                 <div className="flex justify-between items-center py-4">
                   <span className="font-bold text-slate-500 uppercase tracking-widest text-xs">Grand Total</span>
                   <span className="text-2xl font-black text-slate-900">${state.cart.reduce((a,c) => a + (c.product.price * c.quantity), 0).toFixed(2)}</span>
                 </div>
                 <button onClick={actions.checkout} className="w-full bg-indigo-600 text-white py-5 rounded-3xl font-bold text-lg hover:scale-105 transition-all shadow-xl shadow-indigo-100">
                    Proceed to Checkout
                 </button>
               </div>
             )}
           </div>
        )}
      </main>

      <AIAgent 
        actions={{...actions}} 
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

const ProductCard: React.FC<{ product: Product; onClick: (id: string) => void; onAdd: (id: string) => void; onCompare: (id: string) => void }> = ({ product, onClick, onAdd, onCompare }) => (
  <div className="bg-white rounded-[32px] border p-4 space-y-4 hover:shadow-2xl hover:shadow-indigo-500/5 transition-all cursor-pointer group" onClick={() => onClick(product.id)}>
    <div className="aspect-square rounded-2xl overflow-hidden bg-slate-50 relative">
      <img src={product.image} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
      <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-indigo-600 uppercase tracking-widest border shadow-sm">
        {product.seller_name}
      </div>
    </div>
    <div className="space-y-1.5 px-1">
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-bold text-base leading-tight line-clamp-1 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
        <span className="text-indigo-600 font-black text-sm">${product.price}</span>
      </div>
    </div>
    <button 
      onClick={(e) => { e.stopPropagation(); onAdd(product.id); }}
      className="w-full py-3.5 bg-slate-900 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-600 transition-all active:scale-95 shadow-lg shadow-indigo-500/0 hover:shadow-indigo-500/20"
    >
      Quick Add
    </button>
  </div>
);

export default App;
