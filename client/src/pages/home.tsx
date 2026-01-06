import { useState } from "react";
import { LeadForm } from "@/components/LeadForm";
import { RatesDisplay } from "@/components/RatesDisplay";
import { type Rate, type Lead } from "@shared/schema";
import { motion } from "framer-motion";
import { Zap, ShieldCheck, Clock, HelpCircle } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function Home() {
  const [ratesData, setRatesData] = useState<{rates: Rate[], lead: Lead} | null>(null);

  const handleRatesReceived = (rates: Rate[], lead: Lead) => {
    setRatesData({ rates, lead });
  };

  const reviews = [
    { text: "Jerald made everything simple and fast.", author: "Sarah M.", stars: 5 },
    { text: "Best mortgage experience we've ever had.", author: "Daniel R.", stars: 5 },
    { text: "Closed on time and saved us money.", author: "The Lopez Family", stars: 5 },
    { text: "4.9★ rated on Google Reviews", author: "Google", stars: 5 },
  ];

  const faqs = [
    {
      question: "How does the AI check my rate?",
      answer: "Our AI reviews real-time market pricing, lender guidelines, and the details you provide to identify the most accurate rate options available—without guesswork or sales bias. It’s designed to give you a clear, realistic view of what you actually qualify for before you decide to move forward."
    },
    {
      question: "Does this affect my credit?",
      answer: "No. We don’t check your credit while you’re exploring options. We use your input to understand where you’re at and provide guidance. A credit check only happens if you choose to apply and move forward to lock a rate."
    },
    {
      question: "Do you offer different mortgage options?",
      answer: "Yes. We offer multiple loan options and match you with the one that best fits your goals and financial situation—clearly explained, no one-size-fits-all approach, and focused on long-term value whether you’re buying, refinancing, or just exploring."
    },
    {
      question: "What makes you different from other mortgage companies?",
      answer: "We do loans other lenders can’t by underwriting only to official guidelines—no extra overlays. That means clearer answers, more flexible options, and honest advice focused on the right outcome, not just closing a loan.(even if that means not moving forward)"
    },
    {
      question: "Can you help with both purchases and refinances?",
      answer: "Yes. We help Arizona buyers and homeowners with purchases, rate-and-term and cash-out refinances—whether you’re a first-time or repeat buyer. Our focus is helping you choose the right option, not pushing a loan that doesn’t fit."
    },
    {
      question: "Are you veteran friendly?",
      answer: "Yes. We proudly work with veterans and understand the full range of VA loan benefits. We assist with: VA purchase loans, VA refinance and IRRRL options, Understanding eligibility and entitlement, and Breaking down benefits, fees, and long-term value. Our goal is to make the process clear, straightforward, and respectful of the benefits you’ve earned."
    },
    {
      question: "Who is eligible for a reverse mortgage?",
      answer: "To be eligible for a reverse mortgage, you must be 62 or older, own your home (or have a low remaining mortgage balance), and live in the home as your primary residence. Eligibility is also based on the home type and meeting basic financial requirements to ensure you can maintain taxes, insurance, and upkeep. Reverse mortgages are designed to help eligible homeowners access their home equity without monthly mortgage payments."
    }
  ];

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="bg-galaxy" />
      <div className="bg-stars" />
      
      <main className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 relative z-10">
        
        {!ratesData ? (
          <div className="w-full max-w-6xl mx-auto space-y-24 py-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
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
                <LeadForm onRatesReceived={(rates, lead) => handleRatesReceived(rates, lead)} />
              </div>
            </div>

            {/* FAQ Section */}
            <motion.section 
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-3xl mx-auto w-full px-4"
            >
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Frequently Asked Questions</h2>
                <p className="text-blue-200/60">Everything you need to know about checking your rates.</p>
              </div>

              <div className="glass-card rounded-2xl p-6 md:p-8">
                <Accordion type="single" collapsible className="w-full space-y-4">
                  {faqs.map((faq, i) => (
                    <AccordionItem key={i} value={`item-${i}`} className="border-white/10">
                      <AccordionTrigger className="text-white hover:text-[#5cffb5] text-left py-4 no-underline hover:no-underline">
                        {faq.question}
                      </AccordionTrigger>
                      <AccordionContent className="text-blue-200/70 leading-relaxed pb-4">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            </motion.section>
          </div>
        ) : ratesData.lead.loanType === 'reverse' ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-4xl mx-auto py-8"
          >
            <div className="glass-card rounded-2xl p-6 md:p-8 space-y-6">
              <div className="text-center">
                <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Reverse Mortgage Calculator</h2>
                <p className="text-blue-200/70">Thank you, {ratesData.lead.firstName}! Use the calculator below to explore your reverse mortgage options.</p>
              </div>
              
              <div className="bg-white rounded-xl overflow-hidden" style={{ minHeight: '600px' }}>
                <iframe 
                  src="https://illustrator.financeofamerica.com/widgets/calculator/0_YgtdURPZuRMYdFB9abOo8zhhxigE4rxcI4GdPDa9bSLzpD18XSYRntxldn1YBNaiVmC9sBJJuIMookbIQGRwI3exLFue52INY14yW0faU"
                  title="Finance of America Reverse Mortgage Calculator"
                  className="w-full h-[600px] border-0"
                  data-testid="iframe-reverse-calculator"
                />
              </div>
              
              <div className="text-center">
                <button
                  onClick={() => setRatesData(null)}
                  className="text-blue-200/60 hover:text-white text-sm underline transition-colors"
                  data-testid="button-start-over"
                >
                  Start Over
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          <RatesDisplay 
            rates={ratesData!.rates} 
            lead={ratesData!.lead} 
            onReset={() => setRatesData(null)} 
          />
        )}

      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-white/5 bg-black/40 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-start mb-12">
            <div className="space-y-6">
              <p className="text-blue-200/40 text-xs leading-relaxed max-w-md">
                This is a tool for informational purposes only. Rates and programs are subject to change without notice. All loans are subject to credit and underwriting approval.
              </p>
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-blue-200/40 text-[10px] font-bold uppercase tracking-widest">
                  <ShieldCheck className="w-3 h-3" />
                  SECURE PORTAL
                </div>
                <div className="flex items-center gap-2 text-blue-200/40 text-[10px] font-bold uppercase tracking-widest">
                  <Clock className="w-3 h-3" />
                  REAL-TIME UPDATES
                </div>
              </div>
            </div>
            
            <div className="text-right space-y-4">
              <div className="text-white/80 font-bold text-sm">NMLS #2449185</div>
              <div className="text-blue-200/40 text-[10px] uppercase tracking-widest leading-loose">
                All Rights Reserved © 2026
              </div>
            </div>
          </div>
          
          <div className="space-y-4 text-blue-200/40 text-[10px] leading-relaxed border-t border-white/5 pt-8 text-left">
            <p>
              We comply with fair lending laws, such as the Equal Credit Opportunity Act, the Fair Housing Act, and the Home Mortgage Disclosure Act. We require annual fair lending training of all of our employees. And we strive every day, and in many different ways, to make sure that everyone has a positive experience with our company.
            </p>
            <p>
              We adhere to marketing rules, including those that address unfair or deceptive practices. We ensure that we provide clear, honest and accurate information to our customers and to the public. We do not want to bring customers in under false pretenses. We attract customers by providing them with an accurate understanding of what products we offer and how we do business.
            </p>
            <p>
              We are committed to complying with both the letter and the spirit of fair lending rules. This is not an intent to lend. Please get a loan estimate for most accurate up to date figures.
            </p>
          </div>

          <div className="pt-8 text-center space-y-2">
            <p className="text-blue-200/20 text-[10px] uppercase tracking-[0.2em]">
              Precision Crafted for A to Z Home Loans
            </p>
            <a 
              href="/admin" 
              className="text-blue-200/20 text-[10px] hover:text-blue-200/40 transition-colors"
              data-testid="link-admin"
            >
              Admin
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
