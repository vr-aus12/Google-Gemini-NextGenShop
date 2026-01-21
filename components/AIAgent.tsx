
import React, { useState, useRef, useEffect } from 'react';
import { Bot, Sparkles, Mic, Send, Loader2, AudioLines, ChevronDown, BrainCircuit, Globe, X, MicOff, MessageSquareText, Radio } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Chat, Blob } from '@google/genai';
import { marketplaceTools, createChatSession } from '../services/geminiService';
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

// Audio Utilities
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

async function pcmToAudioBuffer(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
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

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) int16[i] = data[i] * 32768;
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

const AIAgent: React.FC<AIAgentProps> = ({ actions, currentCart, products, user, currentView, selectedProductId, searchQuery, sellerTab }) => {
  const [isOpen, setIsOpen] = useState(true);
  const [isLive, setIsLive] = useState(true); 
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string; sources?: GroundingSource[] }[]>([
    { role: 'bot', text: 'Nex Voice Assistant activated. I am listening...' }
  ]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  
  // Live API Refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, isLive]);

  // Handle auto-starting voice session
  useEffect(() => {
    if (isOpen && isLive && !micStreamRef.current) {
      startLiveSession();
    }
    return () => {
      stopLiveSession();
    };
  }, [isOpen, isLive]);

  const getUIContext = () => {
    const selected = products.find(p => p.id === selectedProductId);
    const cartItems = currentCart.map(i => i.product.name).join(', ');
    const catalog = products.slice(0, 10).map(p => `${p.name} (ID: ${p.id})`).join(', ');
    return `View=${currentView}, UserRole=${user?.role || 'Guest'}, SelectedProd=${selected?.name || 'None'} (ID: ${selectedProductId || 'None'}), Cart=[${cartItems}], CatalogSample=[${catalog}]. Current Search="${searchQuery}".`;
  };

  const executeToolCall = async (fc: any) => {
    const act = actionsRef.current;
    try {
      if (fc.name === 'searchProducts') act.search(fc.args.query, fc.args.category, fc.args.minPrice, fc.args.maxPrice);
      else if (fc.name === 'addToCart') act.addToCart(fc.args.productId, fc.args.quantity);
      else if (fc.name === 'viewProduct') act.viewProduct(fc.args.productId);
      else if (fc.name === 'navigateTo') act.navigateTo(fc.args.view as AppView);
      return { status: "success", tool: fc.name };
    } catch (err) { 
      return { status: "error", error: String(err) }; 
    }
  };

  const startLiveSession = async () => {
    setMicError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      // Resume contexts to bypass browser gesture policies
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsLive(true);
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(micStreamRef.current!);
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                try {
                  session.sendRealtimeInput({ media: pcmBlob });
                } catch (err) {
                  console.debug("Session likely closing, skipping audio send.");
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await pcmToAudioBuffer(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                  try { s.stop(); s.disconnect(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.modelTurn?.parts[0]?.text) {
              const text = message.serverContent.modelTurn.parts[0].text;
              setMessages(prev => [...prev, { role: 'bot', text }]);
            }

            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const result = await executeToolCall(fc);
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: { id: fc.id, name: fc.name, response: { result: result } }
                  });
                });
                setMessages(prev => [...prev, { role: 'bot', text: `Nex performing: ${fc.name}...`, tool: fc.name }]);
              }
            }
          },
          onerror: (e) => {
            console.error('Live API Error:', e);
            setMicError("Voice session encountered an error. Attempting restart...");
          },
          onclose: () => {
             console.debug("Live Session Closed");
             // Don't auto-stop if we're just cycling, but clear the ref
             sessionPromiseRef.current = null;
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: `You are Nex, the NexShop Voice Assistant. 
          Use tools to navigate the app or add items to the cart. 
          You are speaking directly to the user. Keep responses concise for audio.
          CONTEXT: ${getUIContext()}`,
          tools: [{ functionDeclarations: marketplaceTools }],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } }
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error('Failed to start mic:', err);
      setMicError("Could not access microphone. Please check permissions.");
      setIsLive(false);
    }
  };

  const stopLiveSession = () => {
    // 1. Close microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(t => t.stop());
      micStreamRef.current = null;
    }
    
    // 2. Disconnect Script Processor
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.onaudioprocess = null;
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }

    // 3. Close Audio Contexts
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }

    // 4. Stop all pending audio sources
    sourcesRef.current.forEach(s => {
        try { s.stop(); s.disconnect(); } catch(e) {}
    });
    sourcesRef.current.clear();

    // 5. Close Live Session
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(s => {
        try { s.close(); } catch(e) {}
      });
      sessionPromiseRef.current = null;
    }
    
    nextStartTimeRef.current = 0;
  };

  const toggleMode = () => {
    if (isLive) {
      stopLiveSession();
      setIsLive(false);
      setMessages(prev => [...prev, { role: 'bot', text: 'Switched to Text Chat mode.' }]);
    } else {
      setIsLive(true);
      // Mode change effect will trigger startLiveSession via useEffect
      setMessages(prev => [...prev, { role: 'bot', text: 'Nex Voice Assistant activated.' }]);
    }
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
          setMessages(prev => [...prev, { role: 'bot', text: `Operation complete: ${fc.name}`, tool: fc.name }]);
        }
      }
      if (response.text) setMessages(prev => [...prev, { role: 'bot', text: response.text, sources: sources.length > 0 ? sources : undefined }]);
    } catch (err) { 
      setMessages(prev => [...prev, { role: 'bot', text: "Service error. Please try again." }]); 
    }
    finally { setIsTyping(false); }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2 pointer-events-none">
      {isOpen ? (
        <div className="bg-white rounded-[32px] shadow-2xl overflow-hidden border flex flex-col w-[350px] h-[550px] pointer-events-auto animate-in slide-in-from-bottom-2 duration-300">
          <div className="bg-slate-900 px-4 py-4 text-white flex items-center justify-between shadow-lg">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${isLive ? 'bg-indigo-500 animate-pulse' : 'bg-slate-700'}`}>
                {isLive ? <Radio size={16} /> : <Bot size={16} />}
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-xs">Nex Assistant</span>
                <span className="text-[8px] uppercase tracking-widest text-indigo-400 font-black">
                  {isLive ? 'Live Voice Mode' : 'Text Chat Mode'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button 
                onClick={toggleMode} 
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase transition-all ${isLive ? 'bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                title={isLive ? "Switch to Text" : "Switch to Voice"}
              >
                {isLive ? <><MessageSquareText size={12}/> Chat</> : <><Mic size={12}/> Voice</>}
              </button>
              <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400"><ChevronDown size={18}/></button>
            </div>
          </div>
          
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 relative">
            {isLive && (
              <div className="sticky top-0 z-10 flex flex-col items-center gap-2 mb-4">
                <div className="bg-indigo-600 text-white px-6 py-2.5 rounded-full shadow-2xl flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter border-2 border-indigo-400/50">
                  <AudioLines size={16} className="animate-pulse" /> Nex is Listening
                </div>
                {micError && <p className="text-[9px] text-red-500 font-bold bg-red-50 px-3 py-1 rounded-full border border-red-100 text-center mx-4">{micError}</p>}
              </div>
            )}
            
            {messages.map((m, i) => (
              <div key={i} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${m.role === 'user' ? 'bg-indigo-600 text-white shadow-md' : 'bg-white border text-slate-700 shadow-sm'}`}>
                  {m.text}
                  {m.tool && <div className="mt-2 text-[8px] font-black text-indigo-500 uppercase flex items-center gap-1 border-t pt-1"><Sparkles size={10}/> {m.tool}</div>}
                </div>
                {m.sources && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {m.sources.map((s, si) => (
                      <a key={si} href={s.uri} target="_blank" rel="noopener noreferrer" className="px-2 py-1 bg-white border rounded-full text-[8px] font-bold text-slate-500 shadow-sm hover:border-indigo-200 transition-colors"><Globe size={8} className="inline mr-1"/>{s.title.slice(0, 15)}...</a>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {isTyping && <div className="px-2 animate-pulse"><Loader2 size={12} className="animate-spin text-indigo-600" /></div>}
          </div>

          {!isLive ? (
            <form onSubmit={handleSendMessage} className="p-4 border-t bg-white flex gap-2">
              <input 
                type="text" 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Ask Nex anything..." 
                className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-3 text-xs focus:ring-2 focus:ring-indigo-500/10 transition-all" 
              />
              <button disabled={!input.trim() || isTyping} className="p-3 bg-slate-900 text-white rounded-2xl shadow-lg hover:bg-indigo-600 transition-all disabled:opacity-30"><Send size={18}/></button>
            </form>
          ) : (
            <div className="p-6 border-t bg-white flex flex-col items-center gap-3">
              <div className="flex gap-4">
                <button onClick={toggleMode} className="px-5 py-2.5 rounded-full bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2">
                  <MessageSquareText size={14} /> Switch to Chat
                </button>
                <button onClick={() => { stopLiveSession(); startLiveSession(); }} className="px-5 py-2.5 rounded-full bg-indigo-50 text-indigo-600 font-black text-[10px] uppercase tracking-widest hover:bg-indigo-100 transition-all flex items-center gap-2">
                  <Mic size={14} /> Restart Voice
                </button>
              </div>
              <p className="text-[9px] text-slate-400 font-medium text-center">Nex uses the Gemini Live API for sub-second responses.</p>
            </div>
          )}
        </div>
      ) : (
        <button onClick={() => setIsOpen(true)} className="pointer-events-auto w-20 h-20 bg-slate-900 text-white rounded-[32px] shadow-3xl flex items-center justify-center hover:scale-110 transition-all hover:bg-indigo-600 group relative agent-pulse">
          <div className="relative">
             <BrainCircuit size={40} className="relative z-10" />
             <div className="absolute inset-0 bg-indigo-400 blur-xl opacity-0 group-hover:opacity-40 transition-opacity"></div>
          </div>
          <span className="absolute -top-1 -right-1 w-6 h-6 bg-indigo-500 rounded-full border-4 border-slate-50 flex items-center justify-center">
             <Radio size={10} className="animate-pulse" />
          </span>
          <div className="absolute right-full mr-4 bg-white px-4 py-2 rounded-2xl border shadow-xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
             <p className="text-[10px] font-black uppercase tracking-widest text-slate-900">Start Voice Search</p>
          </div>
        </button>
      )}
    </div>
  );
};

export default AIAgent;
