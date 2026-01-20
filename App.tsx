
import React, { useState, useEffect, useMemo } from 'react';
import { ShoppingCart, Search, Home, User as UserIcon, Star, Filter, ArrowRight, X, LogOut, Loader2, Store, CheckCircle, Plus, BarChart3, ClipboardList, RefreshCcw, Scale, Trash2, Edit, CreditCard, ShieldCheck, Truck, Sparkles, Hash, MapPin, Package, Clock, MessageCircle, PlayCircle, ShieldAlert } from 'lucide-react';
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
    // Auto-run tests once on mount for "every change" simulation
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

  const handleLogin = () => {
    setIsAuthenticating(true);
    setTimeout(async () => {
      const user = await api.getUser('user_dev_1');
      setState(prev => ({ ...prev, user }));
      localStorage.setItem('nexshop_user', JSON.stringify(user));
      setIsAuthenticating(false);
    }, 800);
  };

  const handleCheckout = async () => {
    if (!state.user) {
      alert("Login is mandatory to checkout!");
      handleLogin();
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
  };

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
        handleLogin();
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
    login: handleLogin,
    checkout: handleCheckout
  };

  const handleRunTests = () => {
    runFunctionalTests(setTestResults, actions);
  };

  const selectedProduct = products.find(p => p.id === state.selectedProductId);
  const cartTotal = state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0);
  const compareProducts = products.filter(p => state.compareList.includes(p.id));

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Background Overlay for Loading State */}
      {(isAuthenticating || isProcessingPayment) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-[32px] shadow-2xl flex flex-col items-center gap-4 text-center max-w-xs">
            <Loader2 className="w-10 h-10 text-indigo-600 animate-spin" />
            <div className="space-y-1">
              <h3 className="font-bold text-lg">{isAuthenticating ? 'Nex is authenticating...' : 'Processing Payment...'}</h3>
              <p className="text-sm text-slate-500">{isAuthenticating ? 'Securing your high-end tech workspace.' : 'Finalizing your luxury curated purchase.'}</p>
            </div>
          </div>
        </div>
      )}

      {/* Diagnostics / Test Panel */}
      {showTests && (
        <div className="fixed top-20 right-8 z-[60] w-72 bg-white border shadow-2xl rounded-3xl overflow-hidden animate-in slide-in-from-right duration-300">
          <div className="bg-slate-900 p-4 text-white flex items-center justify-between">
            <span className="text-xs font-black uppercase tracking-widest flex items-center gap-2"><ShieldAlert size={14} className="text-indigo-400"/> System Diagnostics</span>
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
          <button onClick={() => setShowTests(!showTests)} className="p-2.5 text-slate-400 hover:text-indigo-600 transition-colors" title="System Status">
            <ShieldCheck className="w-5 h-5" />
          </button>
          <button className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => actions.navigateTo('compare')} title="Compare">
            <Scale className="w-5 h-5" />
            {state.compareList.length > 0 && <span className="absolute -top-1 -right-1 bg-indigo-500 w-4 h-4 rounded-full text-[10px] text-white flex items-center justify-center">{state.compareList.length}</span>}
          </button>
          <button className="p-2.5 text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => actions.navigateTo('seller-dashboard')}>
            <Store className="w-5 h-5" />
          </button>
          <button className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full" onClick={() => actions.navigateTo('cart')}>
            <ShoppingCart className="w-5 h-5" />
            {state.cart.length > 0 && <span className="absolute top-1 right-1 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">{state.cart.length}</span>}
          </button>
          
          {state.user ? (
            <div className="flex items-center gap-2 pl-2 border-l">
              <button onClick={() => actions.navigateTo('profile')} className="flex items-center gap-2 bg-white border px-3 py-1.5 rounded-full shadow-sm hover:border-indigo-200 transition-colors">
                <div className="w-6 h-6 bg-indigo-600 text-white rounded-full flex items-center justify-center font-bold text-[10px]">{state.user.name.charAt(0)}</div>
                <span className="text-xs font-semibold">{state.user.name.split(' ')[0]}</span>
              </button>
              <button onClick={() => { localStorage.removeItem('nexshop_user'); setState(prev => ({ ...prev, user: null })); }} className="p-2 text-slate-400 hover:text-red-500 transition-colors">
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button onClick={handleLogin} className="bg-slate-900 text-white px-6 py-2 rounded-full text-xs font-bold hover:bg-indigo-600 transition-all">Login</button>
          )}
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
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
                  <button onClick={() => alert("Nex is ready! Click the bot icon below.")} className="bg-slate-900/50 backdrop-blur-md text-white border border-white/20 px-8 py-4 rounded-2xl font-bold hover:bg-white hover:text-slate-900 transition-all">Talk to Nex</button>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold flex items-center gap-2"><Sparkles className="text-indigo-500" /> AI Recommendations</h2>
              <div className="flex gap-2">
                {['All', 'Electronics', 'Gaming', 'Audio'].map(c => (
                  <button key={c} onClick={() => actions.search('', c === 'All' ? undefined : c as Category)} className="px-5 py-2 rounded-full border text-sm font-semibold hover:bg-white hover:shadow-md transition-all">
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredProducts.map(p => <ProductCard key={p.id} product={p} onAdd={actions.addToCart} onClick={actions.viewProduct} onCompare={actions.compareProduct} />)}
            </div>
          </div>
        )}

        {state.view === 'checkout-success' && (
           <div className="max-w-xl mx-auto py-20 text-center space-y-8 animate-in zoom-in-95 duration-500">
             <div className="w-24 h-24 bg-green-100 text-green-600 rounded-full mx-auto flex items-center justify-center">
               <CheckCircle size={48} />
             </div>
             <div className="space-y-4">
               <h1 className="text-4xl font-black">Purchase Successful!</h1>
               <p className="text-slate-500">Your curated tech gear is on its way. Sellers have been notified and Nex is tracking your delivery.</p>
             </div>
             <div className="flex gap-4 justify-center">
               <button onClick={() => actions.navigateTo('orders')} className="bg-indigo-600 text-white px-8 py-3 rounded-2xl font-bold">Track Order</button>
               <button onClick={() => actions.navigateTo('home')} className="bg-slate-100 text-slate-900 px-8 py-3 rounded-2xl font-bold">Back Home</button>
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
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="space-y-6">
              <div className="aspect-square rounded-[40px] overflow-hidden bg-white shadow-xl">
                <img src={selectedProduct.image} className="w-full h-full object-cover" />
              </div>
            </div>
            <div className="space-y-8 py-4">
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <span className="bg-indigo-100 text-indigo-700 text-[10px] font-bold uppercase px-3 py-1 rounded-full">{selectedProduct.category}</span>
                  <div className="flex items-center gap-1 text-yellow-500 text-xs font-bold">
                    <Star size={14} fill="currentColor" /> {selectedProduct.rating} (24 Reviews)
                  </div>
                </div>
                <h1 className="text-5xl font-black text-slate-900 leading-tight">{selectedProduct.name}</h1>
                <p className="text-slate-500 text-lg leading-relaxed">{selectedProduct.description}</p>
                <div className="text-4xl font-bold text-indigo-600">${selectedProduct.price}</div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => actions.addToCart(selectedProduct.id)} className="bg-slate-900 text-white py-5 rounded-3xl font-bold text-lg hover:bg-indigo-600 transition-all flex items-center justify-center gap-3">
                  <ShoppingCart size={24} /> Add to Cart
                </button>
                <button onClick={() => actions.compareProduct(selectedProduct.id)} className="bg-white border-2 border-slate-900 py-5 rounded-3xl font-bold text-lg hover:bg-slate-50 transition-all flex items-center justify-center gap-3">
                  <Scale size={24} /> Compare
                </button>
              </div>

              <div className="border-t pt-8 space-y-6">
                <h3 className="text-xl font-bold flex items-center gap-2"><ClipboardList size={20} /> Specifications</h3>
                <div className="grid grid-cols-2 gap-y-4 text-sm">
                  {selectedProduct.specs.map(s => <div key={s} className="flex items-center gap-3 text-slate-600 font-medium"><CheckCircle size={16} className="text-indigo-500" /> {s}</div>)}
                </div>
              </div>
            </div>
          </div>
        )}

        {state.view === 'cart' && (
          <div className="max-w-3xl mx-auto space-y-8">
            <h1 className="text-3xl font-bold">Your Cart</h1>
            {state.cart.length === 0 ? <p className="text-slate-400">Your cart is empty. Start exploring our collections!</p> : (
              <div className="bg-white border rounded-[40px] p-8 space-y-6 shadow-sm">
                {state.cart.map(item => (
                  <div key={item.product.id} className="flex justify-between items-center border-b pb-4">
                    <div className="flex items-center gap-4">
                      <img src={item.product.image} className="w-16 h-16 rounded-xl object-cover" />
                      <div>
                        <div className="font-bold">{item.product.name}</div>
                        <div className="text-xs text-slate-400">Qty: {item.quantity} • Sold by: {item.product.seller_name}</div>
                      </div>
                    </div>
                    <div className="font-bold text-lg">${(item.product.price * item.quantity).toFixed(2)}</div>
                  </div>
                ))}
                <div className="flex justify-between text-2xl font-bold pt-4">
                  <span>Total</span>
                  <span>${cartTotal.toFixed(2)}</span>
                </div>
                <button onClick={handleCheckout} className="w-full bg-indigo-600 text-white py-4 rounded-2xl font-bold hover:bg-indigo-700 transition-all">
                  Checkout
                </button>
              </div>
            )}
          </div>
        )}

        {state.view === 'orders' && (
           <div className="max-w-4xl mx-auto space-y-8">
            <h1 className="text-4xl font-black">My Orders</h1>
            {orders.length === 0 ? <p className="text-slate-400">No active or past orders found.</p> : (
              <div className="space-y-6">
                {orders.map(order => (
                  <div key={order.id} className="bg-white border rounded-[32px] p-6 shadow-sm overflow-hidden relative">
                    <div className="flex justify-between items-start border-b pb-4 mb-4">
                      <div>
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Order ID</div>
                        <div className="font-mono text-sm">#{order.id.slice(0,8).toUpperCase()}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">Placed On</div>
                        <div className="text-sm font-bold">{new Date(order.date).toLocaleDateString()}</div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-50 rounded-xl border flex items-center justify-center"><Package size={20} className="text-indigo-400" /></div>
                            <div>
                              <div className="font-bold text-sm">{item.product_name}</div>
                              <div className="text-[10px] text-slate-400 uppercase tracking-widest">Seller: {item.seller_id}</div>
                            </div>
                          </div>
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${order.status === 'Delivered' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                            {order.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {state.view === 'profile' && state.user && (
          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 animate-in fade-in duration-500">
            <div className="space-y-6">
               <div className="bg-white p-8 rounded-[40px] border shadow-sm text-center space-y-4">
                 <div className="w-24 h-24 bg-indigo-600 rounded-full mx-auto flex items-center justify-center text-white text-4xl font-black">{state.user.name.charAt(0)}</div>
                 <div>
                   <h2 className="text-xl font-bold">{state.user.name}</h2>
                   <p className="text-slate-400 text-sm uppercase font-bold tracking-widest">{state.user.role}</p>
                 </div>
                 <button onClick={() => actions.navigateTo('orders')} className="w-full bg-slate-100 py-3 rounded-2xl text-sm font-bold flex items-center justify-center gap-2"><Package size={16}/> View Orders</button>
               </div>
            </div>
            <div className="md:col-span-2 bg-white p-12 rounded-[40px] border shadow-sm space-y-8">
              <h1 className="text-3xl font-black">Profile Management</h1>
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="text-[10px] font-bold uppercase text-slate-400 mb-2 block">Shipping Address</label>
                  <textarea defaultValue={state.user.address} onChange={e => actions.updateProfile({ address: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm h-28 focus:ring-2 focus:ring-indigo-500/10" placeholder="Enter full address..."/>
                </div>
                <div className="col-span-2 pt-4 border-t">
                  <h3 className="font-bold flex items-center gap-2 text-indigo-600"><CreditCard size={18} /> Financial Details</h3>
                </div>
                <div className="col-span-2">
                  <input type="text" placeholder="Card Number" defaultValue={state.user.cardNumber} onChange={e => actions.updateProfile({ cardNumber: e.target.value })} className="w-full bg-slate-50 border-none rounded-2xl p-4 text-sm" />
                </div>
                <input type="text" placeholder="MM/YY" defaultValue={state.user.cardExpiry} onChange={e => actions.updateProfile({ cardExpiry: e.target.value })} className="bg-slate-50 border-none rounded-2xl p-4 text-sm" />
                <input type="text" placeholder="CVV" defaultValue={state.user.cardCvv} onChange={e => actions.updateProfile({ cardCvv: e.target.value })} className="bg-slate-50 border-none rounded-2xl p-4 text-sm" />
              </div>
              <p className="text-[10px] text-slate-400">Data is securely cached. NexShop uses bank-grade simulated encryption.</p>
            </div>
          </div>
        )}

        {state.view === 'seller-dashboard' && (
          <div className="space-y-8">
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Seller Central</h1>
              <div className="flex bg-slate-200 p-1 rounded-xl">
                {['analytics', 'orders'].map(t => (
                  <button key={t} onClick={() => setSellerTab(t as any)} className={`px-4 py-2 rounded-lg text-sm font-bold capitalize ${sellerTab === t ? 'bg-white shadow' : 'text-slate-500'}`}>{t}</button>
                ))}
              </div>
            </div>
            <div className="bg-white p-12 rounded-[40px] border text-center text-slate-500">
               <Store size={48} className="mx-auto mb-4 opacity-20" />
               <p className="font-bold">No active seller orders to display.</p>
               <p className="text-sm mt-2">Try adding a product or waiting for buyers to purchase your items.</p>
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
      <button 
        onClick={(e) => { e.stopPropagation(); onCompare(product.id); }}
        className="absolute top-3 right-3 p-2 bg-white/90 backdrop-blur-md rounded-full text-slate-400 hover:text-indigo-600 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <Scale size={14} />
      </button>
    </div>
    <div className="space-y-1.5 px-1">
      <div className="flex justify-between items-start gap-2">
        <h3 className="font-bold text-base leading-tight line-clamp-1 group-hover:text-indigo-600 transition-colors">{product.name}</h3>
        <span className="text-indigo-600 font-black text-sm">${product.price}</span>
      </div>
      <div className="flex items-center gap-1.5 text-yellow-500 text-[10px] font-black uppercase">
        <Star size={10} fill="currentColor" /> {product.rating} <span className="text-slate-300 ml-1">• (12)</span>
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
