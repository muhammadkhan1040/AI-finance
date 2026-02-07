import { parseRateSheet, type ParsedRateSheet, type ParsedRate, type AdjustmentGrid } from './rateSheetParser';
import { storage } from './storage';
import { queryLlamaCloudForRates, selectBestRate, type LlamaCloudRate } from './llamaCloudService';

export interface LoanParameters {
  loanAmount: number;
  propertyValue: number;
  loanTerm: string;
  loanType: string;
  propertyType: string;
  creditScore: string;  // "excellent", "good", "fair", "poor" OR "780+", "760-779", etc.
  loanPurpose: string;  // "purchase", "refinance", "refinance-cashout"
  state?: string;       // Two-letter state code
}

// NEW: Adjustment breakdown for "Show Your Work"
export interface AdjustmentBreakdown {
  gridName: string;
  lookupKey: string;   // e.g., "FICO 740-759 x LTV 75.01-80.00%"
  adjustment: number;
}

export interface PricingScenario {
  rate: number;
  apr: number;
  monthlyPayment: number;
  pointsPercent: number;
  pointsDollar: number;
  isCredit: boolean;
  scenarioLabel: string;
  netPrice: number;              // NEW: The calculated net price
  adjustmentBreakdown: AdjustmentBreakdown[];  // NEW: Show your work
}

export interface LenderQuote {
  lenderName: string;
  scenarios: PricingScenario[];
  basePrice: number;
  adjustedPrice: number;
  totalAdjustments: number;      // NEW: Total LLPA adjustments applied
}

export interface PricingResult {
  quotes: LenderQuote[];
  bestQuote: LenderQuote | null;
  validationPassed: boolean;
  parseErrors: string[];
}

// Lender margin (internal only - not shown to customer)
const LENDER_MARGIN = 2.50;

// Target prices for scenarios
const TARGET_PAR = 100.0;           // Par rate - no points, no credit
const TARGET_BUYDOWN_1_5 = 98.5;    // 1.5% buydown (customer pays 1.5 points)
const TARGET_CREDIT_0_5 = 100.5;    // 0.5% credit (customer receives credit)

// Convert credit score string to numeric FICO range
function creditScoreToFicoRange(creditScore: string): { min: number; max: number } {
  const scoreMap: Record<string, { min: number; max: number }> = {
    "excellent": { min: 760, max: 850 },
    "good": { min: 700, max: 759 },
    "fair": { min: 640, max: 699 },
    "poor": { min: 580, max: 639 },
    "780+": { min: 780, max: 850 },
    "760-780": { min: 760, max: 779 },
    "760-779": { min: 760, max: 779 },
    "740-759": { min: 740, max: 759 },
    "720-739": { min: 720, max: 739 },
    "700-719": { min: 700, max: 719 },
    "680-699": { min: 680, max: 699 },
    "660-679": { min: 660, max: 679 },
    "640-679": { min: 640, max: 679 },
    "640-659": { min: 640, max: 659 },
    "620-639": { min: 620, max: 639 },
    "601-619": { min: 601, max: 619 },
    "580-600": { min: 580, max: 600 },
  };
  return scoreMap[creditScore] || { min: 700, max: 719 };
}

// Parse a FICO range string from the grid (e.g., ">=780", "760-779", "<=639")
function parseFicoRange(rangeStr: string): { min: number; max: number } | null {
  const cleaned = rangeStr.trim();

  // Handle >=780 or ≥780
  if (/^[>≥]=?\s*(\d+)/.test(cleaned)) {
    const match = cleaned.match(/(\d+)/);
    if (match) return { min: parseInt(match[1]), max: 850 };
  }

  // Handle <=639 or ≤639
  if (/^[<≤]=?\s*(\d+)/.test(cleaned)) {
    const match = cleaned.match(/(\d+)/);
    if (match) return { min: 580, max: parseInt(match[1]) };
  }

  // Handle 760-779
  const rangeMatch = cleaned.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (rangeMatch) {
    return { min: parseInt(rangeMatch[1]), max: parseInt(rangeMatch[2]) };
  }

  return null;
}

// Parse an LTV range string from the grid (e.g., "<=30.00%", "75.01-80.00%", ">95.00%")
function parseLtvRange(rangeStr: string): { min: number; max: number } | null {
  const cleaned = rangeStr.replace(/%/g, '').trim();

  // Handle <=30.00
  if (/^[<≤]=?\s*([\d.]+)/.test(cleaned)) {
    const match = cleaned.match(/([\d.]+)/);
    if (match) return { min: 0, max: parseFloat(match[1]) };
  }

  // Handle >95.00
  if (/^[>≥]=?\s*([\d.]+)/.test(cleaned)) {
    const match = cleaned.match(/([\d.]+)/);
    if (match) return { min: parseFloat(match[1]), max: 100 };
  }

  // Handle 75.01-80.00
  const rangeMatch = cleaned.match(/([\d.]+)\s*[-–]\s*([\d.]+)/);
  if (rangeMatch) {
    return { min: parseFloat(rangeMatch[1]), max: parseFloat(rangeMatch[2]) };
  }

  return null;
}

// NEW: Look up a value in a FICO/LTV grid
function lookupGridValue(
  grid: AdjustmentGrid,
  fico: number,
  ltv: number
): { value: number; rowLabel: string; colLabel: string } | null {
  // Find the matching row (FICO)
  let rowIndex = -1;
  for (let i = 0; i < grid.axes.y.length; i++) {
    const range = parseFicoRange(grid.axes.y[i]);
    if (range && fico >= range.min && fico <= range.max) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) {
    // Try to find closest match
    for (let i = 0; i < grid.axes.y.length; i++) {
      const range = parseFicoRange(grid.axes.y[i]);
      if (range) {
        if (fico >= range.max) {
          rowIndex = i;
          break;
        }
        rowIndex = i; // Keep going to find the lowest bracket
      }
    }
  }

  if (rowIndex === -1) return null;

  // Find the matching column (LTV)
  let colIndex = -1;
  for (let i = 0; i < grid.axes.x.length; i++) {
    const range = parseLtvRange(grid.axes.x[i]);
    if (range && ltv >= range.min && ltv <= range.max) {
      colIndex = i;
      break;
    }
  }

  if (colIndex === -1) {
    // Try to find closest match
    for (let i = grid.axes.x.length - 1; i >= 0; i--) {
      const range = parseLtvRange(grid.axes.x[i]);
      if (range && ltv <= range.max) {
        colIndex = i;
        break;
      }
    }
  }

  if (colIndex === -1) return null;

  const value = grid.data[rowIndex]?.[colIndex];
  if (value === null || value === undefined) return null;

  return {
    value,
    rowLabel: grid.axes.y[rowIndex],
    colLabel: grid.axes.x[colIndex],
  };
}

// NEW: Look up property type adjustment
function lookupPropertyAdjustment(
  grid: AdjustmentGrid,
  propertyType: string,
  ltv: number
): { value: number; propertyLabel: string; ltvLabel: string } | null {
  // Map property type to grid labels
  const propertyMap: Record<string, string[]> = {
    "condo": ["Condo", "Condo*", "Condominium"],
    "investment": ["Investment", "Investment Property", "Investment "],
    "second_home": ["Second Home", "2nd Home"],
    "manufactured": ["Manuf Home", "Manufactured", "Manuf Home**"],
    "multi-family": ["2-4 Unit", "2-4 Unit Property", "Multi-Family"],
    "2-4 unit": ["2-4 Unit", "2-4 Unit Property"],
  };

  const searchTerms = propertyMap[propertyType.toLowerCase()] || [];

  // Find matching row
  let rowIndex = -1;
  for (let i = 0; i < grid.axes.y.length; i++) {
    const rowLabel = grid.axes.y[i].toLowerCase();
    if (searchTerms.some(term => rowLabel.includes(term.toLowerCase()))) {
      rowIndex = i;
      break;
    }
  }

  if (rowIndex === -1) return null;

  // Find matching LTV column
  let colIndex = -1;
  for (let i = 0; i < grid.axes.x.length; i++) {
    const range = parseLtvRange(grid.axes.x[i]);
    if (range && ltv >= range.min && ltv <= range.max) {
      colIndex = i;
      break;
    }
  }

  if (colIndex === -1) return null;

  const value = grid.data[rowIndex]?.[colIndex];
  if (value === null || value === undefined) return null;

  return {
    value,
    propertyLabel: grid.axes.y[rowIndex],
    ltvLabel: grid.axes.x[colIndex],
  };
}

// CRITICAL FIX #3: State adjustment lookup with semicolon support
function lookupStateAdjustment(
  grid: AdjustmentGrid,
  state: string
): number {
  if (grid.type !== 'state') return 0;

  const stateUpper = state.toUpperCase();

  // Find state in Y axis (row headers)
  for (let i = 0; i < grid.axes.y.length; i++) {
    const stateLabel = grid.axes.y[i].toUpperCase();

    // Check if this row contains our state
    // Split by comma AND semicolon to handle "Group 3; ,AK,AL,AR" format
    const states = stateLabel.split(/[,;]+/)
      .map(s => s.trim())
      .filter(s => /^[A-Z]{2}$/.test(s));

    if (states.includes(stateUpper)) {
      const adjValue = grid.data[i]?.[0];
      return adjValue !== null && adjValue !== undefined ? adjValue : 0;
    }
  }

  return 0;
}

// NEW: Calculate total adjustments from REAL parsed grids
function calculateTotalAdjustments(
  params: LoanParameters,
  grids: AdjustmentGrid[]
): { total: number; breakdown: AdjustmentBreakdown[] } {
  let totalAdj = 0;
  const breakdown: AdjustmentBreakdown[] = [];

  const ficoRange = creditScoreToFicoRange(params.creditScore);
  const fico = (ficoRange.min + ficoRange.max) / 2;
  const ltv = (params.loanAmount / params.propertyValue) * 100;

  // Map loan purpose to grid types
  const purposeMap: Record<string, AdjustmentGrid['loanPurpose']> = {
    'purchase': 'purchase',
    'refinance': 'rt_refi',
    'refinance-cashout': 'co_refi',
  };
  const gridPurpose = purposeMap[params.loanPurpose] || 'all';

  console.log(`[PRICING] Calculating adjustments for FICO=${fico}, LTV=${ltv.toFixed(2)}%, Purpose=${gridPurpose}`);

  for (const grid of grids) {
    // Skip grids that don't match the loan purpose
    if (grid.loanPurpose && grid.loanPurpose !== 'all' && grid.loanPurpose !== gridPurpose) {
      console.log(`[PRICING] Skipping grid "${grid.name}" (purpose mismatch: ${grid.loanPurpose} vs ${gridPurpose})`);
      continue;
    }

    if (grid.type === 'fico_ltv') {
      const result = lookupGridValue(grid, fico, ltv);
      if (result) {
        totalAdj += result.value;
        breakdown.push({
          gridName: grid.name,
          lookupKey: `FICO ${result.rowLabel} x LTV ${result.colLabel}`,
          adjustment: result.value,
        });
        console.log(`[PRICING] Grid "${grid.name}": ${result.value} (${result.rowLabel} x ${result.colLabel})`);
      }
    } else if (grid.type === 'property') {
      const result = lookupPropertyAdjustment(grid, params.propertyType, ltv);
      if (result) {
        totalAdj += result.value;
        breakdown.push({
          gridName: grid.name,
          lookupKey: `${result.propertyLabel} x LTV ${result.ltvLabel}`,
          adjustment: result.value,
        });
        console.log(`[PRICING] Grid "${grid.name}": ${result.value} (${result.propertyLabel} x ${result.ltvLabel})`);
      }
    } else if (grid.type === 'state' && params.state) {
      const adj = lookupStateAdjustment(grid, params.state);
      if (adj !== 0) {
        totalAdj += adj;
        breakdown.push({
          gridName: grid.name,
          lookupKey: `State: ${params.state}`,
          adjustment: adj,
        });
        console.log(`[PRICING] Grid "${grid.name}": ${adj} (State: ${params.state})`);
      }
    }
  }

  console.log(`[PRICING] Total adjustments: ${totalAdj.toFixed(3)}`);
  return { total: totalAdj, breakdown };
}

function getTermYears(loanTerm: string): number {
  if (loanTerm === "15yr") return 15;
  if (loanTerm === "20yr") return 20;
  if (loanTerm === "25yr") return 25;
  return 30;
}

function calculateMonthlyPayment(loanAmount: number, annualRate: number, termYears: number): number {
  const monthlyRate = annualRate / 100 / 12;
  const numPayments = termYears * 12;
  if (monthlyRate === 0) return loanAmount / numPayments;
  return loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
    (Math.pow(1 + monthlyRate, numPayments) - 1);
}

function calculateApr(rate: number, pointsPercent: number, loanAmount: number, termYears: number): number {
  const upfrontFee = (pointsPercent / 100) * loanAmount;
  const effectiveLoanAmount = loanAmount - upfrontFee;

  const monthlyRate = rate / 100 / 12;
  const numPayments = termYears * 12;
  const monthlyPayment = calculateMonthlyPayment(loanAmount, rate, termYears);

  let aprGuess = rate;
  for (let i = 0; i < 20; i++) {
    const aprMonthlyRate = aprGuess / 100 / 12;
    const pv = monthlyPayment * (1 - Math.pow(1 + aprMonthlyRate, -numPayments)) / aprMonthlyRate;
    const diff = pv - effectiveLoanAmount;

    if (Math.abs(diff) < 0.01) break;

    const derivative = -monthlyPayment * numPayments * Math.pow(1 + aprMonthlyRate, -numPayments - 1) / aprMonthlyRate +
      monthlyPayment * (1 - Math.pow(1 + aprMonthlyRate, -numPayments)) / (aprMonthlyRate * aprMonthlyRate);

    aprGuess = aprGuess - (diff / derivative) * 100;
  }

  return aprGuess;
}

function findRateForTargetPrice(
  rates: ParsedRate[],
  targetPrice: number,
  lockPeriod: 'price15Day' | 'price30Day' | 'price45Day',
  direction: 'closest' | 'lower' | 'higher'
): ParsedRate | null {
  if (rates.length === 0) return null;

  let bestRate: ParsedRate | null = null;
  let bestDiff = Infinity;

  for (const rate of rates) {
    const price = rate[lockPeriod];
    const diff = Math.abs(price - targetPrice);

    if (direction === 'closest') {
      if (diff < bestDiff) {
        bestDiff = diff;
        bestRate = rate;
      }
    } else if (direction === 'lower') {
      // For lower rate scenario, we want the lowest rate where price >= targetPrice
      if (price >= targetPrice) {
        if (!bestRate || rate.rate < bestRate.rate) {
          bestRate = rate;
        }
      }
    } else if (direction === 'higher') {
      // CRITICAL FIX #4: For lender credit scenario, pick HIGHER rate where price <= targetPrice
      // This ensures lender credit scenarios get a higher rate than par
      if (price <= targetPrice) {
        if (!bestRate || rate.rate > bestRate.rate) {
          bestRate = rate;
        }
      }
    }
  }

  return bestRate;
}

async function generateQuoteFromRateSheet(
  parsedSheet: ParsedRateSheet,
  params: LoanParameters
): Promise<LenderQuote | null> {
  const matchingRates = parsedSheet.rates.filter(r =>
    r.loanTerm === params.loanTerm &&
    r.loanType === params.loanType
  );

  if (matchingRates.length === 0) {
    console.log(`[PRICING] No rates found for ${params.loanTerm} ${params.loanType} from ${parsedSheet.lenderName}`);
    return null;
  }

  console.log(`[PRICING] ${parsedSheet.lenderName}: Found ${matchingRates.length} matching rates`);

  const { total: totalAdjustments, breakdown } = calculateTotalAdjustments(params, parsedSheet.adjustments);

  const adjustedRates = matchingRates.map(rate => ({
    ...rate,
    price15Day: rate.price15Day + totalAdjustments,
    price30Day: rate.price30Day + totalAdjustments,
    price45Day: rate.price45Day + totalAdjustments,
  }));

  const lockPeriod: 'price15Day' | 'price30Day' | 'price45Day' = 'price30Day';
  const termYears = getTermYears(params.loanTerm);

  // Par Rate (closest to 100)
  const parRate = findRateForTargetPrice(adjustedRates, TARGET_PAR, lockPeriod, 'closest');

  // 1.5% Buydown (closest to 98.5, prefer lower rates)
  const buydownRate = findRateForTargetPrice(adjustedRates, TARGET_BUYDOWN_1_5, lockPeriod, 'lower');

  // 0.5% Lender Credit (closest to 100.5, MUST be higher rate than par)
  const creditRate = findRateForTargetPrice(adjustedRates, TARGET_CREDIT_0_5, lockPeriod, 'higher');

  if (!parRate) {
    console.log(`[PRICING] ${parsedSheet.lenderName}: No par rate found`);
    return null;
  }

  const scenarios: PricingScenario[] = [];

  // Par Scenario
  const parPrice = parRate[lockPeriod];
  const parPoints = 100 - parPrice;
  scenarios.push({
    rate: parRate.rate,
    apr: calculateApr(parRate.rate, parPoints, params.loanAmount, termYears),
    monthlyPayment: calculateMonthlyPayment(params.loanAmount, parRate.rate, termYears),
    pointsPercent: parPoints,
    pointsDollar: (parPoints / 100) * params.loanAmount,
    isCredit: parPoints < 0,
    scenarioLabel: "Best Available Rate (Par)",
    netPrice: parPrice,
    adjustmentBreakdown: breakdown,
  });

  // Buydown Scenario
  if (buydownRate) {
    const buydownPrice = buydownRate[lockPeriod];
    const buydownPoints = 100 - buydownPrice;
    scenarios.push({
      rate: buydownRate.rate,
      apr: calculateApr(buydownRate.rate, buydownPoints, params.loanAmount, termYears),
      monthlyPayment: calculateMonthlyPayment(params.loanAmount, buydownRate.rate, termYears),
      pointsPercent: buydownPoints,
      pointsDollar: (buydownPoints / 100) * params.loanAmount,
      isCredit: false,
      scenarioLabel: "Pay 1.5 Points (Lowest Rate)",
      netPrice: buydownPrice,
      adjustmentBreakdown: breakdown,
    });
  }

  // Lender Credit Scenario
  if (creditRate && creditRate.rate > parRate.rate) {
    const creditPrice = creditRate[lockPeriod];
    const creditPoints = 100 - creditPrice;
    scenarios.push({
      rate: creditRate.rate,
      apr: calculateApr(creditRate.rate, creditPoints, params.loanAmount, termYears),
      monthlyPayment: calculateMonthlyPayment(params.loanAmount, creditRate.rate, termYears),
      pointsPercent: creditPoints,
      pointsDollar: (creditPoints / 100) * params.loanAmount,
      isCredit: true,
      scenarioLabel: "Receive 0.5 Point Credit",
      netPrice: creditPrice,
      adjustmentBreakdown: breakdown,
    });
  }

  const basePrice = matchingRates[0]?.price30Day || 100;
  const adjustedPrice = basePrice + totalAdjustments;

  return {
    lenderName: parsedSheet.lenderName,
    scenarios,
    basePrice,
    adjustedPrice,
    totalAdjustments,
  };
}

function validatePricingResult(pass1: PricingResult, pass2: PricingResult): boolean {
  if (pass1.quotes.length !== pass2.quotes.length) {
    console.error(`Validation failed: different number of quotes (${pass1.quotes.length} vs ${pass2.quotes.length})`);
    return false;
  }

  for (let i = 0; i < pass1.quotes.length; i++) {
    const quote1 = pass1.quotes[i];
    const quote2 = pass2.quotes[i];

    if (quote1.lenderName !== quote2.lenderName) {
      console.error(`Validation failed: lender name mismatch at index ${i}`);
      return false;
    }

    if (quote1.scenarios.length !== quote2.scenarios.length) {
      console.error(`Validation failed: different number of scenarios for ${quote1.lenderName}`);
      return false;
    }

    for (let j = 0; j < quote1.scenarios.length; j++) {
      const scenario1 = quote1.scenarios[j];
      const scenario2 = quote2.scenarios[j];

      if (Math.abs(scenario1.rate - scenario2.rate) > 0.001) {
        console.error(`Validation failed: rate mismatch for ${quote1.lenderName} scenario ${j}`);
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
      adjustments: [],  // LlamaCloud doesn't return adjustment grids
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

// Simplified mock quotes generator for fallback (no longer uses fake LLPAs)
export function generateMockQuotes(params: LoanParameters): LenderQuote[] {
  const termYears = getTermYears(params.loanTerm);
  const ltv = (params.loanAmount / params.propertyValue) * 100;

  let baseRate = 6.5;

  // Simple credit score adjustment (not LLPA, just for mock display)
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
        netPrice: 100,
        adjustmentBreakdown: [],
      },
      {
        rate: Math.round((lenderRate - 0.25) * 1000) / 1000,
        apr: Math.round((lenderRate - 0.1) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate - 0.25, termYears) * 100) / 100,
        pointsPercent: 1.0,
        pointsDollar: params.loanAmount * 0.01,
        isCredit: false,
        scenarioLabel: "Pay 1 Point (Lower Rate)",
        netPrice: 99,
        adjustmentBreakdown: [],
      },
      {
        rate: Math.round((lenderRate - 0.375) * 1000) / 1000,
        apr: Math.round((lenderRate - 0.225) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate - 0.375, termYears) * 100) / 100,
        pointsPercent: 1.5,
        pointsDollar: params.loanAmount * 0.015,
        isCredit: false,
        scenarioLabel: "Pay 1.5 Points (Lowest Rate)",
        netPrice: 98.5,
        adjustmentBreakdown: [],
      },
      {
        rate: Math.round((lenderRate + 0.125) * 1000) / 1000,
        apr: Math.round((lenderRate + 0.275) * 1000) / 1000,
        monthlyPayment: Math.round(calculateMonthlyPayment(params.loanAmount, lenderRate + 0.125, termYears) * 100) / 100,
        pointsPercent: 0.5,
        pointsDollar: params.loanAmount * 0.005,
        isCredit: true,
        scenarioLabel: "Receive 0.5 Point Credit",
        netPrice: 100.5,
        adjustmentBreakdown: [],
      },
    ];

    return {
      lenderName: lender.name,
      scenarios,
      basePrice: 100,
      adjustedPrice: 100,
      totalAdjustments: 0,
    };
  });
}