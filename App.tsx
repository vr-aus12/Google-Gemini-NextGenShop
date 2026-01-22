
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ShoppingCart, Search, Home, User as UserIcon, Star, Filter, ArrowRight, X, LogOut, Loader2, Store, CheckCircle, Plus, RefreshCcw, Edit, CreditCard, ShieldCheck, Truck, Sparkles, MapPin, Package, Clock, ShieldAlert, Lock, ArrowLeft, BellRing, BrainCircuit, Wand2, Globe, Users, DollarSign, TrendingUp, Activity, PackageOpen, ChevronDown, Trash2, Presentation as PresentationIcon, HeartPulse, MessageSquareMore, AlertCircle, ShoppingBag, Settings, BadgeCheck, Mail, MapPinned, ChevronRight } from 'lucide-react';
import { MarketplaceState, AppView, Product, Category, CartItem, User, Order, Review, ChatSentiment } from './types';
import { DUMMY_PRODUCTS } from './constants';
import { api } from './services/api';
import AIAgent from './components/AIAgent';
import Presentation from './components/Presentation';
import { runFunctionalTests, TestResult } from './services/testRunner';

type AdminTab = 'users' | 'orders' | 'health' | 'sentiment';

const App: React.FC = () => {
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [sentiments, setSentiments] = useState<ChatSentiment[]>([]);
  const [adminTab, setAdminTab] = useState<AdminTab>('users');
  const [healthResults, setHealthResults] = useState<TestResult[]>([]);
  const [isTesting, setIsTesting] = useState(false);
  const [notification, setNotification] = useState<{ message: string; sub: string; icon: any; type?: 'info' | 'error' | 'success' } | null>(null);
  
  const notifyTimeoutRef = useRef<number | null>(null);

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
    if (notifyTimeoutRef.current) clearTimeout(notifyTimeoutRef.current);
    setNotification({ message, sub, icon, type });
    if (type !== 'error') {
      notifyTimeoutRef.current = window.setTimeout(() => setNotification(null), 5000);
    }
  };

  const refreshData = async () => {
    try {
      const fetchedProds = await api.getProducts();
      setProducts(fetchedProds);
      
      if (state.user) {
        const cart = await api.getCart(state.user.id);
        const updatedUser = await api.getUser(state.user.id);
        
        setState(prev => ({ 
          ...prev, 
          cart, 
          user: { ...updatedUser, isLoggedIn: true } 
        }));
        
        if (state.view === 'admin' || state.view === 'orders') {
          if (adminTab === 'orders' || state.view === 'orders') {
            const fetchedOrders = state.user.role === 'admin' ? await api.getAllOrders() : await api.getMyOrders(state.user.id);
            setOrders(fetchedOrders);
          }
          if (adminTab === 'users') {
            const fetchedUsers = await api.getAllUsers();
            setAllUsers(fetchedUsers);
          }
          if (adminTab === 'sentiment') {
            const fetchedSentiments = await api.getAllSentiments();
            setSentiments(fetchedSentiments);
          }
        }
      }
    } catch (err) {
      console.error("Data refresh failed", err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [state.view, adminTab]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesCategory = !state.activeFilters.category || p.category === state.activeFilters.category;
      return matchesSearch && matchesCategory;
    });
  }, [products, state.searchQuery, state.activeFilters]);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === state.selectedProductId);
  }, [products, state.selectedProductId]);

  const actions = {
    search: (query: string, category?: Category, min?: number, max?: number) => {
        setState(prev => ({ 
            ...prev, 
            view: 'search', 
            searchQuery: query, 
            activeFilters: { 
                category: category || null, 
                minPrice: min || null, 
                maxPrice: max || null 
            } 
        }));
    },
    addToCart: async (id: string, qty: number = 1) => {
      if (!state.user) { actions.navigateTo('login'); return; }
      const prod = products.find(p => p.id === id || p.name.toLowerCase().includes(id.toLowerCase()));
      if (prod) {
        await api.addToCart(state.user.id, prod.id, qty);
        refreshData();
        showNotify("Added to Cart", `${prod.name} added.`, ShoppingCart, 'success');
      }
    },
    viewProduct: (id: string) => setState(prev => ({ ...prev, view: 'product-detail', selectedProductId: id })),
    navigateTo: (view: AppView) => setState(prev => ({ ...prev, view })),
    logout: () => {
      localStorage.removeItem('nexshop_user');
      setState(prev => ({ ...prev, user: null, view: 'home', cart: [] }));
      showNotify("Logged Out", "Session cleared.", LogOut, 'info');
    },
    login: () => actions.navigateTo('login'),
    checkout: async () => {
      if (!state.user || state.cart.length === 0) return;
      setIsProcessingPayment(true);
      try {
        await api.checkout(state.user.id, state.user.address || 'Default Address', 'Mock Payment', state.cart);
        await api.clearCart(state.user.id);
        setState(prev => ({ ...prev, view: 'checkout-success', cart: [] }));
        showNotify("Success", "Order placed!", Truck, "success");
      } catch (err) {
        showNotify("Checkout Failed", "Could not place order.", ShieldAlert, "error");
      } finally {
        setIsProcessingPayment(false);
      }
    },
    addProduct: async (p: any) => console.log('Mock Add Product', p),
    updateProfile: async (p: any) => {
       if (state.user) {
         await api.updateProfile(state.user.id, p);
         showNotify("Profile Updated", "Your information was saved.", ShieldCheck, "success");
         refreshData();
       }
    },
    setSellerTab: (t: any) => console.log('Mock setSellerTab', t)
  };

  const handleRunHealthCheck = async () => {
    setIsTesting(true);
    await runFunctionalTests((results) => {
      setHealthResults(results);
    }, actions);
    setIsTesting(false);
    showNotify("Health Check Complete", "System diagnostics finished.", HeartPulse, 'success');
  };

  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = data.get('email') as string;
    const password = data.get('password') as string;
    
    setIsAuthenticating(true);
    try {
      const user = await api.login({ email, password });
      setState(prev => ({ ...prev, user, view: user.role === 'admin' ? 'admin' : 'home' }));
      localStorage.setItem('nexshop_user', JSON.stringify(user));
      showNotify("Welcome Back", `Signed in as ${user.name}`, CheckCircle, "success");
    } catch(err: any) {
      showNotify("Login Error", err.message, ShieldAlert, 'error');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const cartTotal = state.cart.reduce((acc, item) => acc + (item.product.price * item.quantity), 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {state.view === 'presentation' && <Presentation onClose={() => actions.navigateTo('home')} />}

      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[110] w-[90%] max-w-sm p-4 rounded-3xl shadow-2xl flex items-center gap-4 bg-slate-900 text-white border border-white/10 animate-in slide-in-from-top-4">
          <notification.icon size={20} className="text-indigo-400" />
          <div className="flex-1">
            <h4 className="font-bold text-xs">{notification.message}</h4>
            <p className="text-[10px] opacity-60">{notification.sub}</p>
          </div>
          <button onClick={() => setNotification(null)}><X size={14}/></button>
        </div>
      )}

      {(isAuthenticating || isProcessingPayment || isAnalyzing) && (
        <div className="fixed inset-0 z-[100] bg-slate-900/40 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white p-8 rounded-[40px] shadow-2xl flex flex-col items-center gap-4 text-center">
            <Loader2 className="animate-spin text-indigo-600" size={40}/>
            <p className="text-xs font-black uppercase tracking-widest animate-pulse">Processing...</p>
          </div>
        </div>
      )}

      <nav className="sticky top-0 z-40 glass-morphism border-b px-8 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => actions.navigateTo('home')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-black">N</div>
          <span className="text-lg font-black tracking-tight">NexShop</span>
        </div>
        <div className="flex items-center gap-6">
          <button onClick={() => actions.navigateTo('home')} className={`text-xs font-bold transition-colors ${state.view === 'home' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Market</button>
          <button onClick={() => actions.navigateTo('search')} className={`text-xs font-bold transition-colors ${state.view === 'search' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>Search</button>
          <button onClick={() => actions.navigateTo('presentation')} className={`text-xs font-bold transition-colors ${state.view === 'presentation' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'} flex items-center gap-1.5`}>Showcase <Sparkles size={12}/></button>
          {state.user?.role === 'admin' && <button onClick={() => actions.navigateTo('admin')} className={`text-xs font-bold transition-colors ${state.view === 'admin' ? 'text-indigo-600' : 'text-indigo-400'}`}>Admin HQ</button>}
          {state.user && <button onClick={() => actions.navigateTo('orders')} className={`text-xs font-bold transition-colors ${state.view === 'orders' ? 'text-indigo-600' : 'text-slate-500 hover:text-slate-800'}`}>My Orders</button>}
          {state.user ? (
            <div className="flex items-center gap-3">
              <button onClick={() => actions.navigateTo('profile')} className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${state.view === 'profile' ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600 hover:bg-indigo-200'}`}>{state.user.name.charAt(0)}</button>
              <button onClick={actions.logout} className="p-2 text-slate-400 hover:text-red-500 transition-colors"><LogOut size={16}/></button>
            </div>
          ) : (
            <button onClick={() => actions.navigateTo('login')} className="bg-slate-900 text-white px-5 py-2 rounded-full text-xs font-bold hover:bg-slate-800 transition-all">Login</button>
          )}
          <button onClick={() => actions.navigateTo('cart')} className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors">
            <ShoppingCart size={20}/>
            {state.cart.length > 0 && <span className="absolute top-0 right-0 w-4 h-4 bg-indigo-600 text-white text-[8px] rounded-full flex items-center justify-center animate-bounce">{state.cart.length}</span>}
          </button>
        </div>
      </nav>

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8">
        {state.view === 'login' && (
          <div className="max-w-md mx-auto bg-white p-10 rounded-[40px] border shadow-2xl space-y-8 mt-12 animate-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-2">
              <div className="w-16 h-16 bg-slate-50 text-indigo-600 rounded-3xl mx-auto flex items-center justify-center"><Lock size={32}/></div>
              <h1 className="text-3xl font-black">Welcome Back</h1>
              <p className="text-slate-400 text-sm italic">NexShop Private Access</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-4">
              <input name="email" type="email" placeholder="Email" required className="w-full bg-slate-50 rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/10 border-none transition-all" />
              <input name="password" type="password" placeholder="Password" required className="w-full bg-slate-50 rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/10 border-none transition-all" />
              <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-indigo-600 transition-all">Enter NexShop</button>
            </form>
            <div className="text-center">
              <button onClick={() => actions.navigateTo('home')} className="text-slate-400 text-xs hover:text-indigo-600 underline underline-offset-4">Back to Market</button>
            </div>
          </div>
        )}

        {state.view === 'profile' && state.user && (
          <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div className="flex items-center gap-6">
                   <div className="w-24 h-24 bg-indigo-900 rounded-[32px] flex items-center justify-center text-4xl text-white font-black shadow-2xl border-4 border-white">
                      {state.user.name.charAt(0)}
                   </div>
                   <div>
                      <h1 className="text-4xl font-black text-slate-900 tracking-tight">{state.user.name}</h1>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1 border border-indigo-100">
                           <BadgeCheck size={12}/> Verified {state.user.role}
                        </span>
                        <p className="text-slate-400 text-sm font-medium">{state.user.email}</p>
                      </div>
                   </div>
                </div>
                <button onClick={actions.logout} className="px-6 py-3 bg-white border-2 border-slate-100 rounded-2xl text-xs font-black uppercase text-slate-400 hover:text-red-500 hover:border-red-100 transition-all">Log Out Session</button>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                <div className="lg:col-span-2 space-y-8">
                   <div className="bg-white border rounded-[40px] p-10 space-y-8 shadow-sm">
                      <div className="flex items-center gap-3 text-slate-900">
                        <MapPinned className="text-indigo-600" size={24}/>
                        <h3 className="font-black text-lg tracking-tight">Shipping Logistics</h3>
                      </div>
                      <div className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest ml-1">Primary Delivery Address</label>
                            <textarea 
                               defaultValue={state.user.address} 
                               onBlur={(e) => actions.updateProfile({ address: e.target.value })}
                               className="w-full bg-slate-50 border-none rounded-3xl p-6 text-sm font-medium focus:ring-2 focus:ring-indigo-500/10 transition-all h-32" 
                               placeholder="Set your shipping destination..." 
                            />
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                           <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Country</p>
                              <p className="text-sm font-bold text-slate-900">United States</p>
                           </div>
                           <div className="p-6 bg-slate-50 rounded-[32px] border border-slate-100">
                              <p className="text-[10px] font-black uppercase text-slate-400 mb-1">Timezone</p>
                              <p className="text-sm font-bold text-slate-900">UTC-08:00 (Pacific)</p>
                           </div>
                         </div>
                      </div>
                   </div>

                   <div className="bg-white border rounded-[40px] p-10 shadow-sm flex items-center justify-between group cursor-pointer hover:border-indigo-100 transition-colors">
                      <div className="flex items-center gap-6">
                        <div className="w-14 h-14 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
                          <CreditCard size={28}/>
                        </div>
                        <div>
                          <h4 className="font-black text-slate-900">Payment Methods</h4>
                          <p className="text-xs text-slate-400">Manage your secure payment vaults</p>
                        </div>
                      </div>
                      <ChevronRight className="text-slate-200 group-hover:text-indigo-600 transition-all" size={24}/>
                   </div>
                </div>

                <div className="space-y-8">
                   <div className="bg-slate-900 rounded-[40px] p-10 text-white space-y-6 shadow-2xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full -mr-16 -mt-16 blur-2xl"></div>
                      <h4 className="text-xl font-black tracking-tight relative z-10">Nex Platinum</h4>
                      <p className="text-indigo-200 text-xs font-medium leading-relaxed relative z-10">As a NexShop Verified Member, you have early access to hardware drops and 24/7 priority Nex AI support.</p>
                      <div className="pt-4 border-t border-white/10 flex items-center justify-between relative z-10">
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Status</span>
                        <span className="text-xs font-black text-indigo-400">ACTIVE</span>
                      </div>
                   </div>

                   <div className="bg-white border rounded-[40px] p-10 space-y-6 shadow-sm">
                      <div className="flex items-center gap-3">
                         <ShieldCheck className="text-indigo-600" size={20}/>
                         <h4 className="font-black text-slate-900">Account Security</h4>
                      </div>
                      <div className="space-y-4">
                         <button className="w-full flex justify-between items-center py-3 px-1 border-b text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                            Change Passphrase
                            <ChevronRight size={14}/>
                         </button>
                         <button className="w-full flex justify-between items-center py-3 px-1 border-b text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors">
                            Two-Factor Auth
                            <span className="text-[8px] px-2 py-0.5 bg-slate-100 rounded text-slate-400">OFF</span>
                         </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {state.view === 'admin' && state.user?.role === 'admin' && (
          <div className="space-y-10 animate-in fade-in duration-500">
             <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                  <h1 className="text-4xl font-black tracking-tight">Admin HQ</h1>
                  <p className="text-slate-400 text-sm">System Management & Real-time Monitoring</p>
                </div>
                <div className="flex bg-white p-1 rounded-2xl border shadow-sm overflow-x-auto w-full md:w-auto">
                   {(['users', 'orders', 'health', 'sentiment'] as AdminTab[]).map(t => (
                     <button 
                        key={t} 
                        onClick={() => setAdminTab(t)} 
                        className={`px-6 py-2 rounded-xl text-xs font-bold uppercase transition-all whitespace-nowrap ${adminTab === t ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}>
                        {t}
                     </button>
                   ))}
                </div>
             </div>

             {adminTab === 'users' && (
               <div className="bg-white border rounded-[40px] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
                  <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Users size={18} className="text-indigo-600"/> Registered Users</h3>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase">{allUsers.length} Users</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/30"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="px-8 py-4">Name</th><th className="px-8 py-4">Role</th><th className="px-8 py-4">Status</th></tr></thead>
                      <tbody className="divide-y">
                        {allUsers.map(u => (
                          <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5">
                              <p className="font-bold text-slate-900">{u.name}</p>
                              <p className="text-[10px] font-normal text-slate-400">{u.email}</p>
                            </td>
                            <td className="px-8 py-5">
                              <span className={`px-2 py-1 rounded-lg text-[9px] font-bold uppercase ${u.role === 'admin' ? 'bg-indigo-900 text-white' : 'bg-slate-100 text-slate-600'}`}>{u.role}</span>
                            </td>
                            <td className="px-8 py-5">
                              {u.isVerified ? <CheckCircle className="text-green-500" size={16}/> : <Clock className="text-slate-300" size={16}/>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}

             {adminTab === 'orders' && (
               <div className="bg-white border rounded-[40px] overflow-hidden shadow-sm animate-in slide-in-from-bottom-4">
                  <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                    <h3 className="font-bold text-slate-800 flex items-center gap-2"><Package size={18} className="text-indigo-600"/> All Marketplace Orders</h3>
                    <span className="text-[10px] font-black bg-indigo-100 text-indigo-600 px-2 py-1 rounded-lg uppercase">{orders.length} Total</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="bg-slate-50/30"><tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest"><th className="px-8 py-4">ID</th><th className="px-8 py-4">Customer ID</th><th className="px-8 py-4">Total</th><th className="px-8 py-4">Status</th></tr></thead>
                      <tbody className="divide-y">
                        {orders.length > 0 ? orders.map(o => (
                          <tr key={o.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-8 py-5 font-mono text-xs text-slate-400">#{o.id.split('-')[1]}</td>
                            <td className="px-8 py-5 font-medium text-slate-600 text-xs">{o.user_id}</td>
                            <td className="px-8 py-5 font-black text-indigo-600">${o.total.toFixed(2)}</td>
                            <td className="px-8 py-5">
                               <span className="px-2 py-1 rounded-lg text-[9px] font-bold uppercase bg-amber-50 text-amber-600 border border-amber-100">{o.status}</span>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={4} className="px-8 py-12 text-center text-slate-400 italic">No orders found in database.</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
               </div>
             )}

             {adminTab === 'health' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="bg-indigo-900 rounded-[40px] p-12 text-white flex flex-col md:flex-row justify-between items-center gap-8 shadow-2xl relative overflow-hidden">
                     <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -mr-20 -mt-20 blur-3xl"></div>
                     <div className="space-y-4 relative z-10 text-center md:text-left">
                        <h2 className="text-4xl font-black tracking-tight">System Diagnostics</h2>
                        <p className="text-indigo-200 text-sm max-w-md">Run a full suite of automated functional tests to verify API integrity, authentication flows, and UI navigation persistence.</p>
                     </div>
                     <button 
                        onClick={handleRunHealthCheck} 
                        disabled={isTesting}
                        className="bg-white text-indigo-900 px-10 py-5 rounded-[28px] font-black shadow-xl hover:bg-indigo-50 transition-all flex items-center gap-3 relative z-10 disabled:opacity-50">
                        {isTesting ? <Loader2 size={24} className="animate-spin" /> : <HeartPulse size={24} />}
                        {isTesting ? 'Analyzing...' : 'Run Diagnostics'}
                     </button>
                  </div>

                  {healthResults.length > 0 && (
                    <div className="bg-white border rounded-[40px] overflow-hidden shadow-sm">
                       <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                         <h3 className="font-bold text-slate-800">Test Execution History</h3>
                         <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Environment: Local Persistent Storage</span>
                       </div>
                       <div className="divide-y">
                         {healthResults.map((res, i) => (
                           <div key={i} className="px-8 py-5 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
                              <div className="flex items-center gap-4">
                                 <div className={`p-2 rounded-xl ${res.status === 'passed' ? 'bg-green-50 text-green-600' : res.status === 'failed' ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                                    {res.status === 'passed' ? <CheckCircle size={18}/> : res.status === 'failed' ? <AlertCircle size={18}/> : <Loader2 size={18} className="animate-spin"/>}
                                 </div>
                                 <div>
                                    <p className="font-bold text-slate-900 text-sm">{res.name}</p>
                                    {res.error && <p className="text-[10px] text-red-500 font-mono mt-1">{res.error}</p>}
                                 </div>
                              </div>
                              <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg ${res.status === 'passed' ? 'bg-green-100 text-green-700' : res.status === 'failed' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'}`}>
                                 {res.status}
                              </span>
                           </div>
                         ))}
                       </div>
                    </div>
                  )}
               </div>
             )}

             {adminTab === 'sentiment' && (
               <div className="space-y-8 animate-in slide-in-from-bottom-4">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {[
                      { label: 'Avg Sentiment', value: '78%', icon: Sparkles, color: 'text-indigo-600', bg: 'bg-indigo-50' },
                      { label: 'Conversations', value: sentiments.length, icon: MessageSquareMore, color: 'text-amber-600', bg: 'bg-amber-50' },
                      { label: 'User Satisfaction', value: 'High', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' }
                    ].map((stat, i) => (
                      <div key={i} className="bg-white border rounded-[32px] p-8 flex items-center gap-6 shadow-sm">
                        <div className={`w-14 h-14 ${stat.bg} ${stat.color} rounded-2xl flex items-center justify-center`}><stat.icon size={28}/></div>
                        <div>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{stat.label}</p>
                          <p className="text-3xl font-black text-slate-900 leading-none mt-1">{stat.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-white border rounded-[40px] overflow-hidden shadow-sm">
                    <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50/50">
                      <h3 className="font-bold text-slate-800 flex items-center gap-2"><BrainCircuit size={18} className="text-indigo-600"/> AI Interaction Insights</h3>
                      <button onClick={() => refreshData()} className="text-[10px] font-black uppercase text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><RefreshCcw size={12}/> Sync Sentiments</button>
                    </div>
                    <div className="divide-y">
                      {sentiments.length > 0 ? sentiments.map(s => (
                        <div key={s.id} className="px-8 py-6 hover:bg-slate-50 transition-colors group">
                           <div className="flex justify-between items-start mb-4">
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center font-bold text-slate-500 text-xs">{s.user_name.charAt(0)}</div>
                                 <div>
                                    <h4 className="font-bold text-slate-900 text-sm">{s.user_name}</h4>
                                    <p className="text-[10px] text-slate-400">{new Date(s.timestamp).toLocaleString()}</p>
                                 </div>
                              </div>
                              <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm ${s.score === 'Positive' ? 'bg-green-500 text-white' : s.score === 'Negative' ? 'bg-red-500 text-white' : 'bg-slate-400 text-white'}`}>
                                 {s.score}
                              </span>
                           </div>
                           <div className="bg-slate-50 rounded-2xl p-4 border border-slate-100 group-hover:border-indigo-100 transition-colors">
                              <p className="text-xs text-slate-600 leading-relaxed italic">"{s.summary}"</p>
                              <div className="mt-2 pt-2 border-t border-slate-200 flex items-center gap-4">
                                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1"><MessageSquareMore size={10}/> {s.raw_messages} Messages</span>
                                 <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter flex items-center gap-1"><ShieldCheck size={10}/> Verified Session</span>
                              </div>
                           </div>
                        </div>
                      )) : (
                        <div className="px-8 py-20 text-center text-slate-400 italic">No chat interactions analyzed yet.</div>
                      )}
                    </div>
                  </div>
               </div>
             )}
          </div>
        )}

        {state.view === 'orders' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
             <div className="flex justify-between items-end">
               <h1 className="text-5xl font-black tracking-tight text-slate-900">Purchase History</h1>
               <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{orders.length} Total Orders</p>
             </div>
             <div className="space-y-6">
                {orders.length > 0 ? orders.map(o => (
                  <div key={o.id} className="bg-white border rounded-[40px] p-8 hover:shadow-xl transition-all group">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
                          <Package size={24} />
                        </div>
                        <div>
                          <h3 className="font-black text-slate-900">Order #{o.id.split('-')[1]}</h3>
                          <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{new Date(o.date).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="px-4 py-2 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-amber-50 text-amber-600 border border-amber-100">{o.status}</span>
                        <p className="text-2xl font-black text-slate-900">${o.total.toFixed(2)}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-4 pt-6 border-t border-slate-100">
                      {o.items.map((item, idx) => (
                        <div key={idx} className="flex items-center gap-3 bg-slate-50 px-4 py-2 rounded-2xl border">
                          <img src={item.product.image} className="w-8 h-8 rounded-lg object-cover" />
                          <p className="text-[10px] font-bold text-slate-600 truncate max-w-[100px]">{item.product.name}</p>
                          <span className="text-[8px] font-black bg-white px-2 py-0.5 rounded-md border text-slate-400">x{item.quantity}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )) : (
                  <div className="py-32 text-center bg-white border-2 border-dashed border-slate-200 rounded-[64px] space-y-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-full mx-auto flex items-center justify-center">
                        <ShoppingBag className="text-slate-300" size={48}/>
                    </div>
                    <div className="space-y-1">
                        <p className="text-slate-900 font-black text-xl">No orders found.</p>
                        <p className="text-slate-400 text-sm">Looks like you haven't made any purchases yet.</p>
                    </div>
                    <button onClick={() => actions.navigateTo('home')} className="bg-slate-900 text-white px-10 py-4 rounded-3xl font-bold uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">Explore Marketplace</button>
                  </div>
                )}
             </div>
          </div>
        )}

        {state.view === 'home' && (
          <div className="space-y-12 animate-in fade-in duration-700">
            <div className="relative h-[480px] rounded-[64px] overflow-hidden shadow-2xl group">
              <img src="https://images.unsplash.com/photo-1550745165-9bc0b252726f?q=80&w=2070&auto=format&fit=crop" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-1000" />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/10 to-transparent flex flex-col justify-end p-16">
                 <h1 className="text-7xl font-black text-white leading-tight tracking-tighter">Premium <span className="text-indigo-500">Hardware.</span></h1>
                 <p className="text-white/60 max-w-md mt-4 text-lg font-medium">Curated high-end tech for professionals and enthusiasts. AI-powered shopping at your fingertips.</p>
                 <button onClick={() => actions.navigateTo('search')} className="bg-white text-slate-900 self-start px-12 py-5 rounded-3xl font-black shadow-2xl mt-10 hover:bg-indigo-600 hover:text-white transition-all transform hover:-translate-y-1">Explore Marketplace</button>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-black text-slate-900">Featured Releases</h2>
              <button onClick={() => actions.navigateTo('search')} className="text-xs font-black uppercase tracking-widest text-indigo-600 flex items-center gap-2 hover:translate-x-1 transition-transform">See All <ArrowRight size={14}/></button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
              {products.slice(0, 8).map(p => (
                <div key={p.id} className="bg-white rounded-[40px] border p-6 space-y-4 hover:shadow-2xl transition-all cursor-pointer group" onClick={() => actions.viewProduct(p.id)}>
                   <div className="relative overflow-hidden rounded-[32px]">
                      <img src={p.image} className="aspect-square w-full object-cover group-hover:scale-110 transition-transform duration-500" />
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur px-3 py-1.5 rounded-2xl font-black text-[10px] shadow-sm">${p.price}</div>
                   </div>
                   <div className="flex justify-between items-start">
                     <div>
                       <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate w-[160px]">{p.name}</h4>
                       <p className="text-[10px] text-slate-400 font-black uppercase mt-1">Retailer: {p.seller_name}</p>
                     </div>
                     <div className="flex items-center gap-1 text-amber-500 font-bold text-[10px]">
                       <Star size={12} fill="currentColor"/> {p.rating}
                     </div>
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {state.view === 'product-detail' && selectedProduct && (
          <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
             <button onClick={() => actions.navigateTo('home')} className="flex items-center gap-2 text-xs font-black uppercase text-slate-400 hover:text-indigo-600 transition-all"><ArrowLeft size={16}/> Back to Catalog</button>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                <div className="relative">
                  <img src={selectedProduct.image} className="aspect-square w-full object-cover rounded-[64px] shadow-2xl border-4 border-white" />
                  <div className="absolute -bottom-6 -right-6 bg-indigo-600 text-white p-8 rounded-full shadow-2xl animate-bounce">
                    <Sparkles size={32}/>
                  </div>
                </div>
                <div className="space-y-10 flex flex-col justify-center">
                   <div className="space-y-4">
                      <div className="flex gap-2">
                        <span className="text-indigo-600 text-[10px] font-black uppercase tracking-widest bg-indigo-50 px-4 py-1.5 rounded-full border border-indigo-100">{selectedProduct.category}</span>
                        <span className="text-amber-600 text-[10px] font-black uppercase tracking-widest bg-amber-50 px-4 py-1.5 rounded-full border border-amber-100 flex items-center gap-1"><Star size={10} fill="currentColor"/> {selectedProduct.rating} Rating</span>
                      </div>
                      <h1 className="text-6xl font-black tracking-tight leading-none text-slate-900">{selectedProduct.name}</h1>
                      <p className="text-slate-400 text-sm font-medium italic">Authorized Distribution by {selectedProduct.seller_name}</p>
                   </div>
                   <p className="text-xl text-slate-600 leading-relaxed font-medium">{selectedProduct.description}</p>
                   <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400">Technical Specifications</h4>
                      <div className="flex flex-wrap gap-2">
                        {selectedProduct.specs.map(s => (
                          <span key={s} className="px-4 py-2 bg-slate-100 rounded-2xl text-xs font-bold text-slate-600 border border-slate-200">{s}</span>
                        ))}
                      </div>
                   </div>
                   <div className="flex items-center justify-between pt-10 border-t border-slate-200/60">
                      <div>
                        <p className="text-xs uppercase font-black text-slate-400 mb-1">MSRP Pricing</p>
                        <p className="text-5xl font-black text-slate-900 tracking-tighter">${selectedProduct.price}</p>
                      </div>
                      <button onClick={() => actions.addToCart(selectedProduct.id)} className="bg-slate-900 text-white px-16 py-6 rounded-[32px] font-black shadow-2xl hover:bg-indigo-600 transition-all hover:scale-105 active:scale-95 flex items-center gap-3">Add to Bag</button>
                   </div>
                </div>
             </div>
          </div>
        )}

        {state.view === 'search' && (
          <div className="space-y-12">
             <div className="relative max-w-3xl mx-auto group">
               <input type="text" value={state.searchQuery} onChange={e => actions.search(e.target.value)} placeholder="Search for hardware, components, gear..." className="w-full bg-white border-none rounded-[40px] py-8 px-16 text-lg shadow-2xl focus:ring-4 focus:ring-indigo-500/10 transition-all" />
               <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-indigo-600 transition-colors" size={28} />
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
                {filteredProducts.length > 0 ? filteredProducts.map(p => (
                  <div key={p.id} className="bg-white rounded-[48px] border p-6 space-y-4 hover:shadow-2xl transition-all cursor-pointer group" onClick={() => actions.viewProduct(p.id)}>
                     <img src={p.image} className="aspect-square w-full rounded-[40px] object-cover group-hover:scale-105 transition-transform duration-500" />
                     <div className="flex justify-between items-start">
                        <h4 className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors truncate w-[160px]">{p.name}</h4>
                        <span className="text-indigo-600 font-black">${p.price}</span>
                     </div>
                     <p className="text-[10px] text-slate-300 font-black uppercase tracking-widest">Authorized: {p.seller_name}</p>
                  </div>
                )) : (
                  <div className="col-span-full py-32 text-center space-y-4">
                    <Search size={64} className="mx-auto text-slate-200" />
                    <p className="text-slate-400 font-medium">No results found for "{state.searchQuery}"</p>
                    <button onClick={() => actions.search('')} className="text-indigo-600 font-black uppercase text-xs tracking-widest border-b-2 border-indigo-600 pb-1">Reset Search</button>
                  </div>
                )}
             </div>
          </div>
        )}

        {state.view === 'cart' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
             <div className="flex justify-between items-end">
               <h1 className="text-5xl font-black tracking-tight text-slate-900">Your Shopping Bag</h1>
               <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{state.cart.length} Items Selected</p>
             </div>
             
             {state.cart.length > 0 ? (
               <div className="space-y-6">
                 {state.cart.map(item => (
                   <div key={item.product.id} className="bg-white border-2 border-slate-100 rounded-[48px] p-8 flex items-center justify-between shadow-sm hover:border-indigo-100 hover:shadow-xl transition-all group">
                      <div className="flex items-center gap-10">
                        <img src={item.product.image} className="w-28 h-28 rounded-[32px] object-cover shadow-lg border-2 border-white group-hover:rotate-3 transition-transform" />
                        <div className="space-y-1">
                           <h4 className="text-xl font-black text-slate-900">{item.product.name}</h4>
                           <p className="text-indigo-600 font-black text-lg">${item.product.price} <span className="text-slate-300 text-[10px] ml-4 font-bold uppercase tracking-widest">Qty: {item.quantity}</span></p>
                           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Sold by {item.product.seller_name}</p>
                        </div>
                      </div>
                      <button onClick={() => api.clearCart(state.user!.id).then(() => refreshData())} className="p-5 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-full transition-all active:scale-90"><Trash2 size={24}/></button>
                   </div>
                 ))}
                 <div className="bg-slate-900 rounded-[56px] p-12 text-white flex flex-col md:flex-row justify-between items-center shadow-3xl gap-8">
                    <div className="text-center md:text-left">
                      <p className="text-xs uppercase font-black text-indigo-400 tracking-widest mb-2 opacity-80">Subtotal Balance</p>
                      <p className="text-6xl font-black tracking-tighter">${cartTotal.toFixed(2)}</p>
                    </div>
                    <button onClick={actions.checkout} className="bg-white text-slate-900 px-20 py-7 rounded-[40px] font-black shadow-2xl hover:bg-indigo-500 hover:text-white transition-all hover:scale-105 active:scale-95 text-lg">Complete Secure Checkout</button>
                 </div>
               </div>
             ) : (
               <div className="py-32 text-center bg-white border-2 border-dashed border-slate-200 rounded-[64px] space-y-6">
                 <div className="w-24 h-24 bg-slate-50 rounded-full mx-auto flex items-center justify-center">
                    <PackageOpen className="text-slate-300" size={48}/>
                 </div>
                 <div className="space-y-1">
                    <p className="text-slate-900 font-black text-xl">Your bag is currently empty.</p>
                    <p className="text-slate-400 text-sm">Add some items to get started with your purchase.</p>
                 </div>
                 <button onClick={() => actions.navigateTo('home')} className="bg-slate-900 text-white px-10 py-4 rounded-3xl font-bold uppercase text-xs tracking-widest hover:bg-indigo-600 transition-all">Explore Marketplace</button>
               </div>
             )}
          </div>
        )}

        {state.view === 'checkout-success' && (
          <div className="max-w-2xl mx-auto py-24 text-center space-y-10 animate-in zoom-in-95 duration-500">
             <div className="w-40 h-40 bg-green-50 text-green-500 rounded-full mx-auto flex items-center justify-center shadow-inner relative">
                <CheckCircle size={80} className="relative z-10"/>
                <div className="absolute inset-0 bg-green-500 rounded-full animate-ping opacity-10"></div>
             </div>
             <div className="space-y-4">
               <h1 className="text-5xl font-black tracking-tight text-slate-900">Order Successful</h1>
               <p className="text-slate-500 text-xl font-medium px-12">Your hardware gear is now being processed. We'll notify you when your elite package ships.</p>
             </div>
             <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => actions.navigateTo('home')} className="bg-slate-900 text-white px-10 py-5 rounded-3xl font-black shadow-xl hover:bg-indigo-600 transition-all">Continue Shopping</button>
                <button onClick={() => actions.navigateTo('orders')} className="bg-white border-2 border-slate-100 text-slate-600 px-10 py-5 rounded-3xl font-black hover:border-slate-300 transition-all">Track My Order</button>
             </div>
          </div>
        )}
      </main>

      <AIAgent actions={actions} currentCart={state.cart} products={products} user={state.user} currentView={state.view} selectedProductId={state.selectedProductId} searchQuery={state.searchQuery} sellerTab={'inventory'} />
    </div>
  );
};

export default App;
