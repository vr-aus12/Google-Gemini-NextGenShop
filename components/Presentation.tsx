
import React, { useState } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, BrainCircuit, Zap, ShoppingBag, Globe, ShieldCheck, Cpu, MessageSquareQuote, Search, LayoutGrid } from 'lucide-react';

interface SlideProps {
  onClose: () => void;
}

const Presentation: React.FC<SlideProps> = ({ onClose }) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "The NexShop Vision",
      subtitle: "Beyond the Search Bar",
      content: "We are transitioning from 'Searching for Products' to 'Intent-Driven Acquisition'. NexShop isn't a website; it's a shopping companion that understands hardware needs.",
      icon: <LayoutGrid className="text-indigo-400" size={48} />,
      gradient: "from-slate-900 to-indigo-950",
      points: ["Agentic Shopping Experience", "Zero-Latency UI", "Multimodal Interaction"]
    },
    {
      title: "Nex Assistant",
      subtitle: "Powered by Gemini 3 Flash",
      content: "Nex handles the complexity of navigation and cart management. Using sub-second tool calling, Nex maps human intent to functional marketplace actions.",
      icon: <Zap className="text-amber-400" size={48} />,
      gradient: "from-indigo-900 to-slate-900",
      points: ["High-speed Tool Calling", "Voice-to-Action Pipeline", "Contextual Catalog Awareness"]
    },
    {
      title: "Deep Insights",
      subtitle: "Powered by Gemini 3 Pro",
      content: "Ever struggle with mixed reviews? Our Deep Insight engine uses Gemini Pro's thinking budget to synthesize thousands of data points into a single purchase verdict.",
      icon: <BrainCircuit className="text-purple-400" size={48} />,
      gradient: "from-slate-900 to-purple-950",
      points: ["Chain-of-Thought Reasoning", "Sentiment Synthesis", "Technical Spec Verification"]
    },
    {
      title: "Marketing Studio",
      subtitle: "Powered by Gemini Image Generation",
      content: "Sellers can visualize their hardware in professional settings instantly. Generative AI creates studio-grade marketing assets without a photography budget.",
      icon: <Sparkles className="text-pink-400" size={48} />,
      gradient: "from-slate-900 to-rose-950",
      points: ["Instant Asset Generation", "Contextual Lighting & Shadows", "Text-to-Visual Commerce"]
    },
    {
      title: "The NexShop Edge",
      subtitle: "Why we win over Amazon & eBay",
      content: "Amazon and eBay are libraries. NexShop is an expert consultant. We focus on discovery and advisement, not just indexing.",
      icon: <Globe className="text-emerald-400" size={48} />,
      gradient: "from-slate-900 to-emerald-950",
      points: ["Intent over Keywords", "Advisory over Search", "Integrated Google AI Stack"]
    }
  ];

  const next = () => setCurrentSlide((s) => (s + 1) % slides.length);
  const prev = () => setCurrentSlide((s) => (s - 1 + slides.length) % slides.length);

  const activeSlide = slides[currentSlide];

  return (
    <div className={`fixed inset-0 z-[60] bg-gradient-to-br ${activeSlide.gradient} transition-colors duration-700 flex flex-col items-center justify-center p-8 text-white`}>
      <button onClick={onClose} className="absolute top-10 right-10 p-4 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-xl transition-all border border-white/10">
        <LayoutGrid size={24} />
      </button>

      <div className="max-w-5xl w-full grid grid-cols-1 lg:grid-cols-2 gap-16 items-center animate-in fade-in zoom-in-95 duration-500">
        <div className="space-y-8">
          <div className="space-y-4">
            <div className="w-16 h-16 bg-white/10 rounded-3xl flex items-center justify-center backdrop-blur-2xl border border-white/20 shadow-2xl">
              {activeSlide.icon}
            </div>
            <h1 className="text-7xl font-black tracking-tighter leading-none">{activeSlide.title}</h1>
            <p className="text-2xl font-bold text-indigo-400 opacity-90">{activeSlide.subtitle}</p>
          </div>
          
          <p className="text-xl text-white/70 leading-relaxed font-medium max-w-lg">
            {activeSlide.content}
          </p>

          <div className="flex flex-wrap gap-3">
            {activeSlide.points.map((p, i) => (
              <span key={i} className="px-5 py-2 bg-white/5 border border-white/10 rounded-2xl text-xs font-black uppercase tracking-widest">{p}</span>
            ))}
          </div>
        </div>

        <div className="hidden lg:block relative">
           <div className="aspect-square bg-white/5 rounded-[80px] border border-white/10 backdrop-blur-3xl shadow-3xl flex items-center justify-center group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-1000"></div>
              {React.cloneElement(activeSlide.icon as React.ReactElement, { size: 240, className: "opacity-20 group-hover:scale-110 group-hover:opacity-40 transition-all duration-1000" })}
              <div className="absolute inset-x-0 bottom-0 p-12 bg-gradient-to-t from-slate-950/80 to-transparent">
                 <p className="text-xs font-black tracking-[0.2em] uppercase text-white/40">Technology Module {currentSlide + 1}</p>
              </div>
           </div>
        </div>
      </div>

      <div className="absolute bottom-16 left-0 right-0 flex justify-center items-center gap-12">
        <button onClick={prev} className="p-6 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"><ChevronLeft size={32}/></button>
        <div className="flex gap-4">
          {slides.map((_, i) => (
            <div key={i} className={`h-1.5 transition-all duration-500 rounded-full ${i === currentSlide ? 'w-12 bg-indigo-500' : 'w-3 bg-white/20'}`}></div>
          ))}
        </div>
        <button onClick={next} className="p-6 bg-white/5 hover:bg-white/10 rounded-full border border-white/10 transition-all active:scale-95"><ChevronRight size={32}/></button>
      </div>
    </div>
  );
};

export default Presentation;
