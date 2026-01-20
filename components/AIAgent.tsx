
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Bot, Send, X, Minimize2, Maximize2, Sparkles, Loader2, Mic, MicOff } from 'lucide-react';
import { createChatSession, sendAgentMessage } from '../services/geminiService';
import { Category, AppView } from '../types';

interface AIAgentProps {
  actions: {
    search: (query: string, category?: Category, min?: number, max?: number) => void;
    addToCart: (productId: string, quantity?: number) => void;
    viewProduct: (productId: string) => void;
    navigateTo: (view: AppView) => void;
  };
  currentCart: any[];
  products: any[];
}

const AIAgent: React.FC<AIAgentProps> = ({ actions, currentCart, products }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string }[]>([
    { role: 'bot', text: 'Hello! I am Nex, your shopping assistant. How can I help you today?' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Maintain a persistent chat session to prevent re-initialization "hanging"
  const chatSession = useMemo(() => createChatSession(), []);

  // Web Speech API setup
  const recognition = useMemo(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = 'en-US';
      return rec;
    }
    return null;
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const toggleListening = () => {
    if (!recognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isListening) {
      recognition.stop();
    } else {
      setIsListening(true);
      recognition.start();
    }
  };

  useEffect(() => {
    if (!recognition) return;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setIsListening(false);
      // Auto-submit after voice recognition for smoother experience
      handleProcessMessage(transcript);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };
  }, [recognition]);

  const handleProcessMessage = async (msg: string) => {
    if (!msg.trim() || isTyping) return;

    const userMsg = msg.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const result = await sendAgentMessage(chatSession, userMsg);
      
      // Handle tool calls
      if (result.functionCalls && result.functionCalls.length > 0) {
        for (const call of result.functionCalls) {
          const { name, args } = call;
          
          if (name === 'searchProducts') {
            actions.search(args.query, args.category, args.minPrice, args.maxPrice);
            setMessages(prev => [...prev, { role: 'bot', text: `Searching for ${args.query || 'items'}...`, tool: 'search' }]);
          } else if (name === 'addToCart') {
            const product = products.find(p => p.id === args.productId || p.name.toLowerCase().includes(args.productId?.toLowerCase()));
            if (product) {
              actions.addToCart(product.id, args.quantity || 1);
              setMessages(prev => [...prev, { role: 'bot', text: `Added ${product.name} to your cart.`, tool: 'cart' }]);
            } else {
              setMessages(prev => [...prev, { role: 'bot', text: `I couldn't find that exact product to add.` }]);
            }
          } else if (name === 'viewProduct') {
            const product = products.find(p => p.id === args.productId || p.name.toLowerCase().includes(args.productId?.toLowerCase()));
            if (product) {
              actions.viewProduct(product.id);
              setMessages(prev => [...prev, { role: 'bot', text: `Opening ${product.name} for you.`, tool: 'view' }]);
            }
          } else if (name === 'navigateTo') {
            actions.navigateTo(args.view as AppView);
            setMessages(prev => [...prev, { role: 'bot', text: `Navigating to ${args.view}...`, tool: 'nav' }]);
          }
        }
      }

      // Handle plain text response
      if (result.text && result.text.trim()) {
        setMessages(prev => [...prev, { role: 'bot', text: result.text }]);
      }
    } catch (err) {
      console.error(err);
      setMessages(prev => [...prev, { role: 'bot', text: "I encountered a glitch. Let me try resetting." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleProcessMessage(input);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
      {isOpen ? (
        <div className={`glass-morphism rounded-3xl shadow-2xl overflow-hidden flex flex-col transition-all duration-300 ${isExpanded ? 'w-[450px] h-[650px]' : 'w-[350px] h-[500px]'}`}>
          {/* Header */}
          <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <Bot className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-sm">Nex AI Assistant</h3>
                <div className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-red-400 animate-pulse' : 'bg-green-400 agent-pulse'}`}></span>
                  <span className="text-[10px] font-medium text-indigo-100 uppercase tracking-wider">
                    {isListening ? 'LISTENING...' : 'ONLINE'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                  m.role === 'user' 
                  ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                  : 'bg-white text-slate-700 border rounded-tl-none shadow-sm'
                }`}>
                  {m.tool && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500 uppercase mb-1 tracking-wider">
                      <Sparkles className="w-3 h-3" /> System: {m.tool}
                    </div>
                  )}
                  {m.text}
                </div>
              </div>
            ))}
            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl rounded-tl-none border shadow-sm flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                  <span className="text-xs text-slate-400 italic">Thinking...</span>
                </div>
              </div>
            )}
          </div>

          {/* Footer Input */}
          <div className="p-4 bg-white border-t">
            <form onSubmit={handleSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={isListening ? "Listening..." : "Ask Nex anything..."}
                  className={`w-full bg-slate-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-indigo-500 pr-10 transition-all ${isListening ? 'placeholder-red-400' : ''}`}
                  disabled={isListening}
                />
                <button 
                  type="button"
                  onClick={toggleListening}
                  className={`absolute right-2 top-2 p-1.5 rounded-xl transition-all ${isListening ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-indigo-600 hover:bg-slate-200'}`}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              </div>
              <button 
                type="submit"
                disabled={!input.trim() || isTyping || isListening}
                className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:shadow-none"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
              <Sparkles className="w-3 h-3" /> Voice or type to search, navigate, or shop.
            </p>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all agent-pulse"
        >
          <Bot className="w-8 h-8" />
          <div className="absolute -top-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-slate-50"></div>
        </button>
      )}
    </div>
  );
};

export default AIAgent;
