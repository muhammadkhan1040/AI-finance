import { parseRateSheet, type ParsedRateSheet, type ParsedRate } from './rateSheetParser';
import { storage } from './storage';
import { queryLlamaCloudForRates, selectBestRate, type LlamaCloudRate } from './llamaCloudService';

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
const LENDER_MARGIN = 2.50;

// LLPA (Loan-Level Price Adjustments) lookup based on FICO, LTV, and property type
function lookupLLPAs(params: LoanParameters): number {
  let adjustment = 0;
  const ltv = (params.loanAmount / params.propertyValue) * 100;
  
  // Credit score adjustments (based on typical Fannie Mae LLPAs)
  switch (params.creditScore) {
    case "excellent": // 740+
      if (ltv <= 60) adjustment += 0;
      else if (ltv <= 75) adjustment += 0.25;
      else if (ltv <= 80) adjustment += 0.25;
      else if (ltv <= 85) adjustment += 0.25;
      else if (ltv <= 90) adjustment += 0.50;
      else adjustment += 0.75;
      break;
    case "good": // 700-739
      if (ltv <= 60) adjustment += 0.25;
      else if (ltv <= 75) adjustment += 0.50;
      else if (ltv <= 80) adjustment += 0.75;
      else if (ltv <= 85) adjustment += 1.00;
      else if (ltv <= 90) adjustment += 1.25;
      else adjustment += 1.50;
      break;
    case "fair": // 660-699
      if (ltv <= 60) adjustment += 0.75;
      else if (ltv <= 75) adjustment += 1.25;
      else if (ltv <= 80) adjustment += 1.75;
      else if (ltv <= 85) adjustment += 2.25;
      else if (ltv <= 90) adjustment += 2.75;
      else adjustment += 3.25;
      break;
    case "poor": // Below 660
      if (ltv <= 60) adjustment += 1.50;
      else if (ltv <= 75) adjustment += 2.00;
      else if (ltv <= 80) adjustment += 2.75;
      else if (ltv <= 85) adjustment += 3.25;
      else if (ltv <= 90) adjustment += 3.50;
      else adjustment += 3.75;
      break;
  }
  
  // Property type adjustments
  switch (params.propertyType) {
    case "condo":
      adjustment += 0.75;
      break;
    case "multi-family":
    case "2-4 unit":
      adjustment += 1.00;
      break;
    case "manufactured":
      adjustment += 1.50;
      break;
    case "investment":
      adjustment += 1.75;
      break;
  }
  
  // Loan purpose adjustments
  if (params.loanPurpose === "refinance-cashout") {
    adjustment += 0.375;
  }
  
  // LLPA adjustments are ADDED to customer points (positive = customer pays more)
  console.log(`[PRICING] LLPA Adjustments: +${adjustment.toFixed(3)} (Credit: ${params.creditScore}, LTV: ${ltv.toFixed(1)}%, Property: ${params.propertyType})`);
  return adjustment;
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

interface RateOption {
  rate: number;
  price: number;
  pointsPercent: number;
  pointsDollar: number;
  isCredit: boolean;
}

// Get sorted rate options from rate sheet, using Target Price logic
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
  
  // Deduplicate rates - keep BEST price (highest wholesale) for each rate
  // This handles cases where we have both Freddie Mac and Fannie Mae prices
  const rateMap = new Map<number, ParsedRate>();
  for (const r of filteredRates) {
    const existing = rateMap.get(r.rate);
    if (!existing || r.price15Day > existing.price15Day) {
      rateMap.set(r.rate, r);
    }
  }
  filteredRates = Array.from(rateMap.values());
  console.log(`[PRICING] After deduplication (best price per rate): ${filteredRates.length} unique rates`);
  
  // Calculate customer points using lender pricing formula:
  // Points = (100 - Wholesale) + LLPAs + Compensation
  // Where:
  //   (100 - Wholesale) = raw price-to-points conversion
  //   LLPAs = FICO/LTV/Property adjustments (positive = customer pays more)
  //   Compensation = broker margin
  const llpaAdjustments = lookupLLPAs(params);
  console.log(`[PRICING] Formula: Points = (100 - Wholesale) + ${llpaAdjustments.toFixed(3)} LLPAs + ${LENDER_MARGIN} Comp`);
  
  // Sort by rate (ascending - lowest rate first)
  const sortedRates = [...filteredRates].sort((a, b) => a.rate - b.rate);
  
  // Log all rates for debugging
  console.log(`[PRICING] All rates sorted by rate:`);
  sortedRates.forEach(r => {
    const wholesalePrice = r.price15Day; // Using 15-day lock
    const basePoints = 100 - wholesalePrice; // Negative = credit from lender
    const customerPoints = basePoints + llpaAdjustments + LENDER_MARGIN;
    const isCredit = customerPoints < 0;
    console.log(`  Rate ${r.rate}% -> Wholesale ${wholesalePrice.toFixed(3)} -> Base ${basePoints.toFixed(3)} + LLPAs ${llpaAdjustments.toFixed(3)} + Comp ${LENDER_MARGIN} = ${isCredit ? 'Credit' : 'Points'}: ${Math.abs(customerPoints).toFixed(3)}%`);
  });
  
  // Convert to RateOptions with calculated points/credits
  // Points = (100 - Wholesale) + LLPAs + LENDER_MARGIN
  // Positive = customer pays points
  // Negative = customer receives credit
  return sortedRates.map(r => {
    const wholesalePrice = r.price15Day; // Using 15-day lock per requirement
    const basePoints = 100 - wholesalePrice;
    const customerPoints = basePoints + llpaAdjustments + LENDER_MARGIN;
    const isCredit = customerPoints < 0;
    const pointsPercent = Math.abs(customerPoints);
    const pointsDollar = params.loanAmount * (pointsPercent / 100);
    
    return {
      rate: r.rate,
      price: wholesalePrice,
      pointsPercent: Math.round(pointsPercent * 1000) / 1000,
      pointsDollar: Math.round(pointsDollar * 100) / 100,
      isCredit,
    };
  });
}

// Find the "True Par" rate - closest to 0 points after Target Price calculation
function findParRateIndex(options: RateOption[]): number {
  if (options.length === 0) return -1;
  
  let parIndex = 0;
  let minPoints = options[0].pointsPercent;
  
  for (let i = 1; i < options.length; i++) {
    if (options[i].pointsPercent < minPoints) {
      minPoints = options[i].pointsPercent;
      parIndex = i;
    }
  }
  
  const parOption = options[parIndex];
  console.log(`[PRICING] True Par rate index: ${parIndex}, rate: ${parOption.rate}%, points: ${parOption.isCredit ? '-' : ''}${parOption.pointsPercent.toFixed(3)}%`);
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

function convertLlamaCloudRatesToParsedRates(llamaRates: LlamaCloudRate[]): ParsedRate[] {
  return llamaRates.map(rate => ({
    rate: rate.interestRate,
    price15Day: rate.price15Day,
    price30Day: rate.price30Day || rate.price15Day,
    price45Day: rate.price45Day || rate.price15Day,
    loanTerm: rate.loanTerm,
    loanType: rate.loanType,
  }));
}

const MIN_RATES_THRESHOLD = 5;

async function runLlamaCloudPricingPass(params: LoanParameters): Promise<PricingResult> {
  const ltv = (params.loanAmount / params.propertyValue) * 100;
  
  console.log("[PRICING] Querying LlamaCloud for rates...");
  console.log(`[PRICING] Params: Credit=${params.creditScore}, LTV=${ltv.toFixed(1)}%, Purpose=${params.loanPurpose}, Type=${params.loanType}, Term=${params.loanTerm}`);
  
  const llamaResult = await queryLlamaCloudForRates({
    creditScore: params.creditScore,
    ltv,
    loanPurpose: params.loanPurpose,
    loanType: params.loanType,
    loanTerm: params.loanTerm,
  });
  
  if (!llamaResult.success) {
    console.log("[PRICING] LlamaCloud query failed, falling back to local parsing");
    return runLocalPricingPass(params);
  }
  
  if (llamaResult.rates.length < MIN_RATES_THRESHOLD) {
    console.log(`[PRICING] LlamaCloud returned only ${llamaResult.rates.length} rates (below threshold of ${MIN_RATES_THRESHOLD}), falling back to local parsing`);
    return runLocalPricingPass(params);
  }
  
  console.log(`[PRICING] LlamaCloud returned ${llamaResult.rates.length} rates`);
  
  const ratesByLender = new Map<string, LlamaCloudRate[]>();
  for (const rate of llamaResult.rates) {
    const lenderName = rate.lenderName || "Lender";
    if (!ratesByLender.has(lenderName)) {
      ratesByLender.set(lenderName, []);
    }
    ratesByLender.get(lenderName)!.push(rate);
  }
  
  const quotes: LenderQuote[] = [];
  
  const lenderNames = Array.from(ratesByLender.keys());
  for (const lenderName of lenderNames) {
    const lenderRates = ratesByLender.get(lenderName)!;
    const parsedRates = convertLlamaCloudRatesToParsedRates(lenderRates);
    const parsedSheet: ParsedRateSheet = {
      lenderName,
      rates: parsedRates,
      parseSuccess: true,
    };
    
    const quote = await generateQuoteFromRateSheet(parsedSheet, params);
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
    parseErrors: [],
  };
}

async function runLocalPricingPass(params: LoanParameters): Promise<PricingResult> {
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

async function runPricingPass(params: LoanParameters): Promise<PricingResult> {
  // Prioritize local Excel parsing as it reads columns directly and is more accurate
  // LlamaCloud text extraction may not correctly identify price columns
  console.log("[PRICING] Using local Excel parsing for accurate rate extraction");
  
  const localResult = await runLocalPricingPass(params);
  
  // If local parsing found quotes, use them
  if (localResult.quotes.length > 0) {
    console.log(`[PRICING] Local parsing found ${localResult.quotes.length} lender quotes`);
    return localResult;
  }
  
  // Only try LlamaCloud as fallback if local parsing found nothing
  const useLlamaCloud = process.env.LLAMA_CLOUD_API_KEY && process.env.USE_LLAMA_CLOUD !== "false";
  
  if (useLlamaCloud) {
    try {
      console.log("[PRICING] No local quotes found, trying LlamaCloud as fallback...");
      return await runLlamaCloudPricingPass(params);
    } catch (error) {
      console.error("[PRICING] LlamaCloud error:", error);
    }
  }
  
  return localResult;
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
