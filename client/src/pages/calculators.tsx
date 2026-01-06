import { motion } from "framer-motion";
import { Calculator, Home as HomeIcon, FileText, DollarSign, Percent, TrendingDown, PiggyBank, Calendar, CreditCard, Building, BarChart3, Wallet, ArrowRightLeft, Clock, Target, Scale } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function NavigationBar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-[#050818]/80 backdrop-blur-xl border-b border-white/10">
      <div className="max-w-6xl mx-auto px-4 py-3">
        <div className="flex items-center justify-center gap-6 md:gap-10">
          <a 
            href="/"
            className="flex items-center gap-2 text-white/80 hover:text-[#5cffb5] transition-colors text-sm font-medium"
            data-testid="nav-home"
          >
            <HomeIcon className="w-4 h-4" />
            <span>Home</span>
          </a>
          <a 
            href="/calculators"
            className="flex items-center gap-2 text-[#5cffb5] transition-colors text-sm font-medium"
            data-testid="nav-calculator"
          >
            <Calculator className="w-4 h-4" />
            <span>Calculators</span>
          </a>
          <a 
            href="https://atozhomeloans.com/resources" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-white/80 hover:text-[#5cffb5] transition-colors text-sm font-medium"
            data-testid="nav-resources"
          >
            <FileText className="w-4 h-4" />
            <span>Resources</span>
          </a>
        </div>
      </div>
    </nav>
  );
}

interface CalculatorCardProps {
  title: string;
  features: string[];
  href: string;
  icon: React.ReactNode;
  featured?: boolean;
}

function CalculatorCard({ title, features, href, icon, featured }: CalculatorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card className={`relative overflow-visible bg-white/5 backdrop-blur-xl border-white/10 p-6 h-full flex flex-col hover-elevate ${featured ? 'ring-1 ring-[#5cffb5]/30' : ''}`}>
        <div className="flex items-start gap-4 mb-4">
          <div className={`p-3 rounded-lg ${featured ? 'bg-[#5cffb5]/20 text-[#5cffb5]' : 'bg-white/10 text-blue-200'}`}>
            {icon}
          </div>
          <h3 className="text-lg font-semibold text-white flex-1">{title}</h3>
        </div>
        <ul className="space-y-2 mb-6 flex-1">
          {features.map((feature, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-blue-200/70">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5cffb5]/60 mt-1.5 flex-shrink-0" />
              {feature}
            </li>
          ))}
        </ul>
        <Button 
          variant="outline" 
          className="w-full border-white/20 text-white hover:bg-white/10"
          asChild
        >
          <a href={href} data-testid={`calculator-${title.toLowerCase().replace(/\s+/g, '-')}`}>
            Use Calculator
          </a>
        </Button>
      </Card>
    </motion.div>
  );
}

const popularCalculators = [
  {
    title: "Mortgage Calculator",
    features: [
      "Monthly payment calculation",
      "Principal and interest breakdown",
      "Tax and insurance estimates",
      "PMI calculation when applicable"
    ],
    href: "https://atozhomeloans.com/mortgage-calculator",
    icon: <DollarSign className="w-5 h-5" />
  },
  {
    title: "Home Affordability Calculator",
    features: [
      "Income-based affordability analysis",
      "Debt-to-income ratio calculation",
      "Down payment impact assessment",
      "Regional cost adjustments"
    ],
    href: "https://atozhomeloans.com/affordability-calculator",
    icon: <Building className="w-5 h-5" />
  },
  {
    title: "Refinance Calculator",
    features: [
      "Compare current vs new loan terms",
      "Calculate break-even point",
      "Estimate monthly savings",
      "Factor in closing costs"
    ],
    href: "https://atozhomeloans.com/refinance-calculator",
    icon: <ArrowRightLeft className="w-5 h-5" />
  }
];

const allCalculators = [
  {
    title: "3/2/1 Buydown Calculator",
    features: [
      "3/2/1, 2/1, and 1/0 buydown support",
      "Total buydown fee calculation",
      "Third-party vs. borrower split"
    ],
    href: "https://atozhomeloans.com/buydown-calculator",
    icon: <TrendingDown className="w-5 h-5" />
  },
  {
    title: "Mortgage Tax Calculator",
    features: [
      "Interest deduction calculation",
      "Tax bracket considerations",
      "SALT limitation impact"
    ],
    href: "https://atozhomeloans.com/tax-calculator",
    icon: <Percent className="w-5 h-5" />
  },
  {
    title: "Amortization Calculator",
    features: [
      "Complete payment schedule",
      "Principal vs interest breakdown",
      "Remaining balance tracking"
    ],
    href: "https://atozhomeloans.com/amortization-calculator",
    icon: <Calendar className="w-5 h-5" />
  },
  {
    title: "Debt-to-Income Calculator",
    features: [
      "Front-end ratio calculation",
      "Back-end ratio analysis",
      "Improvement recommendations"
    ],
    href: "https://atozhomeloans.com/dti-calculator",
    icon: <Scale className="w-5 h-5" />
  },
  {
    title: "Interest-Only Calculator",
    features: [
      "Interest-only period analysis",
      "Payment shock calculation",
      "Equity building comparison"
    ],
    href: "https://atozhomeloans.com/interest-only-calculator",
    icon: <Clock className="w-5 h-5" />
  },
  {
    title: "Additional Payment Calculator",
    features: [
      "Interest savings calculation",
      "Time reduction analysis",
      "Various payment strategies"
    ],
    href: "https://atozhomeloans.com/additional-payment-calculator",
    icon: <PiggyBank className="w-5 h-5" />
  },
  {
    title: "Down Payment Calculator",
    features: [
      "PMI threshold analysis",
      "Payment impact comparison",
      "Opportunity cost evaluation"
    ],
    href: "https://atozhomeloans.com/down-payment-calculator",
    icon: <Wallet className="w-5 h-5" />
  },
  {
    title: "Bi-Weekly Payment Calculator",
    features: [
      "Accelerated payoff timeline",
      "Interest savings calculation",
      "Payment schedule comparison"
    ],
    href: "https://atozhomeloans.com/biweekly-calculator",
    icon: <Calendar className="w-5 h-5" />
  },
  {
    title: "Prepayment Reduction Calculator",
    features: [
      "Current or original loan terms",
      "Extra payment impact analysis",
      "Annual payment increase option"
    ],
    href: "https://atozhomeloans.com/prepayment-calculator",
    icon: <Target className="w-5 h-5" />
  },
  {
    title: "Loan-to-Value Calculator",
    features: [
      "Current LTV calculation",
      "Equity position analysis",
      "Refinancing eligibility"
    ],
    href: "https://atozhomeloans.com/ltv-calculator",
    icon: <BarChart3 className="w-5 h-5" />
  },
  {
    title: "ARM Calculator",
    features: [
      "Rate adjustment scenarios",
      "Payment caps analysis",
      "Worst-case scenario planning"
    ],
    href: "https://atozhomeloans.com/arm-calculator",
    icon: <TrendingDown className="w-5 h-5" />
  },
  {
    title: "Balloon Mortgage Calculator",
    features: [
      "Lower monthly payments during term",
      "Calculate balloon payment amount",
      "Plan for refinancing or payoff"
    ],
    href: "https://atozhomeloans.com/balloon-calculator",
    icon: <CreditCard className="w-5 h-5" />
  },
  {
    title: "Blended Rate Calculator",
    features: [
      "Combine up to 6 loans",
      "Weighted average calculation",
      "Visual balance distribution"
    ],
    href: "https://atozhomeloans.com/blended-calculator",
    icon: <BarChart3 className="w-5 h-5" />
  }
];

export default function Calculators() {
  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col">
      <div className="bg-galaxy" />
      <div className="bg-stars" />
      <NavigationBar />
      
      <main className="flex-1 p-4 md:p-8 pt-20 md:pt-24 relative z-10">
        <div className="max-w-6xl mx-auto space-y-16">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center space-y-4"
          >
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Calculators
            </h1>
            <p className="text-lg text-blue-100/80 max-w-2xl mx-auto">
              Empower your financial decisions. Explore our modern calculators for personalized insights and confident planning.
            </p>
          </motion.div>

          <section className="space-y-8">
            <motion.h2 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-2xl font-semibold text-white"
            >
              Popular Calculators
            </motion.h2>
            <div className="grid md:grid-cols-3 gap-6">
              {popularCalculators.map((calc, i) => (
                <CalculatorCard key={i} {...calc} featured />
              ))}
            </div>
          </section>

          <section className="space-y-8">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
            >
              <h2 className="text-2xl font-semibold text-white mb-2">All Calculators</h2>
              <p className="text-blue-200/60">
                Comprehensive tools for every stage of your homebuying and refinancing journey.
              </p>
            </motion.div>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {allCalculators.map((calc, i) => (
                <CalculatorCard key={i} {...calc} />
              ))}
            </div>
          </section>

          <div className="pb-20 text-center">
            <a 
              href="/admin/login" 
              className="text-[10px] text-blue-200/30 hover:text-blue-200/50 transition-colors"
              data-testid="link-admin-login"
            >
              Admin
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
