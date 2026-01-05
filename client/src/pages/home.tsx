import { useState } from "react";
import { LeadForm } from "@/components/LeadForm";
import { RatesDisplay } from "@/components/RatesDisplay";
import { type Rate } from "@shared/schema";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Clock } from "lucide-react";

export default function Home() {
  const [rates, setRates] = useState<Rate[] | null>(null);

  const reviews = [
    { text: "Jerald made everything simple and fast.", author: "Sarah M.", stars: 5 },
    { text: "Best mortgage experience we've ever had.", author: "Daniel R.", stars: 5 },
    { text: "Closed on time and saved us money.", author: "The Lopez Family", stars: 5 },
    { text: "4.9★ rated on Google Reviews", author: "Google", stars: 5 },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="bg-galaxy" />
      <div className="bg-stars" />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        
        {!rates ? (
          <div className="w-full max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="order-2 lg:order-1 space-y-8 text-center lg:text-left">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6 }}
              >
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-black/30 border border-white/10 backdrop-blur-md mb-6">
                  <Zap className="w-4 h-4 text-[#5cffb5]" />
                  <span className="text-xs font-bold uppercase tracking-wider text-white/90">AI-Powered Comparisons</span>
                </div>
                
                <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight mb-6">
                  Check your rate <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#5cffb5] to-[#0fd0ff]">in seconds.</span>
                </h1>
                
                <p className="text-lg md:text-xl text-blue-100/80 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  Lower rates. Real savings. No BS. See if your deal is good — or if you can do better with our AI engine.
                </p>
              </motion.div>

              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.8 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto lg:mx-0"
              >
                {[
                  "Instant AI check on your current rate",
                  "Compare top lenders side by side",
                  "No impact to your credit to see options",
                  "Takes about 60 seconds to start"
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 text-sm text-blue-100/70">
                    <div className="w-2 h-2 rounded-full bg-[#5cffb5] shadow-[0_0_8px_rgba(92,255,181,0.8)] animate-pulse-dot" />
                    {item}
                  </div>
                ))}
              </motion.div>

              {/* Marquee Reviews */}
              <div className="relative w-full max-w-md mx-auto lg:mx-0 overflow-hidden h-12 mask-linear-fade">
                <div className="flex gap-4 animate-marquee whitespace-nowrap absolute">
                  {[...reviews, ...reviews].map((review, i) => (
                    <div key={i} className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-black/40 border border-white/10 backdrop-blur-sm">
                      <span className="text-yellow-400 text-xs">★★★★★</span>
                      <span className="text-xs text-white/90 font-medium">"{review.text}"</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Form */}
            <div className="order-1 lg:order-2 w-full flex justify-center lg:justify-end">
              <LeadForm onRatesReceived={setRates} />
            </div>
          </div>
        ) : (
          <RatesDisplay rates={rates} onReset={() => setRates(null)} />
        )}

      </main>

      {/* Footer / FAQ Teaser */}
      <footer className="relative z-10 w-full max-w-7xl mx-auto px-6 py-8 border-t border-white/5 mt-auto">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 text-blue-200/40 text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4" />
              <span>Secure 256-bit Encryption</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              <span>Rates updated: Just now</span>
            </div>
          </div>
          <div>
            © 2024 CheckMy.ai | NMLS #2449185 | A-Z Home Loans
          </div>
        </div>
      </footer>
    </div>
  );
}
