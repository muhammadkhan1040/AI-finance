import { parseRateSheet, type ParsedRateSheet, type ParsedRate } from './rateSheetParser';
import { storage } from './storage';

export interface LoanParameters {
  loanAmount: number;
  propertyValue: number;
  loanTerm: string;
  loanType: string;
  propertyType: string;
  creditScore: string;
  loanPurpose: string;
}

export interface PricingScenario {
  rate: number;
  apr: number;
  monthlyPayment: number;
  pointsPercent: number;
  pointsDollar: number;
  isCredit: boolean;
  scenarioLabel: string;
}

export interface LenderQuote {
  lenderName: string;
  scenarios: PricingScenario[];
  basePrice: number;
  adjustedPrice: number;
}

export interface PricingResult {
  quotes: LenderQuote[];
  bestQuote: LenderQuote | null;
  validationPassed: boolean;
  parseErrors: string[];
}

// Lender margin (internal only - not shown to customer)
const LENDER_MARGIN = 2.25;

function calculateMonthlyPayment(principal: number, annualRate: number, termYears: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  
  if (monthlyRate === 0) {
    return principal / numPayments;
  }
  
  return principal * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
         (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function calculateApr(
  principal: number, 
  annualRate: number, 
  termYears: number, 
  totalFees: number
): number {
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termYears);
  const totalPayments = monthlyPayment * termYears * 12;
  const totalInterest = totalPayments - principal;
  const effectiveInterest = totalInterest + totalFees;
  
  const apr = (effectiveInterest / principal) / termYears * 100;
  return Math.round(apr * 1000) / 1000;
}

function getTermYears(loanTerm: string): number {
  const match = loanTerm.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 30;
}

interface RateOption {
  rate: number;
  price: number;
  pointsPercent: number;
  pointsDollar: number;
  isCredit: boolean;
}

// Get sorted rate options from rate sheet, using raw prices
function getSortedRateOptions(
  rates: ParsedRate[],
  params: LoanParameters
): RateOption[] {
  const termYears = getTermYears(params.loanTerm);
  const loanTermKey = `${termYears}yr`;
  
  // Filter by term and type
  let filteredRates = rates.filter(r => 
    r.loanTerm === loanTermKey && 
    (r.loanType === params.loanType || r.loanType === 'conventional')
  );
  
  console.log(`[PRICING] Term: ${loanTermKey}, Type: ${params.loanType}`);
  console.log(`[PRICING] Found ${filteredRates.length} matching rates out of ${rates.length} total`);
  
  if (filteredRates.length === 0) {
    const allForTerm = rates.filter(r => r.loanTerm === loanTermKey);
    console.log(`[PRICING] No type match, falling back to term only: ${allForTerm.length} rates`);
    if (allForTerm.length === 0) return [];
    filteredRates = allForTerm;
  }
  
  // Sort by rate (ascending - lowest rate first)
  const sortedRates = [...filteredRates].sort((a, b) => a.rate - b.rate);
  
  // Log all rates for debugging
  console.log(`[PRICING] All rates sorted by rate:`);
  sortedRates.forEach(r => {
    const pointsFromPar = 100 - r.price15Day;
    const isCredit = pointsFromPar < 0;
    console.log(`  Rate ${r.rate}% -> Price ${r.price15Day.toFixed(3)} -> ${isCredit ? 'Credit' : 'Points'}: ${Math.abs(pointsFromPar).toFixed(3)}%`);
  });
  
  // Convert to RateOptions with calculated points/credits
  return sortedRates.map(r => {
    const pointsFromPar = 100 - r.price15Day;
    const isCredit = pointsFromPar < 0;
    const pointsPercent = Math.abs(pointsFromPar);
    const pointsDollar = params.loanAmount * (pointsPercent / 100);
    
    return {
      rate: r.rate,
      price: r.price15Day,
      pointsPercent,
      pointsDollar,
      isCredit,
    };
  });
}

// Find the rate closest to par (price = 100)
function findParRateIndex(options: RateOption[]): number {
  if (options.length === 0) return -1;
  
  let parIndex = 0;
  let minDiff = Math.abs(options[0].price - 100);
  
  for (let i = 1; i < options.length; i++) {
    const diff = Math.abs(options[i].price - 100);
    if (diff < minDiff) {
      minDiff = diff;
      parIndex = i;
    }
  }
  
  console.log(`[PRICING] Par rate index: ${parIndex}, rate: ${options[parIndex].rate}%, price: ${options[parIndex].price.toFixed(3)}`);
  return parIndex;
}

function createPricingScenarioFromOption(
  option: RateOption,
  params: LoanParameters,
  scenarioLabel: string
): PricingScenario {
  const termYears = getTermYears(params.loanTerm);
  const monthlyPayment = calculateMonthlyPayment(params.loanAmount, option.rate, termYears);
  
  const baseFees = 1500;
  const totalFees = option.isCredit ? Math.max(0, baseFees - option.pointsDollar) : baseFees + option.pointsDollar;
  const apr = calculateApr(params.loanAmount, option.rate, termYears, totalFees);
  
  console.log(`[PRICING] Creating scenario: ${scenarioLabel}`);
  console.log(`  Rate: ${option.rate}%, Price: ${option.price.toFixed(3)}, ${option.isCredit ? 'Credit' : 'Points'}: $${option.pointsDollar.toFixed(2)} (${option.pointsPercent.toFixed(3)}%)`);
  
  return {
    rate: Math.round(option.rate * 1000) / 1000,
    apr: Math.round(apr * 1000) / 1000,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    pointsPercent: Math.round(option.pointsPercent * 1000) / 1000,
    pointsDollar: Math.round(option.pointsDollar * 100) / 100,
    isCredit: option.isCredit,
    scenarioLabel,
  };
}

async function generateQuoteFromRateSheet(
  parsedSheet: ParsedRateSheet,
  params: LoanParameters
): Promise<LenderQuote | null> {
  if (!parsedSheet.parseSuccess || parsedSheet.rates.length === 0) {
    return null;
  }
  
  console.log(`\n[PRICING] ========== Processing ${parsedSheet.lenderName} ==========`);
  
  // Get all rate options sorted by rate (lowest first)
  const rateOptions = getSortedRateOptions(parsedSheet.rates, params);
  
  if (rateOptions.length === 0) {
    console.log(`[PRICING] No rate options found for ${parsedSheet.lenderName}`);
    return null;
  }
  
  // Find the par rate (price closest to 100)
  const parIndex = findParRateIndex(rateOptions);
  if (parIndex === -1) return null;
  
  const scenarios: PricingScenario[] = [];
  
  // Scenario 1: Par Rate (price closest to 100)
  const parOption = rateOptions[parIndex];
  scenarios.push(createPricingScenarioFromOption(
    parOption,
    params,
    parOption.isCredit ? "Par Rate (Small Credit)" : "Par Rate (No Points)"
  ));
  
  // Scenario 2: Buy down - go to lower rates (higher index in sorted list = higher rate, so go lower index)
  // Lower rate = pay more points (price < 100)
  // Find a rate that requires paying ~1 point
  let buyDownOption: RateOption | null = null;
  for (let i = parIndex - 1; i >= 0; i--) {
    if (rateOptions[i].pointsPercent >= 0.75 && !rateOptions[i].isCredit) {
      buyDownOption = rateOptions[i];
      break;
    }
  }
  // If no ~1 point option found, take the lowest available rate
  if (!buyDownOption && parIndex > 0) {
    buyDownOption = rateOptions[0];
  }
  if (buyDownOption && buyDownOption.rate !== parOption.rate) {
    scenarios.push(createPricingScenarioFromOption(
      buyDownOption,
      params,
      "Pay Points (Lower Rate)"
    ));
  }
  
  // Scenario 3: Even more buy down - lowest rate available
  if (parIndex > 1 && rateOptions[0].rate !== buyDownOption?.rate && rateOptions[0].rate !== parOption.rate) {
    scenarios.push(createPricingScenarioFromOption(
      rateOptions[0],
      params,
      "Pay Points (Lowest Rate)"
    ));
  }
  
  // Scenario 4: Credit - go to higher rates (price > 100 = credit)
  // Find a rate that gives meaningful credit
  let creditOption: RateOption | null = null;
  for (let i = parIndex + 1; i < rateOptions.length; i++) {
    if (rateOptions[i].isCredit && rateOptions[i].pointsPercent >= 0.5) {
      creditOption = rateOptions[i];
      break;
    }
  }
  // If no meaningful credit found, take the highest rate with credit
  if (!creditOption) {
    for (let i = rateOptions.length - 1; i > parIndex; i--) {
      if (rateOptions[i].isCredit) {
        creditOption = rateOptions[i];
        break;
      }
    }
  }
  if (creditOption && creditOption.rate !== parOption.rate) {
    scenarios.push(createPricingScenarioFromOption(
      creditOption,
      params,
      "Receive Lender Credit"
    ));
  }
  
  // Also show high credit option if available
  if (rateOptions.length > parIndex + 2) {
    const highCreditOption = rateOptions[rateOptions.length - 1];
    if (highCreditOption.isCredit && 
        highCreditOption.rate !== creditOption?.rate && 
        highCreditOption.rate !== parOption.rate &&
        highCreditOption.pointsPercent >= 1.5) {
      scenarios.push(createPricingScenarioFromOption(
        highCreditOption,
        params,
        "Maximum Lender Credit"
      ));
    }
  }
  
  console.log(`[PRICING] Generated ${scenarios.length} scenarios for ${parsedSheet.lenderName}`);
  
  return {
    lenderName: parsedSheet.lenderName,
    scenarios,
    basePrice: parOption.price,
    adjustedPrice: parOption.price,
  };
}

function validatePricingResult(result1: PricingResult, result2: PricingResult): boolean {
  if (result1.quotes.length !== result2.quotes.length) {
    console.error("Validation failed: quote count mismatch");
    return false;
  }
  
  for (let i = 0; i < result1.quotes.length; i++) {
    const q1 = result1.quotes[i];
    const q2 = result2.quotes[i];
    
    if (q1.lenderName !== q2.lenderName) {
      console.error("Validation failed: lender name mismatch");
      return false;
    }
    
    for (let j = 0; j < q1.scenarios.length; j++) {
      const s1 = q1.scenarios[j];
      const s2 = q2.scenarios[j];
      
      if (Math.abs(s1.rate - s2.rate) > 0.001) {
        console.error(`Validation failed: rate mismatch ${s1.rate} vs ${s2.rate}`);
        return false;
      }
      
      if (Math.abs(s1.monthlyPayment - s2.monthlyPayment) > 0.01) {
        console.error(`Validation failed: payment mismatch ${s1.monthlyPayment} vs ${s2.monthlyPayment}`);
        return false;
      }
    }
  }
  
  return true;
}

async function runPricingPass(params: LoanParameters): Promise<PricingResult> {
  const activeSheets = await storage.getActiveRateSheets();
  const quotes: LenderQuote[] = [];
  const parseErrors: string[] = [];
  
  for (const sheet of activeSheets) {
    const parsed = await parseRateSheet(sheet.fileData, sheet.fileName, sheet.lenderName);
    
    if (!parsed.parseSuccess) {
      parseErrors.push(`${sheet.lenderName}: ${parsed.parseError}`);
      continue;
    }
    
    const quote = await generateQuoteFromRateSheet(parsed, params);
    if (quote) {
      quotes.push(quote);
    }
  }
  
  quotes.sort((a, b) => {
    const aRate = a.scenarios[0]?.rate || 100;
    const bRate = b.scenarios[0]?.rate || 100;
    return aRate - bRate;
  });
  
  return {
    quotes,
    bestQuote: quotes.length > 0 ? quotes[0] : null,
    validationPassed: true,
    parseErrors,
  };
}

export async function calculateRates(params: LoanParameters): Promise<PricingResult> {
  const pass1 = await runPricingPass(params);
  const pass2 = await runPricingPass(params);
  
  const validationPassed = validatePricingResult(pass1, pass2);
  
  if (!validationPassed) {
    console.error("Pricing validation failed - results differ between passes");
  }
  
  return {
    ...pass1,
    validationPassed,
  };
}

export function generateMockQuotes(params: LoanParameters): LenderQuote[] {
  const termYears = getTermYears(params.loanTerm);
  const ltv = (params.loanAmount / params.propertyValue) * 100;
  
  let baseRate = 6.5;
  
  switch (params.creditScore) {
    case "excellent": baseRate -= 0.375; break;
    case "good": baseRate -= 0.125; break;
    case "fair": baseRate += 0.25; break;
    case "poor": baseRate += 0.625; break;
  }
  
  if (ltv > 80) baseRate += 0.125;
  if (ltv > 90) baseRate += 0.125;
  
  if (params.loanType === "fha") baseRate -= 0.25;
  if (params.loanType === "va") baseRate -= 0.375;
  if (params.loanType === "jumbo") baseRate += 0.25;
  
  if (termYears === 15) baseRate -= 0.5;
  if (termYears === 20) baseRate -= 0.25;
  
  const lenders = [
    { name: "Lender A", offset: 0 },
    { name: "Lender B", offset: 0.125 },
    { name: "Lender C", offset: 0.0625 },
  ];
  
  return lenders.map(lender => {
    const lenderRate = baseRate + lender.offset;
    
    const scenarios: PricingScenario[] = [
      {
        rate: Math.round(lenderRate * 1000) / 1000,
        apr: Math.round((lenderRate + 0.15) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate, termYears) * 100) / 100,
        pointsPercent: 0,
        pointsDollar: 0,
        isCredit: false,
        scenarioLabel: "Best Available Rate (Par)",
      },
      {
        rate: Math.round((lenderRate - 0.25) * 1000) / 1000,
        apr: Math.round((lenderRate - 0.1) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate - 0.25, termYears) * 100) / 100,
        pointsPercent: 1.0,
        pointsDollar: params.loanAmount * 0.01,
        isCredit: false,
        scenarioLabel: "Pay 1 Point (Lower Rate)",
      },
      {
        rate: Math.round((lenderRate - 0.375) * 1000) / 1000,
        apr: Math.round((lenderRate - 0.225) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate - 0.375, termYears) * 100) / 100,
        pointsPercent: 1.5,
        pointsDollar: params.loanAmount * 0.015,
        isCredit: false,
        scenarioLabel: "Pay 1.5 Points (Lowest Rate)",
      },
      {
        rate: Math.round((lenderRate + 0.125) * 1000) / 1000,
        apr: Math.round((lenderRate + 0.275) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate + 0.125, termYears) * 100) / 100,
        pointsPercent: 0.5,
        pointsDollar: params.loanAmount * 0.005,
        isCredit: true,
        scenarioLabel: "Receive 0.5 Point Credit",
      },
    ];
    
    return {
      lenderName: lender.name,
      scenarios,
      basePrice: 100,
      adjustedPrice: 100,
    };
  });
}
