import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertLeadSchema, type InsertLead, type Rate, type Lead } from "@shared/schema";
import { useCreateLead } from "@/hooks/use-leads";
import { GlassButton } from "./ui/glass-button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronRight, DollarSign, Home, User, ArrowLeft, Percent } from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadFormProps {
  onRatesReceived: (rates: Rate[], lead: Lead) => void;
}

const STEPS = [
  { id: 'purpose', title: 'Goals' },
  { id: 'property', title: 'Property' },
  { id: 'personal', title: 'Details' }
];

export function LeadForm({ onRatesReceived }: LeadFormProps) {
  const [step, setStep] = useState(0);
  const { mutate, isPending } = useCreateLead();
  
  const form = useForm<InsertLead>({
    resolver: zodResolver(insertLeadSchema),
    defaultValues: {
      loanPurpose: "purchase",
      creditScore: "732-750",
      loanAmount: 350000,
      propertyValue: 450000,
      loanTerm: "30yr",
      loanType: "conventional",
      propertyType: "single_family",
      zipCode: "",
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    }
  });

  const { register, trigger, getValues, setValue, watch, formState: { errors } } = form;
  const loanPurpose = watch("loanPurpose");

  const nextStep = async () => {
    let fieldsToValidate: (keyof InsertLead)[] = [];
    
    if (step === 0) fieldsToValidate = ["loanPurpose", "loanType"];
    if (step === 1) fieldsToValidate = ["zipCode", "loanAmount", "propertyValue", "loanTerm", "propertyType"];
    
    const isValid = await trigger(fieldsToValidate);
    if (isValid) setStep(s => s + 1);
  };

  const prevStep = () => setStep(s => s - 1);

  const onSubmit = (data: InsertLead) => {
    mutate(data, {
      onSuccess: (response) => {
        onRatesReceived(response.rates, response.lead);
      }
    });
  };

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Progress Steps */}
      <div className="flex items-center justify-between mb-8 px-4">
        {STEPS.map((s, i) => (
          <div key={s.id} className="flex flex-col items-center relative z-10">
            <motion.div 
              initial={false}
              animate={{
                backgroundColor: i <= step ? "#5cffb5" : "rgba(5, 8, 30, 0.9)",
                borderColor: i <= step ? "#5cffb5" : "rgba(164, 211, 255, 0.3)",
                color: i <= step ? "#050818" : "#fff"
              }}
              className={cn(
                "w-8 h-8 rounded-full border flex items-center justify-center text-sm font-bold transition-colors duration-300",
                i <= step && "shadow-[0_0_15px_rgba(92,255,181,0.5)]"
              )}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </motion.div>
            <span className="text-xs mt-2 text-white/70">{s.title}</span>
          </div>
        ))}
        {/* Connecting Line */}
        <div className="absolute top-4 left-0 w-full h-[1px] bg-gradient-to-r from-blue-500/20 via-blue-400/20 to-blue-500/20 -z-0 px-8">
          <motion.div 
            className="h-full bg-gradient-to-r from-[#5cffb5] to-[#0fd0ff]"
            initial={{ width: "0%" }}
            animate={{ width: `${(step / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      <div className="glass-card rounded-3xl p-8 animate-float">
        <form onSubmit={form.handleSubmit(onSubmit)}>
          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="step0"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">What's your goal?</h2>
                  <p className="text-blue-200/70 text-sm">Let's find the best loan program for you.</p>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  <button
                    type="button"
                    onClick={() => setValue("loanPurpose", "purchase")}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-300 flex items-center gap-4 group",
                      loanPurpose === "purchase" 
                        ? "bg-[#5cffb5]/10 border-[#5cffb5] shadow-[0_0_15px_rgba(92,255,181,0.2)]" 
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      loanPurpose === "purchase" ? "bg-[#5cffb5] text-black" : "bg-white/10 text-white group-hover:bg-white/20"
                    )}>
                      <Home className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Buy a Home</div>
                      <div className="text-xs text-white/60">I'm looking to purchase a property</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setValue("loanPurpose", "refinance")}
                    className={cn(
                      "p-4 rounded-xl border transition-all duration-300 flex items-center gap-4 group",
                      loanPurpose === "refinance" 
                        ? "bg-[#0fd0ff]/10 border-[#0fd0ff] shadow-[0_0_15px_rgba(15,208,255,0.2)]" 
                        : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20"
                    )}
                  >
                    <div className={cn(
                      "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                      loanPurpose === "refinance" ? "bg-[#0fd0ff] text-black" : "bg-white/10 text-white group-hover:bg-white/20"
                    )}>
                      <Percent className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-white">Refinance</div>
                      <div className="text-xs text-white/60">I want to lower my rate or get cash out</div>
                    </div>
                  </button>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/10">
                  <Label className="text-blue-200">Loan Type</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "conventional", label: "Conventional" },
                      { id: "fha", label: "FHA" },
                      { id: "va", label: "VA" },
                      { id: "jumbo", label: "Jumbo" },
                      { id: "usda", label: "USDA" },
                      { id: "reverse", label: "Reverse" }
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setValue("loanType", t.id)}
                        className={cn(
                          "py-3 px-4 rounded-xl border text-sm font-medium transition-all duration-300",
                          watch("loanType") === t.id
                            ? "bg-[#5cffb5]/10 border-[#5cffb5] text-[#5cffb5] shadow-[0_0_10px_rgba(92,255,181,0.2)]"
                            : "bg-white/5 border-white/10 text-white/70 hover:bg-white/10 hover:border-white/20"
                        )}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}

            {step === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Property Details</h2>
                  <p className="text-blue-200/70 text-sm">Tell us about the home.</p>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-blue-200">Zip Code</Label>
                    <Input 
                      {...register("zipCode")}
                      className="glass-input h-12" 
                      placeholder="e.g. 85001"
                      maxLength={5}
                    />
                    {errors.zipCode && <span className="text-red-400 text-xs">{errors.zipCode.message}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Estimated Value</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3.5 w-5 h-5 text-blue-300/50" />
                      <Input 
                        {...register("propertyValue", { valueAsNumber: true })}
                        className="glass-input h-12 pl-10" 
                        placeholder="450000"
                        type="number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Loan Amount</Label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-3.5 w-5 h-5 text-blue-300/50" />
                      <Input 
                        {...register("loanAmount", { valueAsNumber: true })}
                        className="glass-input h-12 pl-10" 
                        placeholder="350000"
                        type="number"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Property Type</Label>
                    <Select onValueChange={(v) => setValue("propertyType", v)} defaultValue="single_family">
                      <SelectTrigger className="glass-input h-12 w-full" data-testid="select-property-type">
                        <SelectValue placeholder="Select Property Type" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#050818] border-blue-500/30 text-white">
                        <SelectItem value="single_family">Single Family</SelectItem>
                        <SelectItem value="condo">Condo</SelectItem>
                        <SelectItem value="multi_2_4">Multi Family 2-4 Unit</SelectItem>
                        <SelectItem value="multi_5_plus">Multi Family 5+ Units</SelectItem>
                        <SelectItem value="townhome">Town Home</SelectItem>
                        <SelectItem value="manufactured">Manufactured Home</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Loan Term</Label>
                    <Select onValueChange={(v) => setValue("loanTerm", v)} defaultValue="30yr">
                      <SelectTrigger className="glass-input h-12 w-full" data-testid="select-loan-term">
                        <SelectValue placeholder="Select Loan Term" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#050818] border-blue-500/30 text-white">
                        <SelectItem value="30yr">30 Year Fixed</SelectItem>
                        <SelectItem value="25yr">25 Year Fixed</SelectItem>
                        <SelectItem value="20yr">20 Year Fixed</SelectItem>
                        <SelectItem value="15yr">15 Year Fixed</SelectItem>
                        <SelectItem value="10yr">10 Year Fixed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6"
              >
                <div className="text-center mb-6">
                  <h2 className="text-2xl font-bold text-white mb-2">Final Step</h2>
                  <p className="text-blue-200/70 text-sm">We'll prepare your custom rate quote.</p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-blue-200">First Name</Label>
                      <Input {...register("firstName")} className="glass-input h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-blue-200">Last Name</Label>
                      <Input {...register("lastName")} className="glass-input h-12" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Credit Score (Estimate)</Label>
                    <Select onValueChange={(v) => setValue("creditScore", v)} defaultValue="732-750">
                      <SelectTrigger className="glass-input h-12 w-full" data-testid="select-credit-score">
                        <SelectValue placeholder="Select Credit Score" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#050818] border-blue-500/30 text-white">
                        <SelectItem value="580-598">580–598</SelectItem>
                        <SelectItem value="599-617">599–617</SelectItem>
                        <SelectItem value="618-636">618–636</SelectItem>
                        <SelectItem value="637-655">637–655</SelectItem>
                        <SelectItem value="656-674">656–674</SelectItem>
                        <SelectItem value="675-693">675–693</SelectItem>
                        <SelectItem value="694-712">694–712</SelectItem>
                        <SelectItem value="713-731">713–731</SelectItem>
                        <SelectItem value="732-750">732–750</SelectItem>
                        <SelectItem value="751-769">751–769</SelectItem>
                        <SelectItem value="770+">770–780+</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Email</Label>
                    <Input {...register("email")} type="email" className="glass-input h-12" />
                    {errors.email && <span className="text-red-400 text-xs">{errors.email.message}</span>}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-blue-200">Phone</Label>
                    <Input {...register("phone")} type="tel" className="glass-input h-12" />
                    {errors.phone && <span className="text-red-400 text-xs">{errors.phone.message}</span>}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="mt-8 flex gap-3">
            {step > 0 && (
              <GlassButton 
                type="button" 
                variant="secondary" 
                onClick={prevStep}
                className="w-14 px-0"
              >
                <ArrowLeft className="w-5 h-5" />
              </GlassButton>
            )}
            
            {step < 2 ? (
              <GlassButton 
                type="button" 
                onClick={nextStep} 
                className="flex-1"
                data-testid="button-next-step"
              >
                Next Step <ChevronRight className="w-4 h-4 ml-2" />
              </GlassButton>
            ) : (
              <GlassButton 
                type="submit" 
                isLoading={isPending}
                className="flex-1"
                data-testid="button-get-rates"
              >
                Get My Rates
              </GlassButton>
            )}
          </div>
        </form>
      </div>
      
      <p className="text-center text-xs text-blue-200/50 mt-6 max-w-xs mx-auto leading-relaxed">
        By clicking "Get My Rates", you agree to our Terms of Use and Privacy Policy. Your information is secure.
      </p>
    </div>
  );
}
