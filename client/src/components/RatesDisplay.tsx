import { motion } from "framer-motion";
import { type Rate, type Lead } from "@shared/schema";
import { Check, ArrowRight, DollarSign, Calculator, Info } from "lucide-react";
import { GlassButton } from "./ui/glass-button";
import { useState } from "react";

interface ConfirmationViewProps {
  rate: Rate;
  lead: Lead;
  onReset: () => void;
}

export function ConfirmationView({ rate, lead, onReset }: ConfirmationViewProps) {
  const savings = rate.processingFee + rate.underwritingFee;

  return (
    <div className="w-full max-w-3xl mx-auto space-y-8 animate-in fade-in zoom-in duration-500">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[#5cffb5]/20 border border-[#5cffb5]/40 text-[#5cffb5] mb-4 backdrop-blur-sm">
          <Check className="w-4 h-4" />
          <span className="text-sm font-semibold text-white">Selection Confirmed</span>
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
          Ready to Lock?
        </h2>
        <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
          You've selected the best rate from {rate.lender}. Review your details below to finish your application online.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Selected Rate Card */}
        <div className="glass-card rounded-2xl p-6 border-[#5cffb5]/30 bg-[#5cffb5]/5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#5cffb5]">Selected Quote</span>
            <span className="text-white font-semibold text-sm">{rate.lender}</span>
          </div>
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-blue-200/60 text-sm">Interest Rate</span>
              <span className="text-3xl font-bold text-white">{rate.rate.toFixed(3)}%</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-blue-200/60 text-sm">Monthly P&I</span>
              <span className="text-2xl font-bold text-white">${rate.monthlyPayment.toLocaleString()}</span>
            </div>
            <div className="pt-4 border-t border-white/10 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-blue-200/40">Processing Fee</span>
                <span className="text-blue-200/60 line-through">${rate.processingFee}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-blue-200/40">Underwriting Fee</span>
                <span className="text-blue-200/60 line-through">${rate.underwritingFee}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#5cffb5] pt-2">
                <span>Online Application Savings</span>
                <span>-${savings.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Details */}
        <div className="glass-card rounded-2xl p-6">
          <div className="text-xs font-bold uppercase tracking-widest text-blue-300 mb-4">Your Details</div>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Name</span>
              <span className="text-white font-medium">{lead.firstName} {lead.lastName}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Loan Amount</span>
              <span className="text-white font-medium">${lead.loanAmount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Property Value</span>
              <span className="text-white font-medium">${lead.propertyValue.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Purpose</span>
              <span className="text-white capitalize font-medium">{lead.loanPurpose}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Loan Type</span>
              <span className="text-white capitalize font-medium">{lead.loanType}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Property Type</span>
              <span className="text-white capitalize font-medium">{lead.propertyType.replace(/_/g, ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Loan Term</span>
              <span className="text-white font-medium">{lead.loanTerm.replace('yr', ' Year Fixed')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-blue-200/40">Zip Code</span>
              <span className="text-white font-medium">{lead.zipCode}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card rounded-2xl p-8 text-center space-y-6 border-[#0fd0ff]/30">
        <div className="inline-flex items-center gap-2 text-[#0fd0ff] mb-2">
          <Calculator className="w-5 h-5" />
          <span className="font-bold">Total Savings: ${savings.toLocaleString()}</span>
        </div>
        <h3 className="text-2xl font-bold text-white">Complete Your Application</h3>
        <p className="text-blue-200/70 max-w-md mx-auto">
          Finish your application online today and we'll waive all processing and underwriting fees.
        </p>
        <GlassButton 
          className="w-full max-w-sm h-14 text-lg font-bold shadow-[0_0_25px_rgba(92,255,181,0.3)]" 
          variant="primary"
          data-testid="button-apply-online"
          asChild
        >
          <a href="https://atozhomeloans.my1003app.com/register" target="_blank" rel="noopener noreferrer">
            Apply Online Now <ArrowRight className="w-5 h-5 ml-2" />
          </a>
        </GlassButton>
        <div className="flex items-center justify-center gap-2 text-blue-200/40 text-[10px] uppercase tracking-widest">
          <Info className="w-3 h-3" />
          Fees waived for online applications only
        </div>
      </div>

      <div className="text-center">
        <button 
          onClick={onReset}
          className="text-blue-300 hover:text-white underline underline-offset-4 text-sm transition-colors"
        >
          Back to all rates
        </button>
      </div>
    </div>
  );
}

interface RatesDisplayProps {
  rates: Rate[];
  lead: Lead;
  onReset: () => void;
}

export function RatesDisplay({ rates, lead, onReset }: RatesDisplayProps) {
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);

  if (selectedRate) {
    return <ConfirmationView rate={selectedRate} lead={lead} onReset={() => setSelectedRate(null)} />;
  }

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
                <div className="text-sm text-blue-300 mb-1">{rate.lender} • {lead.loanType.toUpperCase()}</div>
                <div className="flex items-baseline justify-center md:justify-start gap-2">
                  <span className="text-4xl font-bold text-white">{rate.rate.toFixed(3)}%</span>
                  <span className="text-sm text-blue-200/60">Rate</span>
                </div>
                <div className="text-xs text-blue-200/50 mt-1">
                  APR {rate.apr.toFixed(3)}% • {lead.loanTerm.replace('yr', ' Year Fixed')}
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
                <GlassButton 
                  className="w-full md:w-auto group-hover:scale-105 transition-transform" 
                  variant={isBest ? "primary" : "secondary"}
                  onClick={() => setSelectedRate(rate)}
                  data-testid={`button-select-rate-${index}`}
                >
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
