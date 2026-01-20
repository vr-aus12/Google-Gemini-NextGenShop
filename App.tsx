
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { ShoppingCart, Search, Home, User, Star, Filter, ArrowRight, Package, X } from 'lucide-react';
import { MarketplaceState, AppView, Product, Category, CartItem } from './types';
import { DUMMY_PRODUCTS } from './constants';
import AIAgent from './components/AIAgent';

const App: React.FC = () => {
  const [state, setState] = useState<MarketplaceState>({
    view: 'home',
    selectedProductId: null,
    searchQuery: '',
    activeFilters: {
      category: null,
      minPrice: null,
      maxPrice: null
    },
    cart: [],
    user: null,
  });

  const filteredProducts = useMemo(() => {
    return DUMMY_PRODUCTS.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(state.searchQuery.toLowerCase()) || 
                           p.description.toLowerCase().includes(state.searchQuery.toLowerCase());
      const matchesCategory = !state.activeFilters.category || p.category === state.activeFilters.category;
      const matchesMin = !state.activeFilters.minPrice || p.price >= state.activeFilters.minPrice;
      const matchesMax = !state.activeFilters.maxPrice || p.price <= state.activeFilters.maxPrice;
      return matchesSearch && matchesCategory && matchesMin && matchesMax;
    });
  }, [state.searchQuery, state.activeFilters]);

  // Actions for the AI Agent to trigger
  const actions = {
    search: (query: string, category?: Category, min?: number, max?: number) => {
      setState(prev => ({
        ...prev,
        view: 'search',
        searchQuery: query || prev.searchQuery,
        activeFilters: {
          category: category || null,
          minPrice: min || null,
          maxPrice: max || null
        }
      }));
    },
    addToCart: (productId: string, quantity: number = 1) => {
      const product = DUMMY_PRODUCTS.find(p => p.id === productId);
      if (product) {
        setState(prev => {
          const existing = prev.cart.find(item => item.product.id === productId);
          if (existing) {
            return {
              ...prev,
              cart: prev.cart.map(item => 
                item.product.id === productId 
                ? { ...item, quantity: item.quantity + quantity } 
                : item
              )
            };
          }
          return { ...prev, cart: [...prev.cart, { product, quantity }] };
        });
      }
    },
    viewProduct: (productId: string) => {
      setState(prev => ({ ...prev, view: 'product-detail', selectedProductId: productId }));
    },
    navigateTo: (view: AppView) => {
      setState(prev => ({ ...prev, view }));
    }
  };

  const selectedProduct = useMemo(() => 
    DUMMY_PRODUCTS.find(p => p.id === state.selectedProductId), 
    [state.selectedProductId]
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Navbar */}
      <nav className="sticky top-0 z-40 glass-morphism border-b px-4 py-3 sm:px-8 flex items-center justify-between">
        <div 
          className="flex items-center gap-2 cursor-pointer group"
          onClick={() => actions.navigateTo('home')}
        >
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
            className="relative p-2 text-slate-600 hover:text-indigo-600 transition-colors"
            onClick={() => actions.navigateTo('cart')}
          >
            <ShoppingCart className="w-6 h-6" />
            {state.cart.length > 0 && (
              <span className="absolute top-0 right-0 bg-indigo-600 text-white text-[10px] w-4 h-4 rounded-full flex items-center justify-center">
                {state.cart.reduce((acc, i) => acc + i.quantity, 0)}
              </span>
            )}
          </button>
          <button className="hidden sm:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full hover:bg-slate-800 transition-colors">
            <User className="w-4 h-4" />
            <span>Login</span>
          </button>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-8 sm:px-8">
        {state.view === 'home' && (
          <div className="space-y-12">
            {/* Hero */}
            <section className="bg-indigo-600 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden">
              <div className="relative z-10 max-w-2xl">
                <h1 className="text-4xl sm:text-6xl font-bold leading-tight mb-6">Upgrade Your Digital Lifestyle.</h1>
                <p className="text-indigo-100 text-lg mb-8">Premium gaming peripherals and professional workstation essentials, curated by AI for your needs.</p>
                <button 
                  onClick={() => actions.navigateTo('search')}
                  className="bg-white text-indigo-600 px-8 py-4 rounded-full font-semibold hover:bg-indigo-50 transition-all flex items-center gap-2"
                >
                  Browse Now <ArrowRight className="w-5 h-5" />
                </button>
              </div>
              <div className="absolute top-0 right-0 w-1/2 h-full hidden lg:block">
                 <img src="https://picsum.photos/seed/tech/800/600" className="object-cover w-full h-full opacity-40 mix-blend-overlay" />
              </div>
            </section>

            {/* Featured Categories */}
            <section>
              <div className="flex justify-between items-center mb-8">
                <h2 className="text-2xl font-bold">Featured Products</h2>
                <div className="flex gap-2">
                  {['All', 'Gaming', 'Workstation', 'Audio'].map((cat) => (
                    <button 
                      key={cat}
                      onClick={() => actions.search('', cat === 'All' ? undefined : cat as Category)}
                      className="px-4 py-2 rounded-full border text-sm hover:border-indigo-500 hover:text-indigo-600 transition-all"
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {DUMMY_PRODUCTS.slice(0, 4).map(product => (
                  <ProductCard key={product.id} product={product} onProductClick={actions.viewProduct} onAddToCart={actions.addToCart} />
                ))}
              </div>
            </section>
          </div>
        )}

        {state.view === 'search' && (
          <div className="flex flex-col lg:flex-row gap-8">
            <aside className="w-full lg:w-64 space-y-8">
              <div>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Filter className="w-4 h-4" /> Filters
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-slate-500 mb-2 block">Category</label>
                    <div className="space-y-2">
                      {['Electronics', 'Gaming', 'Workstation', 'Audio'].map(cat => (
                        <label key={cat} className="flex items-center gap-2 text-sm cursor-pointer group">
                          <input 
                            type="checkbox" 
                            checked={state.activeFilters.category === cat}
                            onChange={() => actions.search(state.searchQuery, state.activeFilters.category === cat ? undefined : cat as Category)}
                            className="rounded text-indigo-600 focus:ring-indigo-500" 
                          />
                          <span className="group-hover:text-indigo-600">{cat}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-slate-500 mb-2 block">Price Range</label>
                    <div className="flex gap-2">
                      <input type="number" placeholder="Min" className="w-1/2 p-2 border rounded text-sm" />
                      <input type="number" placeholder="Max" className="w-1/2 p-2 border rounded text-sm" />
                    </div>
                  </div>
                </div>
              </div>
            </aside>
            <div className="flex-1">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-xl font-bold">{filteredProducts.length} Results for "{state.searchQuery || 'All'}"</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map(product => (
                  <ProductCard key={product.id} product={product} onProductClick={actions.viewProduct} onAddToCart={actions.addToCart} />
                ))}
              </div>
              {filteredProducts.length === 0 && (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                  <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium">No products found</h3>
                  <p className="text-slate-500">Try adjusting your filters or search query.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {state.view === 'product-detail' && selectedProduct && (
          <div className="bg-white rounded-3xl overflow-hidden shadow-sm border p-6 sm:p-12">
            <button 
              onClick={() => actions.navigateTo('search')}
              className="mb-8 text-slate-500 hover:text-indigo-600 flex items-center gap-1 transition-colors"
            >
              <ArrowRight className="w-4 h-4 rotate-180" /> Back to search
            </button>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              <div className="rounded-2xl overflow-hidden bg-slate-50">
                <img src={selectedProduct.image} alt={selectedProduct.name} className="w-full h-full object-cover" />
              </div>
              <div className="space-y-8">
                <div>
                  <div className="flex items-center gap-2 text-indigo-600 font-semibold mb-2">
                    <span className="uppercase text-xs tracking-widest">{selectedProduct.category}</span>
                  </div>
                  <h1 className="text-4xl font-bold mb-4">{selectedProduct.name}</h1>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="flex items-center gap-1 text-yellow-400">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className={`w-5 h-5 ${i < Math.floor(selectedProduct.rating) ? 'fill-current' : ''}`} />
                      ))}
                    </div>
                    <span className="text-slate-400 font-medium">{selectedProduct.rating} / 5.0 Rating</span>
                  </div>
                  <p className="text-slate-600 text-lg leading-relaxed">{selectedProduct.description}</p>
                </div>

                <div className="space-y-4">
                  <h3 className="font-bold">Key Specifications</h3>
                  <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedProduct.specs.map(spec => (
                      <li key={spec} className="flex items-center gap-2 text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                        {spec}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-8 border-t flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <span className="text-slate-400 text-sm block">Current Price</span>
                    <span className="text-4xl font-bold">${selectedProduct.price.toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => actions.addToCart(selectedProduct.id)}
                    className="w-full sm:w-auto bg-indigo-600 text-white px-12 py-4 rounded-full font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
                  >
                    Add to Cart
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {state.view === 'cart' && (
          <div className="max-w-4xl mx-auto">
            <h1 className="text-3xl font-bold mb-8">Your Shopping Cart</h1>
            {state.cart.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed">
                <ShoppingCart className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-medium">Your cart is empty</h3>
                <p className="text-slate-500 mb-8">Looks like you haven't added anything yet.</p>
                <button 
                  onClick={() => actions.navigateTo('home')}
                  className="bg-indigo-600 text-white px-8 py-3 rounded-full font-semibold hover:bg-indigo-700 transition-all"
                >
                  Start Shopping
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {state.cart.map(item => (
                  <div key={item.product.id} className="bg-white rounded-2xl p-4 border flex items-center gap-6">
                    <div className="w-24 h-24 bg-slate-50 rounded-xl overflow-hidden shrink-0">
                      <img src={item.product.image} className="w-full h-full object-cover" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold text-lg">{item.product.name}</h4>
                      <p className="text-slate-500 text-sm">{item.product.category}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-lg">${(item.product.price * item.quantity).toFixed(2)}</p>
                      <p className="text-slate-400 text-xs">{item.quantity} x ${item.product.price.toFixed(2)}</p>
                    </div>
                    <button className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                <div className="bg-slate-900 text-white rounded-3xl p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
                  <div>
                    <span className="text-slate-400 block mb-1">Total Amount</span>
                    <span className="text-3xl font-bold">${state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0).toFixed(2)}</span>
                  </div>
                  <button 
                    onClick={() => actions.navigateTo('checkout')}
                    className="w-full sm:w-auto bg-indigo-500 text-white px-12 py-4 rounded-full font-bold hover:bg-indigo-400 transition-all"
                  >
                    Proceed to Checkout
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {state.view === 'checkout' && (
          <div className="max-w-2xl mx-auto text-center py-20 bg-white rounded-3xl border shadow-sm">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-green-600 mx-auto mb-6">
              <Package className="w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold mb-4">Secure Checkout</h1>
            <p className="text-slate-500 mb-8">This is a demo marketplace. No actual transactions will occur.</p>
            <div className="bg-slate-50 rounded-2xl p-6 mb-8 text-left">
              <h3 className="font-bold mb-4">Summary</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0).toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Shipping</span>
                  <span className="text-green-600 font-bold uppercase">Free</span>
                </div>
                <div className="flex justify-between pt-2 border-t font-bold text-base">
                  <span>Total</span>
                  <span>${state.cart.reduce((acc, i) => acc + (i.product.price * i.quantity), 0).toFixed(2)}</span>
                </div>
              </div>
            </div>
            <button 
              onClick={() => alert('Order Placed (Demo)')}
              className="bg-slate-900 text-white px-12 py-4 rounded-full font-bold hover:bg-slate-800 transition-all w-full sm:w-auto"
            >
              Place Order
            </button>
          </div>
        )}
      </main>

      {/* Floating AI Agent */}
      <AIAgent actions={actions} currentCart={state.cart} products={DUMMY_PRODUCTS} />
    </div>
  );
};

const ProductCard: React.FC<{ 
  product: Product; 
  onProductClick: (id: string) => void; 
  onAddToCart: (id: string) => void;
}> = ({ product, onProductClick, onAddToCart }) => (
  <div className="group bg-white rounded-2xl overflow-hidden border border-slate-200 hover:border-indigo-300 transition-all hover:shadow-xl hover:shadow-indigo-50/50">
    <div 
      className="aspect-square bg-slate-50 relative overflow-hidden cursor-pointer"
      onClick={() => onProductClick(product.id)}
    >
      <img src={product.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
      <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase text-indigo-600">
        {product.category}
      </div>
    </div>
    <div className="p-5">
      <div className="flex justify-between items-start mb-2">
        <h3 
          className="font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"
          onClick={() => onProductClick(product.id)}
        >
          {product.name}
        </h3>
        <span className="font-bold text-slate-900">${product.price.toFixed(0)}</span>
      </div>
      <div className="flex items-center gap-1 text-yellow-400 mb-4">
        <Star className="w-4 h-4 fill-current" />
        <span className="text-xs font-bold text-slate-500">{product.rating}</span>
      </div>
      <button 
        onClick={() => onAddToCart(product.id)}
        className="w-full py-2.5 rounded-xl bg-slate-100 text-slate-900 font-semibold hover:bg-indigo-600 hover:text-white transition-all text-sm"
      >
        Add to Cart
      </button>
    </div>
  </div>
);

export default App;
