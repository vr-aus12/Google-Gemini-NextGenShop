
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Home, User as UserIcon, Star, Filter, ArrowRight, X, LogOut, Loader2, Store, CheckCircle, Plus, BarChart3, ClipboardList, RefreshCcw, Scale, Trash2, Edit, CreditCard, ShieldCheck, Truck, Sparkles, Hash, MapPin, Package, Clock, MessageCircle, PlayCircle, ShieldAlert, Mail, Lock, User as UserIconSmall, ArrowLeft, BellRing } from 'lucide-react';
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
  
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [showTests, setShowTests] = useState(false);
  const [notification, setNotification] = useState<{ message: string; sub: string; icon: any } | null>(null);

  const [state, setState] = useState<MarketplaceState>(() => {
    const savedUser = localStorage.getItem('nexshop_user');
    return {
      view: 'home',
      selectedProductId: null,
      searchQuery: '',
      activeFilters: { category: null, minPrice: null, maxPrice: null },
      cart: [],
      user: savedUser ? JSON.parse(savedUser) : null,
      compareList: []
    };
  });

  const refreshProducts = async () => {
    const fetched = await api.getProducts();
    if (fetched.length > 0) setProducts(fetched);
  };

  useEffect(() => {
    refreshProducts();
    if (state.user) {
      api.getCart(state.user.id).then(c => setState(prev => ({ ...prev, cart: c })));
    }
    handleRunTests();
  }, [state.user?.id]);

  useEffect(() => {
    if (state.view === 'orders' && state.user) {
      api.getMyOrders(state.user.id).then(setOrders);
    } else if (state.view === 'seller-dashboard' && state.user) {
      api.getSellerOrders(state.user.id).then(setOrders);
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
        alert("Login is mandatory to add items to your cart!");
        setState(prev => ({ ...prev, view: 'login' }));
        return;
      }
      if (!state.user.isVerified) {
        alert("Please verify your email before shopping!");
        setState(prev => ({ ...prev, view: 'verify-email' }));
        return;
      }
      const product = products.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
      if (!product) return;
      await api.addToCart(state.user.id, product.id, qty);
      const newCart = await api.getCart(state.user.id);
      setState(prev => ({ ...prev, cart: newCart }));
    },
    viewProduct: (idOrName: string) => {
      const product = products.find(p => p.id === idOrName || p.name.toLowerCase() === idOrName.toLowerCase());
      if (product) setState(prev => ({ ...prev, view: 'product-detail', selectedProductId: product.id }));
    },
    navigateTo: (view: AppView) => setState(prev => ({ ...prev, view })),
    updateProfile: async (p: Partial<User>) => {
      if (state.user) {
        await api.updateProfile(state.user.id, p);
        const updated = await api.getUser(state.user.id);
        setState(prev => ({ ...prev, user: updated }));
      }
    },
    postReview: async (productId: string, rating: number, comment: string) => {
      if (state.user) {
        await api.submitReview(productId, { user_id: state.user.id, user_name: state.user.name, rating, comment, date: new Date().toISOString() });
        api.getReviews(productId).then(setReviews);
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
        image: p.image || 'https://picsum.photos/seed/new/400/400',
        rating: 5,
        specs: p.specs || [],
        seller_id: state.user?.id || 's1',
        seller_name: state.user?.name || 'Nex Seller'
      };
      setProducts(prev => [newProduct, ...prev]);
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
        alert("Login is mandatory to checkout!");
        setState(prev => ({ ...prev, view: 'login' }));
        return;
      }
      if (!state.user.isVerified) {
        alert("Please verify your email before checkout!");
        setState(prev => ({ ...prev, view: 'verify-email' }));
        return;
      }
      if (state.cart.length === 0) {
        alert("Your cart is empty!");
        return;
      }
      if (!state.user?.address || !state.user?.cardNumber) {
        alert("Please update your profile with address and payment details first!");
        setState(prev => ({ ...prev, view: 'profile' }));
        return;
      }
      setIsProcessingPayment(true);
      await api.checkout(state.user.id, state.user.address, 'Visa **** ' + state.user.cardNumber.slice(-4));
      await api.clearCart(state.user.id);
      setState(prev => ({ ...prev, view: 'checkout-success', cart: [] }));
      setIsProcessingPayment(false);
    }
  };

  const handleRunTests = () => {
    runFunctionalTests(setTestResults, actions);
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
    } catch (err: any) {
      alert("Login failed: " + err.message);
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
      setNotification({
        message: "New Simulated Email",
        sub: `Verification Token: ${res.token}. Use this code to verify your account.`,
        icon: Mail
      });
      setState(prev => ({ ...prev, view: 'verify-email' }));
    } catch (err: any) {
      alert("Registration failed: " + err.message);
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
      alert("Verification successful! Please login.");
      setNotification(null);
      setState(prev => ({ ...prev, view: 'login' }));
    } catch (err: any) {
      alert("Verification failed: " + err.message);
    }
  };

  const handleGoogleLogin = () => {
    setIsAuthenticating(true);
    setTimeout(async () => {
      const user = await api.googleAuth({ 
        token: 'simulated_google_token',
        email: 'user@gmail.com',
        name: 'Google User'
      });
      setState(prev => ({ ...prev, user, view: 'home' }));
      localStorage.setItem('nexshop_user', JSON.stringify(user));
      setIsAuthenticating(false);
    }, 1200);
  };

  const cartTotal = state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
  const selectedProduct = products.find(p => p.id === state.selectedProductId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Mock Simulated Inbox Notification */}
      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-sm bg-slate-900 text-white p-5 rounded-[24px] shadow-2xl flex items-start gap-4 animate-in slide-in-from-top-12 duration-500">
          <div className="bg-indigo-500 p-2.5 rounded-xl"><notification.icon size={20}/></div>
          <div className="flex-1 space-y-1">
            <h4 className="font-bold text-sm">{notification.message}</h4>
            <p className="text-xs text-slate-400 leading-relaxed">{notification.sub}</p>
          </div>
          <button onClick={() => setNotification(null)} className="p-1 hover:bg-slate-800 rounded-lg"><X size={16}/></button>
        </div>
      )}

      {/* Background Overlay for Loading State */}
      {(isAuthenticating || isProcessingPayment) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{isAuthenticating ? 'Authenticating...' : 'Processing Payment...'}</h3>
              <p className="text-sm text-slate-500">Securing your premium tech workspace.</p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics Panel */}
      {showTests && (
        <div className="fixed top-20 right-8 z-[60] w-72 bg-white border shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={14} className="text-indigo-400"/> System Status</span>
            <button onClick={() => setShowTests(false)} className="hover:text-red-400"><X size={16}/></button>
          </div>
          <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
            {testResults.map((tr, i) => (
              <div key={i} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 font-medium">{tr.name}</span>
                <span className={`font-black uppercase tracking-tighter ${
                  tr.status === 'passed' ? 'text-green-500' : 
                  tr.status === 'failed' ? 'text-red-500' : 'text-blue-400 animate-pulse'
                }`}>{tr.status}</span>
              </div>
            ))}
          </div>
          <button onClick={handleRunTests} className="w-full bg-indigo-600 text-white py-3 text-xs font-bold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <RefreshCcw size={14} /> Re-run Functional Tests
          </button>
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
          <button onClick={() => setShowTests(!showTests)} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors">
            <ShieldCheck className="w-5 h-5" />
          </button>
          <button className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => actions.navigateTo('cart')}>
            <ShoppingCart className="w-5 h-5" />
            {state.cart.length > 0 && <span className="absolute top-1 right-1 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center font-bold">{state.cart.length}</span>}
          </button>
          
          {state.user ? (
            <div className="flex items-center gap-2 pl-2 border-l">
              <button onClick={() => actions.navigateTo('profile')} className="flex items-center gap-2 bg-white border px-3 py-1.5 rounded-full shadow-sm hover:border-indigo-200 transition-colors">
                <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-[10px]">{state.user.name.charAt(0)}</div>
                <span className="text-xs font-semibold">{state.user.name.split(' ')[0]}</span>
                {!state.user.isVerified && <span className="w-2 h-2 bg-red-500 rounded-full" title="Not Verified"></span>}
              </button>
              <button onClick={() => { localStorage.removeItem('nexshop_user'); setState(prev => ({ ...prev, user: null })); }} className="p-2 text-slate-400 hover:text-red-500">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={() => actions.navigateTo('login')} className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold">Login</button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {state.view === 'login' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center"><Lock size={32}/></div>
              <h1 className="text-3xl font-black">Welcome Back</h1>
              <p className="text-slate-500 text-sm">Secure access to your curated tech gear.</p>
            </div>
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input name="email" type="email" placeholder="Email Address" required className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input name="password" type="password" placeholder="Password" required className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Sign In</button>
            </form>
            <div className="relative py-4 text-center">
              <div className="absolute inset-0 flex items-center"><div className="w-full border-t"></div></div>
              <span className="relative px-4 bg-white text-slate-400 text-xs font-bold uppercase">or</span>
            </div>
            <button onClick={handleGoogleLogin} className="w-full bg-white border-2 border-slate-100 text-slate-700 py-4 rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-slate-50 transition-colors">
              <img src="https://www.google.com/favicon.ico" className="w-4 h-4" /> Continue with Google
            </button>
            <p className="text-center text-sm text-slate-500">New here? <button onClick={() => actions.navigateTo('register')} className="text-indigo-600 font-bold hover:underline">Create Account</button></p>
          </div>
        )}

        {state.view === 'register' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-indigo-100 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center"><Plus size={32}/></div>
              <h1 className="text-3xl font-black">Create Account</h1>
              <p className="text-slate-500 text-sm">Join the world's first AI-powered marketplace.</p>
            </div>
            <form onSubmit={handleEmailRegister} className="space-y-4">
              <div className="relative">
                <UserIconSmall className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input name="name" type="text" placeholder="Full Name" required className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input name="email" type="email" placeholder="Email Address" required className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input name="password" type="password" placeholder="Password" required className="w-full bg-slate-100 border-none rounded-2xl py-4 pl-12 pr-4 text-sm focus:ring-2 focus:ring-indigo-500/20" />
              </div>
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Register</button>
            </form>
            <p className="text-center text-sm text-slate-500">Already have an account? <button onClick={() => actions.navigateTo('login')} className="text-indigo-600 font-bold hover:underline">Sign In</button></p>
          </div>
        )}

        {state.view === 'verify-email' && (
          <div className="max-w-md mx-auto bg-white p-8 rounded-[40px] border shadow-2xl space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-green-100 text-green-600 rounded-3xl mx-auto flex items-center justify-center"><CheckCircle size={32}/></div>
              <h1 className="text-3xl font-black">Verify Email</h1>
              <p className="text-slate-500 text-sm">Enter the code sent to your simulated inbox above.</p>
            </div>
            <form onSubmit={handleVerify} className="space-y-4">
              <input name="token" type="text" placeholder="Enter Token" required className="w-full bg-slate-100 border-none rounded-2xl py-4 px-6 text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-indigo-500/20" />
              <button type="submit" className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-colors">Verify Account</button>
            </form>
            <button onClick={() => actions.navigateTo('login')} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-indigo-600 transition-colors">
              <ArrowLeft size={14}/> Back to Login
            </button>
          </div>
        )}

        {state.view === 'home' && (
          <div className="space-y-12">
            <div className="relative h-96 rounded-[40px] overflow-hidden group">
              <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-slate-900/80 to-transparent flex flex-col justify-center p-12">
                <div className="bg-indigo-600/20 backdrop-blur-md self-start px-4 py-1.5 rounded-full text-indigo-400 text-xs font-bold uppercase tracking-widest mb-4">New Arrivals 2024</div>
                <h1 className="text-6xl font-black text-white max-w-xl leading-tight mb-6">Future Tech. <br/><span className="text-indigo-500">Curated by AI.</span></h1>
                <p className="text-slate-300 text-lg max-w-md mb-8">Premium electronics delivered with the world's first AI shopping assistant.</p>
                <div className="flex gap-4">
                  <button onClick={() => actions.navigateTo('search')} className="bg-white text-slate-900 px-8 py-4 rounded-2xl font-bold hover:scale-105 transition-transform">Shop Collections</button>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={actions.addToCart} onClick={actions.viewProduct} onCompare={actions.compareProduct} />)}
            </div>
          </div>
        )}

        {state.view === 'search' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Search Results</h1>
              <p className="text-slate-500">{filteredProducts.length} items found</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} onClick={actions.viewProduct} onAdd={actions.addToCart} onCompare={actions.compareProduct} />)}
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
           <div className="max-w-3xl mx-auto space-y-8">
             <h1 className="text-3xl font-bold">Your Cart</h1>
             {state.cart.length === 0 ? <p className="text-slate-400 text-center py-10 italic">Empty cart. Start adding premium tech to see it here.</p> : (
               <div className="bg-white border rounded-[40px] p-8 space-y-6 shadow-sm">
                 {state.cart.map(item => (
                   <div key={item.product.id} className="flex justify-between items-center border-b pb-4">
                     <div className="flex items-center gap-4">
                       <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover" />
                       <div className="font-bold">{item.product.name} (x{item.quantity})</div>
                     </div>
                     <div className="font-bold">${(item.product.price * item.quantity).toFixed(2)}</div>
                   </div>
                 ))}
                 <button onClick={actions.checkout} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold">Checkout</button>
               </div>
             )}
           </div>
        )}

        {state.view === 'checkout-success' && (
           <div className="max-w-xl mx-auto py-20 text-center space-y-8 animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
               <CheckCircle size={48} />
             </div>
             <div className="space-y-4">
               <h1 className="text-4xl font-black">Order Placed!</h1>
               <p className="text-slate-500">Your curated tech gear is on its way. Sellers have been notified and Nex is tracking your delivery.</p>
             </div>
             <div className="flex gap-4 justify-center">
               <button onClick={() => actions.navigateTo('orders')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">Track Order</button>
               <button onClick={() => actions.navigateTo('home')} className="bg-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-bold">Back Home</button>
             </div>
           </div>
        )}

        {state.view === 'orders' && (
           <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl font-black">My Orders</h1>
            {orders.length === 0 ? <p className="text-slate-400 text-center py-10">No orders found yet.</p> : (
              <div className="space-y-4">
                {orders.map(o => (
                  <div key={o.id} className="bg-white p-6 rounded-3xl border shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-mono text-xs text-slate-400">#{o.id.toUpperCase()}</span>
                      <span className="text-xs font-bold bg-blue-100 text-blue-600 px-3 py-1 rounded-full">{o.status}</span>
                    </div>
                    <div className="flex justify-between font-bold">
                       <span>{o.items.length} items</span>
                       <span>${o.total.toFixed(2)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
           </div>
        )}

        {state.view === 'profile' && state.user && (
           <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
             <h1 className="text-4xl font-black">Your Profile</h1>
             <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
                <div className="flex items-center gap-4">
                   <div className="w-20 h-20 bg-indigo-600 rounded-full flex items-center justify-center text-white text-3xl font-black">{state.user.name.charAt(0)}</div>
                   <div>
                      <h2 className="text-xl font-bold">{state.user.name}</h2>
                      <p className="text-slate-400">{state.user.email}</p>
                   </div>
                </div>
                <div className="pt-6 border-t space-y-4">
                   <div>
                      <label className="text-xs font-bold uppercase text-slate-400 mb-1 block">Shipping Address</label>
                      <textarea 
                        defaultValue={state.user.address} 
                        onChange={(e) => actions.updateProfile({ address: e.target.value })}
                        className="w-full bg-slate-100 border-none rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/20" 
                        placeholder="Update your address..."
                      />
                   </div>
                </div>
             </div>
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
