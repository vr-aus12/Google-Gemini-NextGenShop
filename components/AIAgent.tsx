
import React, { useState, useRef, useEffect } from 'react';
import { Bot, X, Minimize2, Maximize2, Sparkles, Mic, MicOff, Send, Loader2 } from 'lucide-react';
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
  };
  currentCart: any[];
  products: Product[];
  user: User | null;
  currentView: AppView;
  selectedProductId: string | null;
  searchQuery: string;
  sellerTab: string;
}

// Manual base64 decoding logic as per instructions
function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

// Manual base64 encoding logic as per instructions
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Manual audio decoding for raw PCM bytes returned by Gemini Live API
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

// Helper to create PCM blob for streaming to the model
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
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [messages, setMessages] = useState<{ role: 'user' | 'bot'; text: string; tool?: string }[]>([
    { role: 'bot', text: 'Hello! I am Nex. I can help you shop, compare items, or manage your seller dashboard. Click the mic to talk or type a message below!' }
  ]);
  
  const [isLive, setIsLive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const chatSessionRef = useRef<Chat | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Refs to handle stale closures in long-lived session callbacks
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

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Cleanup live session on unmount
  useEffect(() => {
    return () => {
      stopLive();
    };
  }, []);

  const getUIContext = () => {
    return `Current UI Context: View=${currentViewRef.current}, User=${userRef.current?.name || 'Guest'}, Cart Items=${currentCartRef.current.length}, Selected Product ID: ${selectedProductIdRef.current || 'None'}, Search Query: ${searchQueryRef.current || 'None'}, Seller Tab: ${sellerTabRef.current}.`;
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
      } else if (fc.name === 'addNewProduct') {
        await act.addProduct(fc.args);
      } else if (fc.name === 'compareProducts') {
        if (fc.args.productIds) {
          fc.args.productIds.forEach((id: string) => act.compareProduct(id));
        }
        if (fc.args.goToView) act.navigateTo('compare');
      } else if (fc.name === 'getSellerData') {
        act.navigateTo('seller-dashboard');
      }
    } catch (err) {
      console.error(`Tool Call Error [${fc.name}]:`, err);
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
      
      // Handle tool calls in text response
      if (response.functionCalls) {
        for (const fc of response.functionCalls) {
          await executeToolCall(fc);
          setMessages(prev => [...prev, { role: 'bot', text: `Action triggered: ${fc.name}`, tool: fc.name }]);
        }
      }

      if (response.text) {
        setMessages(prev => [...prev, { role: 'bot', text: response.text }]);
      }
    } catch (err) {
      console.error("Text chat error:", err);
      setMessages(prev => [...prev, { role: 'bot', text: "Sorry, I encountered an error processing your request. Please check your connection." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const stopLive = () => {
    if (inputAudioContextRef.current) {
      inputAudioContextRef.current.close().catch(() => {});
      inputAudioContextRef.current = null;
    }
    if (outputAudioContextRef.current) {
      outputAudioContextRef.current.close().catch(() => {});
      outputAudioContextRef.current = null;
    }
    if (sessionPromiseRef.current) {
      sessionPromiseRef.current.then(session => session.close()).catch(() => {});
      sessionPromiseRef.current = null;
    }
    sourcesRef.current.forEach(s => {
      try { s.stop(); } catch(e) {}
    });
    sourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setIsLive(false);
  };

  const startLive = async () => {
    if (isLive) {
      stopLive();
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      inputAudioContextRef.current = inputCtx;
      outputAudioContextRef.current = outputCtx;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      // Create live connection and handle all events
      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            setIsLive(true);
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              // CRITICAL: Use sessionPromise to ensure connection is ready before sending data
              sessionPromise.then((session) => {
                session.sendRealtimeInput({ media: pcmBlob });
              }).catch(err => {
                console.warn("Realtime input send failed:", err);
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            // 1. Process Audio Output
            const base64Audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (base64Audio && outputAudioContextRef.current) {
              const ctx = outputAudioContextRef.current;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, ctx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), ctx, 24000, 1);
              const source = ctx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(ctx.destination);
              source.onended = () => sourcesRef.current.delete(source);
              // Schedule playback for gapless audio
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
            }

            // 2. Handle Interruption
            if (message.serverContent?.interrupted) {
              sourcesRef.current.forEach(s => {
                try { s.stop(); } catch(e) {}
              });
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }

            // 3. Handle Tool Calls
            if (message.toolCall) {
              for (const fc of message.toolCall.functionCalls) {
                const toolResult = await executeToolCall(fc);

                // Send response back to model
                sessionPromise.then(session => {
                  session.sendToolResponse({
                    functionResponses: {
                      id: fc.id,
                      name: fc.name,
                      response: toolResult
                    }
                  });
                });

                setMessages(prev => [...prev, { role: 'bot', text: `Action triggered: ${fc.name}`, tool: fc.name }]);
              }
            }

            // 4. Capture transcriptions as messages
            if (message.serverContent?.modelTurn?.parts?.[0]?.text) {
               setMessages(prev => [...prev, { role: 'bot', text: message.serverContent?.modelTurn?.parts?.[0]?.text! }]);
            }
          },
          onerror: (e) => {
            console.error("Gemini Live API Error details:", e);
            setMessages(prev => [...prev, { role: 'bot', text: "Connection error. Please try again in a moment." }]);
            stopLive();
          },
          onclose: (e) => {
            console.log("Gemini Live session closed:", e);
            stopLive();
          }
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } }
          },
          tools: [{ functionDeclarations: marketplaceTools }],
          systemInstruction: `You are Nex, the proactive shopping assistant for NexShop.
          ${getUIContext()}
          
          Use searchProducts for search requests.
          Use viewProduct for viewing a specific item.
          Use compareProducts to compare items side-by-side.
          Use navigateTo to change views (home, cart, etc).`
        }
      });
      sessionPromiseRef.current = sessionPromise;
    } catch (err) {
      console.error("Failed to connect to Gemini Live:", err);
      setMessages(prev => [...prev, { role: 'bot', text: "Could not establish audio connection. Check mic permissions." }]);
      setIsLive(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all z-50 group"
      >
        <Bot className="w-7 h-7" />
        <span className="absolute -top-12 right-0 bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-xl shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap border">
          Talk to Nex
        </span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 bg-white rounded-3xl shadow-2xl z-50 flex flex-col transition-all overflow-hidden border ${isExpanded ? 'w-[500px] h-[600px]' : 'w-[350px] h-[500px]'}`}>
      {/* Header */}
      <div className="bg-indigo-600 p-4 text-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-bold">Nex Shopping Assistant</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => { stopLive(); setIsOpen(false); }} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-sm ${
              m.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' : 'bg-white text-slate-700 border rounded-tl-none shadow-sm'
            }`}>
              {m.text}
              {m.tool && (
                <div className="mt-2 text-[10px] font-bold uppercase text-indigo-500 flex items-center gap-1 border-t pt-2 border-slate-100">
                  <Sparkles className="w-3 h-3" /> {m.tool}
                </div>
              )}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm">
               <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
            </div>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-4 bg-white border-t space-y-3">
        {/* Text Input */}
        <form onSubmit={handleSendMessage} className="flex gap-2">
          <input 
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isLive ? "Voice mode active..." : "Type a message..."}
            className="flex-1 bg-slate-100 border-none rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 transition-all"
            disabled={isLive || isTyping}
          />
          <button 
            type="submit"
            disabled={isLive || isTyping || !input.trim()}
            className="w-10 h-10 flex items-center justify-center bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-all shadow-sm"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>

        {/* Voice Toggle */}
        <button 
          onClick={startLive}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl font-bold transition-all shadow-sm ${
            isLive ? 'bg-red-500 text-white animate-pulse' : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
          }`}
        >
          {isLive ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          {isLive ? "Stop Conversation" : "Start Voice Conversation"}
        </button>
      </div>
    </div>
  );
};

export default AIAgent;
