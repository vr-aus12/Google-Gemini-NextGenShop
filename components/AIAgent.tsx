
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Sparkles, Mic, MicOff, Send, Loader2, MessageSquare, AudioLines, ChevronDown, ChevronUp } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Chat } from '@google/genai';
import { marketplaceTools, createChatSession } from '../services/geminiService';
import { Category, AppView, User, Product } from '../types';

interface AIAgentProps {
  actions: {
    search: (query: string, category?: Category, min?: number, max?: number) => void;
    addToCart: (productId: string, quantity?: number) => void;
    viewProduct: (productId: string) => void;
    navigateTo: (view: AppView) => void;
    addProduct: (p: Partial<Product>) => Promise<void>;
    compareProduct: (id: string) => void;
    updateProfile: (p: any) => Promise<void>;
    postReview: (productId: string, rating: number, comment: string) => Promise<void>;
    updateOrderStatus: (orderId: string, status: string) => Promise<void>;
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
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array) {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const AIAgent: React.FC<AIAgentProps> = ({ 
  actions, 
  currentCart, 
  products, 
  user, 
  currentView, 
  selectedProductId,
  searchQuery,
  sellerTab
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLive, setIsLive] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string }[]>([
    { role: 'bot', text: 'Hi! Nex here. What do you need?' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const actionsRef = useRef(actions);
  const productsRef = useRef(products);
  const userRef = useRef(user);
  const currentCartRef = useRef(currentCart);
  const currentViewRef = useRef(currentView);
  const sellerTabRef = useRef(sellerTab);
  const selectedProductIdRef = useRef(selectedProductId);
  const searchQueryRef = useRef(searchQuery);

  useEffect(() => {
    actionsRef.current = actions;
    productsRef.current = products;
    userRef.current = user;
    currentCartRef.current = currentCart;
    currentViewRef.current = currentView;
    sellerTabRef.current = sellerTab;
    selectedProductIdRef.current = selectedProductId;
    searchQueryRef.current = searchQuery;
  }, [actions, products, user, currentCart, currentView, sellerTab, selectedProductId, searchQuery]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  const getUIContext = () => {
    return `View=${currentViewRef.current}, User=${userRef.current?.name || 'Guest'}, Cart Size=${currentCartRef.current.length}, Search='${searchQueryRef.current}', SelectedProdID=${selectedProductIdRef.current}. Role=${userRef.current?.role}. SellerTab=${sellerTabRef.current}.`;
  };

  const executeToolCall = async (fc: any) => {
    let toolResult: any = { status: "success" };
    const act = actionsRef.current;
    try {
      if (fc.name === 'searchProducts') {
        act.search(fc.args.query, fc.args.category, fc.args.minPrice, fc.args.maxPrice);
      } else if (fc.name === 'addToCart') {
        act.addToCart(fc.args.productId, fc.args.quantity);
      } else if (fc.name === 'viewProduct') {
        act.viewProduct(fc.args.productId);
      } else if (fc.name === 'navigateTo') {
        act.navigateTo(fc.args.view as AppView);
      } else if (fc.name === 'login') {
        act.login();
      } else if (fc.name === 'checkout') {
        await act.checkout();
      } else if (fc.name === 'updateProfile') {
        await act.updateProfile(fc.args);
      } else if (fc.name === 'postReview') {
        await act.postReview(fc.args.productId, fc.args.rating, fc.args.comment);
      } else if (fc.name === 'trackOrder') {
        act.navigateTo('orders');
      } else if (fc.name === 'setSellerOrderStatus') {
        await act.updateOrderStatus(fc.args.orderId, fc.args.status);
      } else if (fc.name === 'addProduct') {
        await act.addProduct(fc.args);
        act.navigateTo('seller-dashboard');
        act.setSellerTab('inventory');
      } else if (fc.name === 'manageInventory') {
        act.navigateTo('seller-dashboard');
        act.setSellerTab('inventory');
      } else if (fc.name === 'viewAnalytics') {
        act.navigateTo('seller-dashboard');
        act.setSellerTab('analytics');
      }
    } catch (err) {
      toolResult = { status: "error", message: String(err) };
    }
    return toolResult;
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isTyping || isLive) return;

    const userText = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userText }]);
    setIsTyping(true);

    try {
      if (!chatSessionRef.current) {
        chatSessionRef.current = createChatSession(getUIContext());
      }
      const response = await chatSessionRef.current.sendMessage({ message: userText });
      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          await executeToolCall(fc);
          setMessages(prev => [...prev, { role: 'bot', text: `Syncing: ${fc.name}...`, tool: fc.name }]);
        }
      }
      if (response.text) {
        setMessages(prev => [...prev, { role: 'bot', text: response.text }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Service error." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const stopLive = () => {
    if (inputAudioContextRef.current) inputAudioContextRef.current.close().catch(() => {});
    if (outputAudioContextRef.current) outputAudioContextRef.current.close().catch(() => {});
    if (sessionPromiseRef.current) sessionPromiseRef.current.then(s => s.close()).catch(() => {});
    sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
    sourcesRef.current.clear();
    setIsLive(false);
  };

  const startLive = async () => {
    if (isLive) { stopLive(); return; }
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const pcmBlob = createBlob(e.inputBuffer.getChannelData(0));
              sessionPromise.then(s => s.sendRealtimeInput({ media: pcmBlob }));
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const result = await executeToolCall(fc);
                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: result } }));
                setMessages(prev => [...prev, { role: 'bot', text: `Tool: ${fc.name}`, tool: fc.name }]);
              }
            }
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
              setMessages(prev => [...prev, { role: 'bot', text: message.serverContent?.modelTurn?.parts?.[0]?.text! }]);
            }
          },
          onerror: stopLive,
          onclose: stopLive
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
          tools: [{ functionDeclarations: marketplaceTools }],
          systemInstruction: `You are Nex. Keep responses brief. ${getUIContext()}`
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) { setIsLive(false); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {isOpen ? (
        <div className="bg-white rounded-[24px] shadow-2xl overflow-hidden border flex flex-col w-[240px] sm:w-[280px] h-[360px] pointer-events-auto animate-in slide-in-from-bottom-2 fade-in duration-300">
          <div className="bg-slate-900 px-3 py-2 text-white flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Bot className="w-4 h-4 text-indigo-400" />
              <div>
                <span className="font-bold text-[10px] block leading-none">Nex Agent</span>
                <span className="text-[8px] text-indigo-400 uppercase tracking-tight">{isLive ? 'Voice Active' : 'Online'}</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-slate-800 rounded transition-colors"><ChevronDown size={16}/></button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-2 space-y-2 bg-slate-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] p-2 rounded-xl text-[11px] leading-tight ${
                  m.role === 'user' ? 'bg-indigo-600 text-white rounded-br-none' : 'bg-white border rounded-bl-none text-slate-700'
                }`}>
                  {m.text}
                  {m.tool && <div className="mt-1 text-[7px] font-bold text-indigo-500 uppercase flex items-center gap-0.5"><Sparkles size={6}/> {m.tool}</div>}
                </div>
              </div>
            ))}
            {isTyping && <Loader2 size={12} className="animate-spin text-indigo-600 mx-auto" />}
          </div>

          <div className="px-2 py-2 border-t bg-white">
            <div className="flex items-center gap-1.5">
              <button onClick={startLive} className={`p-2 rounded-full transition-all shrink-0 ${isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600'}`}>
                {isLive ? <AudioLines size={14} /> : <Mic size={14}/>}
              </button>
              <form onSubmit={handleSendMessage} className="flex-1 flex gap-1">
                <input 
                  type="text" value={input} 
                  onChange={e => setInput(e.target.value)}
                  placeholder="Need help?"
                  className="flex-1 bg-slate-100 border-none rounded-lg px-2 py-1.5 text-[11px] focus:ring-1 focus:ring-indigo-500/20"
                />
                <button disabled={!input.trim() || isTyping} className="p-1.5 bg-slate-900 text-white rounded-lg disabled:opacity-20 shrink-0"><Send size={14}/></button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="pointer-events-auto w-10 h-10 bg-slate-900 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all group relative">
          <Bot size={20} className="group-hover:rotate-12 transition-transform" />
          <div className="absolute top-0 right-0 w-2 h-2 bg-indigo-500 rounded-full border border-white"></div>
        </button>
      )}
    </div>
  );
};

export default AIAgent;
