import { motion } from "framer-motion";
import { type Rate, type Lead } from "@shared/schema";
import { Check, ArrowRight, DollarSign, Calculator, Info } from "lucide-react";
import { GlassButton } from "./ui/glass-button";
import { useState } from "react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
              {rate.lenderFee && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200/40 font-bold">Lender Fee (Buydown)</span>
                  <span className="text-red-400 font-bold">+${rate.lenderFee.toLocaleString()}</span>
                </div>
              )}
              {rate.lenderCredit && (
                <div className="flex justify-between text-sm">
                  <span className="text-blue-200/40 font-bold">Lender Credit</span>
                  <span className="text-[#5cffb5] font-bold">-${rate.lenderCredit.toLocaleString()}</span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-blue-200/40">Underwriting Fee</span>
                <span className="text-white font-medium">${rate.underwritingFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-blue-200/40">Processing Fee</span>
                <span className="text-white font-medium">${rate.processingFee.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-sm font-bold text-[#5cffb5] pt-2 border-t border-white/5">
                <span>Online Application Savings</span>
                <span>-${(rate.processingFee + rate.underwritingFee).toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Application Details */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="text-xs font-bold uppercase tracking-widest text-blue-300">Your Details</div>
            <button 
              onClick={onReset}
              className="text-xs text-[#5cffb5] hover:text-white transition-colors underline underline-offset-4 font-bold"
            >
              EDIT DETAILS
            </button>
          </div>
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
              <span className="text-blue-200/40">Annual Income</span>
              <span className="text-white font-medium">${lead.annualIncome.toLocaleString()}</span>
            </div>
            {lead.loanPurpose === "purchase" && (
              <div className="flex justify-between text-sm">
                <span className="text-blue-200/40">First Time Buyer</span>
                <span className="text-white capitalize font-medium">{lead.isFirstTimeBuyer}</span>
              </div>
            )}
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
        ><a href="https://atozhomeloans.my1003app.com/register" target="_blank" rel="noopener noreferrer">
            Apply Online Now <ArrowRight className="w-5 h-5 ml-2" />
          </a></GlassButton>
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
        <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl py-3 px-6 inline-block mb-6">
          <p className="text-[#0fd0ff] font-medium text-sm">
            Analysis of 3 top lenders complete. We've matched your scenario against current rate sheets to find these options.
          </p>
        </div>
        <p className="text-lg text-blue-200/70 max-w-xl mx-auto">
          Based on today's market data, here are the best options we found for your scenario.
        </p>
      </div>

      <div className="space-y-12">
        {Object.entries(
          rates.reduce((acc, rate) => {
            if (!acc[rate.lender]) acc[rate.lender] = [];
            acc[rate.lender].push(rate);
            return acc;
          }, {} as Record<string, typeof rates>)
        ).map(([lender, lenderRates]) => (
          <div key={lender} className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="h-px flex-1 bg-white/10" />
              <h3 className="text-xl font-bold text-blue-300 uppercase tracking-widest">{lender} Options</h3>
              <div className="h-px flex-1 bg-white/10" />
            </div>
            
            <div className="grid md:grid-cols-3 gap-6">
              {lenderRates.map((rate, index) => (
                <div 
                  key={`${lender}-${index}`}
                  className={`glass-card rounded-2xl p-6 relative flex flex-col ${
                    rate.note === 'Standard' ? 'ring-2 ring-blue-500/50 scale-105 z-10' : ''
                  }`}
                >
                  {rate.note === 'Standard' && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[10px] font-bold py-1 px-3 rounded-full shadow-lg">
                      RECOMMENDED
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="text-sm text-blue-300 mb-1 flex items-center justify-between">
                      <span>{rate.note}</span>
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded uppercase tracking-wider">
                        {lead.loanType}
                      </span>
                    </div>
                    
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-4xl font-bold text-white">{rate.rate.toFixed(3)}%</span>
                      <span className="text-sm text-blue-200/60 font-medium">Rate</span>
                    </div>

                    <div className="flex items-center gap-2 mb-6">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="text-xs text-blue-200/50 border-b border-blue-200/20 cursor-help hover:text-blue-200 transition-colors">
                              APR {rate.apr.toFixed(3)}%
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="bg-[#050818] border-blue-500/30 text-white p-3 space-y-2">
                            <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">Detailed APR Analysis</div>
                            <div className="space-y-1.5 text-xs">
                              <div className="flex justify-between gap-4">
                                <span className="text-blue-200/60 font-medium">Interest Rate (Note Rate):</span>
                                <span className="text-white font-bold">{rate.rate.toFixed(3)}%</span>
                              </div>
                              <div className="flex justify-between gap-4 pt-1">
                                <span className="text-blue-200/40 italic">Adjustments from fees:</span>
                              </div>
                              <div className="pl-2 space-y-1">
                                <div className="flex justify-between gap-4">
                                  <span className="text-blue-200/60">Standard Costs:</span>
                                  <span className="text-blue-200">+0.150%</span>
                                </div>
                                {rate.lenderFee && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-red-300">Buydown Cost (${rate.lenderFee.toLocaleString()}):</span>
                                    <span className="text-red-300">+{((rate.lenderFee / (lead.loanAmount || 1) / 30) * 100).toFixed(3)}%</span>
                                  </div>
                                )}
                                {rate.lenderCredit && (
                                  <div className="flex justify-between gap-4">
                                    <span className="text-green-300">Lender Credit (${rate.lenderCredit.toLocaleString()}):</span>
                                    <span className="text-green-300">-{((rate.lenderCredit / (lead.loanAmount || 1) / 30) * 100).toFixed(3)}%</span>
                                  </div>
                                )}
                              </div>
                              <div className="flex justify-between gap-4 pt-2 border-t border-white/10 font-bold">
                                <span className="text-[#5cffb5]">Total Effective APR:</span>
                                <span className="text-[#5cffb5]">{rate.apr.toFixed(3)}%</span>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <div className="space-y-3 pb-6 border-b border-white/10">
                      <div className="flex justify-between items-baseline">
                        <span className="text-blue-200/60 text-sm">Monthly P&I</span>
                        <span className="text-2xl font-bold text-white">${rate.monthlyPayment.toLocaleString()}</span>
                      </div>
                      
                      <div className="space-y-2">
                        {rate.lenderFee && (
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-200/40">Buydown Fee</span>
                            <span className="text-red-400 font-bold">+${rate.lenderFee.toLocaleString()}</span>
                          </div>
                        )}
                        {rate.lenderCredit && (
                          <div className="flex justify-between text-xs">
                            <span className="text-blue-200/40">Lender Credit</span>
                            <span className="text-[#5cffb5] font-bold">-${rate.lenderCredit.toLocaleString()}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-xs">
                          <span className="text-blue-200/40">Closing Fees</span>
                          <span className="text-white">${(rate.processingFee + rate.underwritingFee).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <GlassButton 
                    className="w-full mt-6"
                    onClick={() => setSelectedRate(rate)}
                    data-testid={`button-select-rate-${lender}-${index}`}
                  >
                    SELECT PLAN
                  </GlassButton>
                </div>
              ))}
            </div>
          </div>
        ))}
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
