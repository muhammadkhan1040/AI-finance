import { motion, AnimatePresence } from "framer-motion";
import { type Rate, type Lead } from "@shared/schema";
import { Check, ArrowRight, DollarSign, Calculator, Info, ChevronDown, ChevronUp, Search, ShieldCheck, User, Star } from "lucide-react";
import brokerPhoto from "@assets/profile_picture_optimized.jpg";
import atozLogo from "@assets/offical_logo_color_correct_normal_backgoorund_1767722280788.png";
import { GlassButton } from "./ui/glass-button";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiRequest, queryClient } from "@/lib/queryClient";

const GOOGLE_REVIEWS_URL = "https://www.google.com/search?q=a+to+z+home+loans#lrd=0x872b735c4e416fcf:0xed69e4c2f4ef7bdb,1";

const creditScoreLabels: Record<string, string> = {
  "780+": "780+",
  "760-780": "760-780",
  "740-759": "740-759",
  "720-739": "720-739",
  "700-719": "700-719",
  "680-699": "680-699",
  "640-679": "640-679",
  "620-639": "620-639",
  "601-619": "601-619",
  "580-600": "580-600",
  excellent: "740-850",
  good: "700-739",
  fair: "650-699",
  poor: "300-649",
};

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

interface YourDetailsPanelProps {
  lead: Lead;
  isExpanded: boolean;
  onToggle: () => void;
  onUpdateRates: (updatedLead: Lead) => void;
  isUpdating: boolean;
}

function YourDetailsPanel({ lead, isExpanded, onToggle, onUpdateRates, isUpdating }: YourDetailsPanelProps) {
  const [editedLead, setEditedLead] = useState<Lead>(lead);

  const handleSubmit = () => {
    onUpdateRates(editedLead);
  };

  const handleCancel = () => {
    setEditedLead(lead);
    onToggle();
  };

  return (
    <div className="glass-card rounded-2xl overflow-hidden mb-6">
      <button
        onClick={onToggle}
        className="w-full p-4 flex items-center justify-between text-left hover-elevate transition-all"
        data-testid="button-toggle-details"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/20">
            <User className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="text-sm font-bold text-white">Your Details</div>
            {!isExpanded && (
              <div className="text-xs text-blue-200/60 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                <span className="capitalize">{lead.loanPurpose}</span>
                <span>Credit: {creditScoreLabels[lead.creditScore] || lead.creditScore}</span>
                <span>${lead.loanAmount.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!isExpanded && (
            <span className="text-xs text-[#5cffb5] font-bold uppercase tracking-wide">Edit Details</span>
          )}
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-blue-200/60" />
          ) : (
            <ChevronDown className="w-5 h-5 text-blue-200/60" />
          )}
        </div>
      </button>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="p-4 pt-0 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Loan Purpose</Label>
                  <Select
                    value={editedLead.loanPurpose}
                    onValueChange={(value) => setEditedLead({ ...editedLead, loanPurpose: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-loan-purpose">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="purchase">Purchase</SelectItem>
                      <SelectItem value="refinance">Refinance</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Loan Amount</Label>
                  <Input
                    type="number"
                    value={editedLead.loanAmount}
                    onChange={(e) => setEditedLead({ ...editedLead, loanAmount: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-loan-amount"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Property Value</Label>
                  <Input
                    type="number"
                    value={editedLead.propertyValue}
                    onChange={(e) => setEditedLead({ ...editedLead, propertyValue: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-property-value"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Credit Score Range</Label>
                  <Select
                    value={editedLead.creditScore}
                    onValueChange={(value) => setEditedLead({ ...editedLead, creditScore: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-credit-score">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="780+">780+</SelectItem>
                      <SelectItem value="760-780">760-780</SelectItem>
                      <SelectItem value="740-759">740-759</SelectItem>
                      <SelectItem value="720-739">720-739</SelectItem>
                      <SelectItem value="700-719">700-719</SelectItem>
                      <SelectItem value="680-699">680-699</SelectItem>
                      <SelectItem value="640-679">640-679</SelectItem>
                      <SelectItem value="620-639">620-639</SelectItem>
                      <SelectItem value="601-619">601-619</SelectItem>
                      <SelectItem value="580-600">580-600</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Property Type</Label>
                  <Select
                    value={editedLead.propertyType}
                    onValueChange={(value) => setEditedLead({ ...editedLead, propertyType: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-property-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single_family">Single Family</SelectItem>
                      <SelectItem value="condo">Condo</SelectItem>
                      <SelectItem value="townhouse">Townhouse</SelectItem>
                      <SelectItem value="multi_family">Multi-Family</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Loan Type</Label>
                  <Select
                    value={editedLead.loanType}
                    onValueChange={(value) => setEditedLead({ ...editedLead, loanType: value })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white" data-testid="select-loan-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="conventional">Conventional</SelectItem>
                      <SelectItem value="fha">FHA</SelectItem>
                      <SelectItem value="va">VA</SelectItem>
                      <SelectItem value="usda">USDA</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">ZIP Code</Label>
                  <Input
                    type="text"
                    value={editedLead.zipCode}
                    onChange={(e) => setEditedLead({ ...editedLead, zipCode: e.target.value })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-zip-code"
                    maxLength={5}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-blue-200/60 text-xs">Annual Income</Label>
                  <Input
                    type="number"
                    value={editedLead.annualIncome}
                    onChange={(e) => setEditedLead({ ...editedLead, annualIncome: parseInt(e.target.value) || 0 })}
                    className="bg-white/5 border-white/10 text-white"
                    data-testid="input-annual-income"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={isUpdating}
                  className="flex-1 bg-[#5cffb5] text-black hover:bg-[#5cffb5]/90 font-bold"
                  data-testid="button-resubmit"
                >
                  {isUpdating ? (
                    <span className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      Updating...
                    </span>
                  ) : (
                    <>
                      <Search className="w-4 h-4 mr-2" />
                      Resubmit & Update Rate
                    </>
                  )}
                </Button>
                <Button
                  onClick={handleCancel}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                  data-testid="button-cancel-edit"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TrustIndicators() {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-center gap-4 md:gap-8 py-4 text-sm">
      <div className="flex items-center gap-2 text-blue-200/70">
        <Check className="w-4 h-4 text-[#5cffb5]" />
        <span>One credit check to compare lenders</span>
      </div>
      <div className="flex items-center gap-2 text-blue-200/70">
        <Check className="w-4 h-4 text-[#5cffb5]" />
        <span>Broker shops multiple lenders for best rate</span>
      </div>
      <div className="flex items-center gap-2 text-blue-200/70">
        <Check className="w-4 h-4 text-[#5cffb5]" />
        <span>Guided application with the lender shown</span>
      </div>
    </div>
  );
}

const googleReviews = [
  { name: "Phoenix Buyer", text: "He truly cares and will get your loan through. Best experience ever!", rating: 5 },
  { name: "First Time Buyer", text: "Made the VA loan process so easy. Highly recommend for veterans!", rating: 5 },
  { name: "Happy Homeowner", text: "Found us the best rate in Arizona. Closed faster than expected!", rating: 5 },
  { name: "Refinance Client", text: "Saved us thousands on our refinance. Professional and honest.", rating: 5 },
  { name: "Surprise Family", text: "Excellent communication throughout. Always answered our questions.", rating: 5 },
  { name: "Scottsdale Couple", text: "Top-notch service from start to finish. Would use again!", rating: 5 },
];
const GOOGLE_REVIEW_COUNT = 25;
const GOOGLE_RATING = 5.0;

function FloatingReviews() {
  return (
    <div className="relative overflow-hidden py-2">
      <div className="flex gap-4 animate-marquee-medium">
        {[...googleReviews, ...googleReviews].map((review, i) => (
          <div
            key={i}
            className="flex-shrink-0 glass-card rounded-lg p-3 w-72 border border-white/10"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="flex text-yellow-400">
                {[...Array(review.rating)].map((_, j) => (
                  <Star key={j} className="w-3 h-3 fill-current" />
                ))}
              </div>
              <span className="text-xs text-blue-200/60">{review.name}</span>
            </div>
            <p className="text-sm text-white/80 line-clamp-2">{review.text}</p>
          </div>
        ))}
      </div>
      <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-[#050818] to-transparent pointer-events-none" />
      <div className="absolute inset-y-0 right-0 w-16 bg-gradient-to-l from-[#050818] to-transparent pointer-events-none" />
    </div>
  );
}

function StickyBrokerBar() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#050818]/95 backdrop-blur-xl border-t border-white/10 shadow-[0_-4px_30px_rgba(0,0,0,0.5)]">
      <div className="px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img
              src={brokerPhoto}
              alt="Jerald Acosta - Mortgage Broker"
              className="w-12 h-12 rounded-full object-cover flex-shrink-0 border-2 border-[#5cffb5]/30"
            />
            <div className="min-w-0">
              <div className="text-white font-bold text-sm">Jerald Acosta</div>
              <div className="text-white/80 text-xs">A to Z Home Loans</div>
              <div className="text-[10px] text-blue-200/50">NMLS #1388911</div>
              <div className="text-[10px] text-blue-200/50">NMLS #2449185</div>
              <a 
                href={GOOGLE_REVIEWS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 hover:opacity-80 transition-opacity"
                data-testid="link-google-reviews"
              >
                <div className="flex text-yellow-400">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="w-3 h-3 fill-current" />
                  ))}
                </div>
                <span className="text-[10px] text-blue-200/70 underline">{GOOGLE_REVIEW_COUNT} Google Reviews</span>
              </a>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="border-white/20 text-white hover:bg-white/10"
              asChild
            >
              <a href="tel:+16025555555" data-testid="button-call-broker">
                Call
              </a>
            </Button>
            <Button
              size="sm"
              className="bg-[#5cffb5] text-black hover:bg-[#5cffb5]/90 font-bold"
              asChild
            >
              <a href="https://atozhomeloans.my1003app.com/register" target="_blank" rel="noopener noreferrer" data-testid="button-apply-sticky">
                Apply Now
              </a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DisclaimerSection() {
  return (
    <div className="mt-8 mb-40 space-y-6">
      <div className="text-[10px] text-blue-200/40 leading-relaxed space-y-2 px-4">
        <p><sup>1</sup> Points are fees paid directly to the lender in exchange for a reduced interest rate. A point is equal to one percent of the borrowed funds. By paying more in points upfront, you save money on interest over the life of your loan.</p>
        <p><sup>2</sup> Loan origination fee is for the service of processing a new loan application.</p>
        <p><sup>3</sup> Underwriting fee for the service of evaluating a loan application.</p>
        <p><sup>4</sup> Processing fee to cover the cost of processing a mortgage application.</p>
        <p className="pt-2 border-t border-white/5">All values are estimates based on information provided by the lender. Taxes and insurance are NOT included. Additional fees may apply. For an exact quote, contact the lender.</p>
      </div>
      
      <div className="flex items-center justify-center gap-6 pt-4">
        <img 
          src={atozLogo} 
          alt="A to Z Home Loans" 
          className="h-12 object-contain"
        />
      </div>
    </div>
  );
}

interface RatesDisplayProps {
  rates: Rate[];
  lead: Lead;
  onReset: () => void;
}

export function RatesDisplay({ rates: initialRates, lead: initialLead, onReset }: RatesDisplayProps) {
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [rates, setRates] = useState<Rate[]>(initialRates);
  const [lead, setLead] = useState<Lead>(initialLead);

  const handleUpdateRates = async (updatedLead: Lead) => {
    setIsUpdating(true);
    try {
      const payload = {
        firstName: updatedLead.firstName,
        lastName: updatedLead.lastName,
        email: updatedLead.email,
        phone: updatedLead.phone,
        loanAmount: updatedLead.loanAmount,
        loanPurpose: updatedLead.loanPurpose,
        creditScore: updatedLead.creditScore,
        zipCode: updatedLead.zipCode,
        propertyValue: updatedLead.propertyValue,
        loanTerm: updatedLead.loanTerm,
        propertyType: updatedLead.propertyType,
        loanType: updatedLead.loanType,
        annualIncome: updatedLead.annualIncome,
        isFirstTimeBuyer: updatedLead.isFirstTimeBuyer,
      };
      const response = await apiRequest("POST", "/api/leads", payload);
      const data = await response.json();
      setRates(data.rates);
      setLead(data.lead);
      setIsDetailsExpanded(false);
      queryClient.invalidateQueries({ queryKey: ["/api/leads"] });
    } catch (error) {
      console.error("Failed to update rates:", error);
      alert("Failed to update rates. Please try again.");
    } finally {
      setIsUpdating(false);
    }
  };

  if (selectedRate) {
    return <ConfirmationView rate={selectedRate} lead={lead} onReset={() => setSelectedRate(null)} />;
  }

  const bestRate = rates.reduce((prev, current) => (prev.rate < current.rate ? prev : current), rates[0]);

  return (
    <div className="w-full max-w-3xl mx-auto space-y-6 animate-in fade-in duration-700">
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
        
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-xs text-blue-200/60">
          <Info className="w-3 h-3" />
          <span>Compare to the national average:</span>
          <a 
            href="https://www.freddiemac.com/pmms" 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[#5cffb5] hover:underline font-medium"
            data-testid="link-freddie-mac-pmms"
          >
            Freddie Mac PMMS
          </a>
        </div>
      </div>

      <YourDetailsPanel
        lead={lead}
        isExpanded={isDetailsExpanded}
        onToggle={() => setIsDetailsExpanded(!isDetailsExpanded)}
        onUpdateRates={handleUpdateRates}
        isUpdating={isUpdating}
      />

      <div className="grid gap-3">
        {rates.map((rate, index) => {
          const isBestValue = index === 0;

          return (
            <motion.div 
              key={index}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`glass-card rounded-xl p-3 md:p-4 relative group hover-elevate transition-all duration-300 ${
                isBestValue ? 'ring-2 ring-blue-500/50 shadow-[0_0_20px_rgba(59,130,246,0.15)]' : ''
              }`}
            >
              {isBestValue && (
                <div className="absolute -top-2 left-4 bg-blue-500 text-white text-[9px] font-bold py-0.5 px-2 rounded-full shadow-lg z-20">
                  BEST VALUE
                </div>
              )}
              
              <div className="flex items-center justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-blue-300 font-medium">{rate.lender}</span>
                    {rate.note && (
                      <span className="px-1.5 py-0.5 rounded bg-white/5 text-[9px] text-blue-200/60 font-medium">{rate.note}</span>
                    )}
                    {rate.lenderFee && (
                      <span className="text-[9px] text-red-400">+${rate.lenderFee.toLocaleString()}</span>
                    )}
                    {rate.lenderCredit && (
                      <span className="text-[9px] text-green-400">-${rate.lenderCredit.toLocaleString()}</span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-2 mt-0.5">
                    <span className="text-2xl md:text-3xl font-bold text-white">{rate.rate.toFixed(3)}%</span>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="text-[10px] text-blue-200/50 border-b border-dotted border-blue-200/20 cursor-help">
                            APR {rate.apr.toFixed(3)}%
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="bg-[#050818] border-blue-500/30 text-white p-3 space-y-2 max-w-xs">
                          <div className="text-xs font-bold text-blue-300 uppercase tracking-widest mb-2 border-b border-white/10 pb-1">APR Breakdown</div>
                          <div className="space-y-1 text-xs">
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-200/60">Interest Rate:</span>
                              <span className="text-white font-bold">{rate.rate.toFixed(3)}%</span>
                            </div>
                            <div className="flex justify-between gap-4">
                              <span className="text-blue-200/60">Standard Costs:</span>
                              <span className="text-blue-200">+0.150%</span>
                            </div>
                            {rate.lenderFee && (
                              <div className="flex justify-between gap-4">
                                <span className="text-red-300">Buydown:</span>
                                <span className="text-red-300">+{((rate.lenderFee / (lead.loanAmount || 1) / 30) * 100).toFixed(3)}%</span>
                              </div>
                            )}
                            {rate.lenderCredit && (
                              <div className="flex justify-between gap-4">
                                <span className="text-green-300">Credit:</span>
                                <span className="text-green-300">-{((rate.lenderCredit / (lead.loanAmount || 1) / 30) * 100).toFixed(3)}%</span>
                              </div>
                            )}
                            <div className="flex justify-between gap-4 pt-1 border-t border-white/10 font-bold">
                              <span className="text-[#5cffb5]">Total APR:</span>
                              <span className="text-[#5cffb5]">{rate.apr.toFixed(3)}%</span>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="text-[10px] text-blue-200/50 uppercase tracking-wide">Monthly</div>
                  <div className="text-lg md:text-xl font-bold text-white">
                    ${rate.monthlyPayment.toLocaleString()}
                  </div>
                </div>

                <GlassButton 
                  className="flex-shrink-0" 
                  variant={isBestValue ? "primary" : "secondary"}
                  onClick={() => setSelectedRate(rate)}
                  data-testid={`button-select-rate-${index}`}
                >
                  <span className="hidden sm:inline">Select</span>
                  <ArrowRight className="w-4 h-4 sm:ml-1" />
                </GlassButton>
              </div>
            </motion.div>
          );
        })}
      </div>

      <TrustIndicators />

      <div className="text-center mt-6">
        <button 
          onClick={onReset}
          className="text-blue-300 hover:text-white underline underline-offset-4 text-sm transition-colors"
        >
          Start a new search
        </button>
      </div>

      <DisclaimerSection />

      <StickyBrokerBar />
    </div>
  );
}
