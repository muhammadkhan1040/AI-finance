import { motion } from "framer-motion";
import { type Rate } from "@shared/schema";
import { Check, ArrowRight } from "lucide-react";
import { GlassButton } from "./ui/glass-button";

interface RatesDisplayProps {
  rates: Rate[];
  onReset: () => void;
}

export function RatesDisplay({ rates, onReset }: RatesDisplayProps) {
  // Find best rate for highlighting
  const bestRate = rates.reduce((prev, current) => (prev.rate < current.rate ? prev : current), rates[0]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/20 border border-green-500/40 text-green-300 mb-4 backdrop-blur-sm">
          <Check className="w-4 h-4" />
          <span className="text-sm font-semibold">Analysis Complete</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Your Personalized Rates
        </h2>
        <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
          Based on today's market data, here are the best options we found for your scenario.
        </p>
      </div>

      <div className="grid gap-6">
        {rates.map((rate, index) => {
          const isBest = rate === bestRate;
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={`glass-card rounded-2xl p-6 md:p-8 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group hover:border-[#5cffb5]/40 transition-all duration-300 ${isBest ? 'border-[#5cffb5]/50 bg-[#5cffb5]/5' : ''}`}
            >
              {isBest && (
                <div className="absolute top-0 right-0 bg-[#5cffb5] text-black text-xs font-bold px-3 py-1 rounded-bl-xl shadow-lg">
                  BEST VALUE
                </div>
              )}
              
              <div className="flex-1 text-center md:text-left">
                <div className="text-sm text-blue-300 mb-1">{rate.lender}</div>
                <div className="flex items-baseline justify-center md:justify-start gap-2">
                  <span className="text-4xl font-bold text-white">{rate.rate.toFixed(3)}%</span>
                  <span className="text-sm text-blue-200/60">Rate</span>
                </div>
                <div className="text-xs text-blue-200/50 mt-1">
                  APR {rate.apr.toFixed(3)}% • 30 Year Fixed
                </div>
              </div>

              <div className="h-px w-full md:w-px md:h-16 bg-gradient-to-r md:bg-gradient-to-b from-transparent via-white/10 to-transparent" />

              <div className="text-center md:text-left min-w-[140px]">
                <div className="text-sm text-blue-300 mb-1">Monthly Payment</div>
                <div className="text-2xl font-bold text-white">
                  ${rate.monthlyPayment.toLocaleString()}
                </div>
                <div className="text-xs text-blue-200/50 mt-1">Principal & Interest</div>
              </div>

              <div className="w-full md:w-auto">
                <GlassButton className="w-full md:w-auto group-hover:scale-105 transition-transform" variant={isBest ? "primary" : "secondary"}>
                  Select <ArrowRight className="w-4 h-4 ml-2" />
                </GlassButton>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="text-center mt-12">
        <button 
          onClick={onReset}
          className="text-blue-300 hover:text-white underline underline-offset-4 text-sm transition-colors"
        >
          Start a new search
        </button>
      </div>
    </div>
  );
}
