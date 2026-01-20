
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Mic, Send, Loader2, AudioLines, ChevronDown, BrainCircuit, Globe } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { marketplaceTools, createChatSession, generateImage } from '../services/geminiService';
import { Category, AppView, User, Product, GroundingSource } from '../types';

interface AIAgentProps {
  actions: {
    search: (query: string, category?: Category, min?: number, max?: number) => void;
    addToCart: (productId: string, quantity?: number) => void;
    viewProduct: (productId: string) => void;
    navigateTo: (view: AppView) => void;
    addProduct: (p: Partial<Product>) => Promise<void>;
    updateProfile: (p: any) => Promise<void>;
    login: () => void;
    checkout: () => Promise<void>;
    setSellerTab: (tab: 'analytics' | 'orders' | 'inventory') => void;
  };
  currentCart: any[];
  products: Product[];
  user: User | null;
  currentView: AppView;
  selectedProductId: string | null;
  searchQuery: string;
  sellerTab: string;
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

const AIAgent: React.FC<AIAgentProps> = ({ actions, currentCart, products, user, currentView, selectedProductId, searchQuery, sellerTab }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string; sources?: GroundingSource[] }[]>([
    { role: 'bot', text: 'Hi! Nex here. Ask me about hardware trends or manage your store.' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen]);

  const getUIContext = () => {
    const selected = products.find(p => p.id === selectedProductId);
    const cartItems = currentCart.map(i => i.product.name).join(', ');
    const catalog = products.slice(0, 10).map(p => `${p.name} (ID: ${p.id})`).join(', ');
    return `View=${currentView}, UserRole=${user?.role || 'Guest'}, SelectedProd=${selected?.name || 'None'} (ID: ${selectedProductId || 'None'}), Cart=[${cartItems}], CatalogSample=[${catalog}].`;
  };

  const executeToolCall = async (fc: any) => {
    const act = actionsRef.current;
    try {
      if (fc.name === 'searchProducts') act.search(fc.args.query, fc.args.category);
      else if (fc.name === 'addToCart') act.addToCart(fc.args.productId, fc.args.quantity);
      else if (fc.name === 'viewProduct') act.viewProduct(fc.args.productId);
      else if (fc.name === 'navigateTo') act.navigateTo(fc.args.view as AppView);
      return { status: "success" };
    } catch (err) { return { status: "error", error: String(err) }; }
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping) return;
    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);
    try {
      if (!chatSessionRef.current) chatSessionRef.current = createChatSession(getUIContext());
      const response = await chatSessionRef.current.sendMessage({ message: userText });
      
      let sources: GroundingSource[] = [];
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
        sources = response.candidates[0].groundingMetadata.groundingChunks
          .map((chunk: any) => chunk.web ? { title: chunk.web.title, uri: chunk.web.uri } : null)
          .filter(Boolean) as GroundingSource[];
      }

      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          await executeToolCall(fc);
          setMessages(prev => [...prev, { role: 'bot', text: `Confirmed: ${fc.name} operation complete.`, tool: fc.name }]);
        }
      }
      if (response.text) setMessages(prev => [...prev, { role: 'bot', text: response.text, sources: sources.length > 0 ? sources : undefined }]);
    } catch (err) { setMessages(prev => [...prev, { role: 'bot', text: "Service error. Please try again." }]); }
    finally { setIsTyping(false); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {isOpen ? (
        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border flex flex-col w-[320px] h-[450px] pointer-events-auto animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-900 px-4 py-4 text-white flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Bot className="w-5 h-5 text-indigo-400" />
              <span className="font-bold text-xs">Nex Assistant</span>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg"><ChevronDown size={18}/></button>
          </div>
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[90%] p-3 rounded-2xl text-xs ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-700 shadow-sm'}`}>
                  {m.text}
                  {m.tool && <div className="mt-2 text-[8px] font-black text-indigo-500 uppercase flex items-center gap-1 border-t pt-1"><Sparkles size={10}/> {m.tool}</div>}
                </div>
                {m.sources && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.sources.map((s, si) => (
                      <a key={si} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-white border rounded-full text-[8px] font-bold text-slate-500 shadow-sm"><Globe size={8} className="inline mr-1"/>{s.title.slice(0, 15)}...</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && <div className="px-2 animate-pulse"><Loader2 size={12} className="animate-spin text-indigo-600" /></div>}
          </div>
          <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex gap-2">
            <input type="text" value={input} onChange={e => setInput(e.target.value)} placeholder="Search or command..." className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-2 text-xs focus:ring-2 focus:ring-indigo-500/10" />
            <button disabled={!input.trim() || isTyping} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg"><Send size={18}/></button>
          </form>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="pointer-events-auto w-14 h-14 bg-slate-900 text-white rounded-[24px] shadow-2xl flex items-center justify-center hover:scale-110 transition-all">
          <BrainCircuit size={28} />
        </button>
      )}
    </div>
  );
};

export default AIAgent;
