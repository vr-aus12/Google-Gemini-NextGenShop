
import { Bot, Sparkles, Mic, Send, Loader2, AudioLines, ChevronDown, BrainCircuit, Globe, X, MicOff, MessageSquareText, Radio, Check, CircleX, Volume2, VolumeX } from 'lucide-react';
import React, { useState, useRef, useEffect, useCallback } from 'react';
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
  const [isOpen, setIsOpen] = useState(false);
  const [isLive, setIsLive] = useState(false); 
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  const [isPendingOrder, setIsPendingOrder] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string; sources?: GroundingSource[]; isConfirmation?: boolean }[]>([]);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const transcriptionRef = useRef({ input: '', output: '' });
  
  // Live API Refs
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const micStreamRef = useRef<MediaStream | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const actionsRef = useRef(actions);
  useEffect(() => { actionsRef.current = actions; }, [actions]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isOpen, isLive, isPendingOrder]);

  const getUIContext = useCallback(() => {
    const selected = products.find(p => p.id === selectedProductId);
    const cartItems = currentCart.map(i => i.product.name).join(', ');
    const catalog = products.slice(0, 10).map(p => `${p.name} (ID: ${p.id})`).join(', ');
    return `View=${currentView}, UserRole=${user?.role || 'Guest'}, SelectedProd=${selected?.name || 'None'} (ID: ${selectedProductId || 'None'}), Cart=[${cartItems}], CatalogSample=[${catalog}]. Current Search="${searchQuery}".`;
  }, [currentView, user, selectedProductId, currentCart, products, searchQuery]);

  const executeToolCall = async (fc: any) => {
    const act = actionsRef.current;
    try {
      if (fc.name === 'searchProducts') act.search(fc.args.query, fc.args.category, fc.args.minPrice, fc.args.maxPrice);
      else if (fc.name === 'addToCart') act.addToCart(fc.args.productId, fc.args.quantity);
      else if (fc.name === 'viewProduct') act.viewProduct(fc.args.productId);
      else if (fc.name === 'navigateTo') act.navigateTo(fc.args.view as AppView);
      else if (fc.name === 'placeOrder') {
        if (currentCart.length === 0) {
           return { status: "error", error: "Cart is empty." };
        }
        setIsPendingOrder(true);
        setMessages(prev => [...prev, { role: 'bot', text: "Ready to complete your purchase. Should I place the order for you now?", isConfirmation: true }]);
        return { status: "pending_confirmation", tool: fc.name };
      }
      return { status: "success", tool: fc.name };
    } catch (err) { 
      return { status: "error", error: String(err) }; 
    }
  };

  const handleConfirmOrder = async () => {
    setIsPendingOrder(false);
    try {
      await actionsRef.current.checkout();
      setMessages(prev => [...prev, { role: 'bot', text: "Order placed successfully! Redirecting you to the status page." }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Order failed. Please try again." }]);
    }
  };

  const handleCancelOrder = () => {
    setIsPendingOrder(false);
    setMessages(prev => [...prev, { role: 'bot', text: "Order cancelled. Let me know if you need anything else!" }]);
  };

  const startLiveSession = async () => {
    setMicError(null);
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    try {
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      outputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      await inputAudioContextRef.current.resume();
      await outputAudioContextRef.current.resume();
      
      micStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsLive(true);

      analyserRef.current = inputAudioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 256;
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      
      const updateLevel = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
        if (isLive) requestAnimationFrame(updateLevel);
      };
      updateLevel();
      
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            const source = inputAudioContextRef.current!.createMediaStreamSource(micStreamRef.current!);
            source.connect(analyserRef.current!);
            
            const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
            scriptProcessorRef.current = scriptProcessor;

            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              sessionPromise.then(session => {
                try {
                  session.sendRealtimeInput({ media: pcmBlob });
                } catch (err) { /* silent fail during close */ }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputAudioContextRef.current!.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // Fix: Audio Output Handling - decoded from 'pcm' call to 'pcmToAudioBuffer'
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await pcmToAudioBuffer(
                decode(base64Audio),
                ctx,
                24000,
                1
              );
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => { try { s.stop(); } catch(e) {} });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            if (message.serverContent?.inputTranscription) {
               transcriptionRef.current.input += message.serverContent.inputTranscription.text;
            }
            if (message.serverContent?.outputTranscription) {
               transcriptionRef.current.output += message.serverContent.outputTranscription.text;
            }
            
            if (message.serverContent?.turnComplete) {
              if (transcriptionRef.current.input) {
                setMessages(prev => [...prev, { role: 'user', text: transcriptionRef.current.input }]);
              }
              if (transcriptionRef.current.output) {
                setMessages(prev => [...prev, { role: 'bot', text: transcriptionRef.current.output }]);
              }
              transcriptionRef.current = { input: '', output: '' };
            }

            // Fix: Tool Call Handling according to guidelines
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const result = await executeToolCall(fc);
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: { result: result }
                    }
                  });
                });
              }
            }
          },
          onerror: (e) => {
            console.error("Live assistant error:", e);
            setMicError("AI connection lost.");
            stopLiveSession();
          },
          onclose: () => {
             setIsLive(false);
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } }
          },
          systemInstruction: `You are Nex, the NexShop assistant. Context: ${getUIContext()}`,
          tools: [{ functionDeclarations: marketplaceTools }],
          inputAudioTranscription: {},
          outputAudioTranscription: {}
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      setMicError("Microphone access denied.");
      console.error(err);
    }
  };

  const stopLiveSession = () => {
    setIsLive(false);
    if (micStreamRef.current) micStreamRef.current.getTracks().forEach(t => t.stop());
    if (scriptProcessorRef.current) scriptProcessorRef.current.disconnect();
    if (inputAudioContextRef.current) inputAudioContextRef.current.close();
    if (outputAudioContextRef.current) outputAudioContextRef.current.close();
    sessionPromiseRef.current?.then(s => { try { s.close(); } catch(e) {} });
    sessionPromiseRef.current = null;
  };

  const handleSend = async () => {
    if (!input.trim()) return;
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
        }
      }

      setMessages(prev => [...prev, { 
        role: 'bot', 
        text: response.text || "I've updated the catalog based on your request.", 
        sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks?.map((c: any) => c.web).filter(Boolean)
      }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I'm having trouble connecting to Nex services." }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className={`fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4`}>
       {isOpen && (
         <div className="w-[400px] h-[600px] bg-white rounded-[40px] shadow-2xl border flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 duration-500">
            {/* AI Agent Header */}
            <div className="bg-slate-900 p-6 text-white flex items-center justify-between">
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center">
                     <Bot size={24}/>
                  </div>
                  <div>
                    <h3 className="font-black text-sm">Nex Assistant</h3>
                    <p className="text-[10px] opacity-60 flex items-center gap-1"><Radio size={10} className={isLive ? 'text-green-400 animate-pulse' : ''}/> {isLive ? 'Live Voice Active' : 'Text Assistant'}</p>
                  </div>
               </div>
               <div className="flex items-center gap-2">
                 <button onClick={() => isLive ? stopLiveSession() : startLiveSession()} className={`p-2 rounded-xl transition-colors ${isLive ? 'bg-red-500/20 text-red-400' : 'bg-white/10 text-white'}`}>
                    {isLive ? <MicOff size={18}/> : <Mic size={18}/>}
                 </button>
                 <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-colors"><ChevronDown size={20}/></button>
               </div>
            </div>

            {/* Chat Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
               {messages.length === 0 && (
                 <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-4">
                    <div className="w-16 h-16 bg-white rounded-3xl flex items-center justify-center shadow-sm border border-slate-100">
                      <Sparkles className="text-indigo-600" size={24}/>
                    </div>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Ask me to find hardware or manage your cart</p>
                 </div>
               )}
               {messages.map((m, i) => (
                 <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] p-4 rounded-3xl text-sm ${m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white text-slate-800 border rounded-tl-none shadow-sm'}`}>
                       <p className="leading-relaxed">{m.text}</p>
                       
                       {m.sources && m.sources.length > 0 && (
                         <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
                            <p className="text-[9px] font-black uppercase text-slate-400">Sources</p>
                            {m.sources.map((s, idx) => (
                              <a key={idx} href={s.uri} target="_blank" rel="noreferrer" className="block text-[10px] text-indigo-600 hover:underline truncate">{s.title}</a>
                            ))}
                         </div>
                       )}

                       {m.isConfirmation && (
                         <div className="mt-4 flex gap-2">
                            <button onClick={handleConfirmOrder} className="flex-1 bg-indigo-600 text-white py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><Check size={14}/> Confirm</button>
                            <button onClick={handleCancelOrder} className="flex-1 bg-slate-100 text-slate-600 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1"><X size={14}/> Cancel</button>
                         </div>
                       )}
                    </div>
                 </div>
               ))}
               {isTyping && (
                 <div className="flex justify-start">
                   <div className="bg-white border p-4 rounded-3xl rounded-tl-none shadow-sm">
                      <Loader2 className="animate-spin text-indigo-600" size={18}/>
                   </div>
                 </div>
               )}
               {isLive && (
                 <div className="flex justify-center py-4">
                    <div className="flex items-center gap-1 h-8">
                       {[...Array(8)].map((_, i) => (
                         <div 
                           key={i} 
                           className="w-1 bg-indigo-500 rounded-full transition-all duration-75"
                           style={{ height: `${Math.max(4, (audioLevel / 255) * 32 * Math.sin(Date.now() / 100 + i))}px` }}
                         />
                       ))}
                    </div>
                 </div>
               )}
            </div>

            {/* Input Form */}
            <div className="p-6 bg-white border-t">
               <div className="relative flex items-center gap-2">
                  <input 
                    type="text" 
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    placeholder={isLive ? "Speak to Nex..." : "Message Nex..."}
                    className="flex-1 bg-slate-50 border-none rounded-2xl py-4 px-6 text-sm focus:ring-2 focus:ring-indigo-500/10 transition-all"
                  />
                  <button onClick={handleSend} disabled={!input.trim()} className="bg-slate-900 text-white p-4 rounded-2xl disabled:opacity-50 hover:bg-indigo-600 transition-colors shadow-lg">
                     <Send size={18}/>
                  </button>
               </div>
            </div>
         </div>
       )}

       <button onClick={() => setIsOpen(!isOpen)} className={`w-16 h-16 rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 active:scale-90 ${isOpen ? 'bg-slate-900 text-white rotate-90' : 'bg-indigo-600 text-white'}`}>
          {isOpen ? <X size={28}/> : <Bot size={28}/>}
       </button>
    </div>
  );
};

export default AIAgent;
