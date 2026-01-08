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

const LENDER_ADJUSTMENT = 2.25;

const CREDIT_SCORE_ADJUSTMENTS: Record<string, number> = {
  "excellent": 0.25,
  "good": 0,
  "fair": -0.375,
  "poor": -0.75,
};

const PROPERTY_TYPE_ADJUSTMENTS: Record<string, number> = {
  "single_family": 0,
  "condo": -0.125,
  "townhouse": -0.0625,
  "multi_family": -0.25,
  "manufactured": -0.5,
};

const LOAN_PURPOSE_ADJUSTMENTS: Record<string, number> = {
  "purchase": 0,
  "refinance": -0.125,
  "cash_out": -0.375,
};

function getLtvAdjustment(ltv: number): number {
  if (ltv <= 60) return 0.25;
  if (ltv <= 70) return 0.125;
  if (ltv <= 75) return 0;
  if (ltv <= 80) return -0.125;
  if (ltv <= 85) return -0.25;
  if (ltv <= 90) return -0.375;
  if (ltv <= 95) return -0.5;
  return -0.75;
}

function getLoanAmountAdjustment(loanAmount: number): number {
  if (loanAmount >= 500000) return 0.125;
  if (loanAmount >= 350000) return 0.0625;
  if (loanAmount >= 200000) return 0;
  if (loanAmount >= 100000) return -0.125;
  return -0.25;
}

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

function normalizePrice(
  basePrice: number,
  params: LoanParameters,
  includeLenderAdjustment: boolean = true
): number {
  const ltv = (params.loanAmount / params.propertyValue) * 100;
  
  let adjustedPrice = basePrice;
  
  if (includeLenderAdjustment) {
    adjustedPrice -= LENDER_ADJUSTMENT;
  }
  
  adjustedPrice += CREDIT_SCORE_ADJUSTMENTS[params.creditScore] || 0;
  adjustedPrice += PROPERTY_TYPE_ADJUSTMENTS[params.propertyType] || 0;
  adjustedPrice += LOAN_PURPOSE_ADJUSTMENTS[params.loanPurpose] || 0;
  adjustedPrice += getLtvAdjustment(ltv);
  adjustedPrice += getLoanAmountAdjustment(params.loanAmount);
  
  return adjustedPrice;
}

function findRateForTargetPoints(
  rates: ParsedRate[],
  params: LoanParameters,
  targetPointsFromPar: number
): { rate: number; internalPrice: number; customerPrice: number } | null {
  const termYears = getTermYears(params.loanTerm);
  const loanTermKey = `${termYears}yr`;
  
  const filteredRates = rates.filter(r => 
    r.loanTerm === loanTermKey && 
    (r.loanType === params.loanType || r.loanType === 'conventional')
  );
  
  if (filteredRates.length === 0) {
    const allForTerm = rates.filter(r => r.loanTerm === loanTermKey);
    if (allForTerm.length === 0) return null;
    filteredRates.push(...allForTerm);
  }
  
  let bestMatch: { rate: number; internalPrice: number; customerPrice: number; diff: number } | null = null;
  
  for (const rateData of filteredRates) {
    const internalPrice = normalizePrice(rateData.price15Day, params, true);
    const customerPrice = normalizePrice(rateData.price15Day, params, false);
    // Match using customerPrice (what customer sees), not internalPrice
    const customerPointsFromPar = 100 - customerPrice;
    const diff = Math.abs(customerPointsFromPar - targetPointsFromPar);
    
    if (!bestMatch || diff < bestMatch.diff) {
      bestMatch = {
        rate: rateData.rate,
        internalPrice,
        customerPrice,
        diff,
      };
    }
  }
  
  return bestMatch ? { rate: bestMatch.rate, internalPrice: bestMatch.internalPrice, customerPrice: bestMatch.customerPrice } : null;
}

function createPricingScenario(
  rate: number,
  customerPrice: number,
  params: LoanParameters,
  scenarioLabel: string
): PricingScenario {
  // Calculate actual points from the customer-facing price
  const pointsFromPar = 100 - customerPrice;
  const isCredit = pointsFromPar < 0;
  const pointsPercent = Math.abs(pointsFromPar);
  const pointsDollar = params.loanAmount * (pointsPercent / 100);
  
  const termYears = getTermYears(params.loanTerm);
  const monthlyPayment = calculateMonthlyPayment(params.loanAmount, rate, termYears);
  
  const baseFees = 1500;
  const totalFees = isCredit ? Math.max(0, baseFees - pointsDollar) : baseFees + pointsDollar;
  const apr = calculateApr(params.loanAmount, rate, termYears, totalFees);
  
  return {
    rate: Math.round(rate * 1000) / 1000,
    apr: Math.round(apr * 1000) / 1000,
    monthlyPayment: Math.round(monthlyPayment * 100) / 100,
    pointsPercent: Math.round(pointsPercent * 1000) / 1000,
    pointsDollar: Math.round(pointsDollar * 100) / 100,
    isCredit,
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
  
  const scenarios: PricingScenario[] = [];
  
  // Par rate (0 points) - customer pays nothing extra
  const bestRateData = findRateForTargetPoints(parsedSheet.rates, params, 0);
  if (bestRateData) {
    scenarios.push(createPricingScenario(
      bestRateData.rate,
      bestRateData.customerPrice,
      params,
      "Par Rate (No Points)"
    ));
  }
  
  // Pay 1 point for lower rate
  const onePointRate = findRateForTargetPoints(parsedSheet.rates, params, 1.0);
  if (onePointRate) {
    scenarios.push(createPricingScenario(
      onePointRate.rate,
      onePointRate.customerPrice,
      params,
      "Pay Points (Lower Rate)"
    ));
  }
  
  // Pay 1.5 points for even lower rate
  const oneHalfPointRate = findRateForTargetPoints(parsedSheet.rates, params, 1.5);
  if (oneHalfPointRate) {
    scenarios.push(createPricingScenario(
      oneHalfPointRate.rate,
      oneHalfPointRate.customerPrice,
      params,
      "Pay Points (Lowest Rate)"
    ));
  }
  
  // Receive credit (higher rate)
  const creditRate = findRateForTargetPoints(parsedSheet.rates, params, -0.5);
  if (creditRate) {
    scenarios.push(createPricingScenario(
      creditRate.rate,
      creditRate.customerPrice,
      params,
      "Receive Lender Credit"
    ));
  }
  
  if (scenarios.length === 0) {
    return null;
  }
  
  return {
    lenderName: parsedSheet.lenderName,
    scenarios,
    basePrice: bestRateData?.customerPrice || 100,
    adjustedPrice: bestRateData?.customerPrice || 100,
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
