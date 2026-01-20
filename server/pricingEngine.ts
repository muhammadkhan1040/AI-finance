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

// NEW: Calculate total adjustments from REAL parsed grids
function calculateTotalAdjustments(
  params: LoanParameters,
  grids: AdjustmentGrid[]
): { total: number; breakdown: AdjustmentBreakdown[] } {
  let totalAdj = 0;
  const breakdown: AdjustmentBreakdown[] = [];

  const ficoRange = creditScoreToFicoRange(params.creditScore);
  const fico = (ficoRange.min + ficoRange.max) / 2;  // Use midpoint
  const ltv = (params.loanAmount / params.propertyValue) * 100;

  // Determine loan purpose for filtering grids
  let loanPurposeType: 'purchase' | 'rt_refi' | 'co_refi' = 'purchase';
  if (params.loanPurpose === 'refinance') {
    loanPurposeType = 'rt_refi';
  } else if (params.loanPurpose === 'refinance-cashout') {
    loanPurposeType = 'co_refi';
  }

  for (const grid of grids) {
    // Filter by loan purpose
    if (grid.loanPurpose && grid.loanPurpose !== 'all' && grid.loanPurpose !== loanPurposeType) {
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
        console.log(`[PRICING] ${grid.name}: FICO ${fico} (${result.rowLabel}) x LTV ${ltv.toFixed(1)}% (${result.colLabel}) = ${result.value}`);
      }
    }

    if (grid.type === 'property') {
      const propType = params.propertyType.toLowerCase();
      // Only apply property adjustments for non-standard properties
      if (propType !== 'single_family' && propType !== 'single-family') {
        const result = lookupPropertyAdjustment(grid, propType, ltv);
        if (result) {
          totalAdj += result.value;
          breakdown.push({
            gridName: grid.name,
            lookupKey: `${result.propertyLabel} @ LTV ${result.ltvLabel}`,
            adjustment: result.value,
          });
          console.log(`[PRICING] ${grid.name}: ${result.propertyLabel} @ LTV ${ltv.toFixed(1)}% = ${result.value}`);
        }
      }
    }

    // State adjustments would go here if we had state-specific grids
    if (grid.type === 'state' && params.state) {
      // TODO: Implement state-specific lookup
    }
  }

  return { total: totalAdj, breakdown };
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
  basePrice: number;      // Raw price from rate sheet
  netPrice: number;       // Net Price = Base Price - Margin - Adjustments
  pointsPercent: number;
  pointsDollar: number;
  isCredit: boolean;
}

// NEW: Calculate Net Price for a given rate
// Formula: Net Price = Base_Price - Margin - Adjustments
function calculateNetPrice(basePrice: number, margin: number, totalAdjustments: number): number {
  // Note: In the E-Lend grids, negative values = DEDUCTIONS from price
  // So we ADD them (subtract negative = add)
  return basePrice + totalAdjustments - margin;
}

// NEW: Solver function to find rate matching target net price
function findRateForTargetPrice(
  rates: ParsedRate[],
  targetNetPrice: number,
  totalAdjustments: number,
  params: LoanParameters
): RateOption | null {
  const termYears = getTermYears(params.loanTerm);
  const loanTermKey = `${termYears}yr`;

  // Filter by term and type
  let filteredRates = rates.filter(r =>
    r.loanTerm === loanTermKey &&
    (r.loanType === params.loanType || r.loanType === 'conventional')
  );

  if (filteredRates.length === 0) {
    const allForTerm = rates.filter(r => r.loanTerm === loanTermKey);
    if (allForTerm.length === 0) return null;
    filteredRates = allForTerm;
  }

  // Deduplicate rates - keep BEST price (highest wholesale) for each rate
  const rateMap = new Map<number, ParsedRate>();
  for (const r of filteredRates) {
    const existing = rateMap.get(r.rate);
    if (!existing || r.price15Day > existing.price15Day) {
      rateMap.set(r.rate, r);
    }
  }
  filteredRates = Array.from(rateMap.values());

  // Calculate net price for each rate
  const rateOptions: RateOption[] = filteredRates.map(r => {
    const netPrice = calculateNetPrice(r.price15Day, LENDER_MARGIN, totalAdjustments);
    const pointsRaw = 100 - netPrice;  // > 0 means customer pays points, < 0 means credit
    const isCredit = pointsRaw < 0;
    const pointsPercent = Math.abs(pointsRaw);
    const pointsDollar = params.loanAmount * (pointsPercent / 100);

    return {
      rate: r.rate,
      basePrice: r.price15Day,
      netPrice,
      pointsPercent: Math.round(pointsPercent * 1000) / 1000,
      pointsDollar: Math.round(pointsDollar * 100) / 100,
      isCredit,
    };
  });

  // Find rate with net price closest to target
  let closestOption: RateOption | null = null;
  let closestDiff = Infinity;

  for (const option of rateOptions) {
    const diff = Math.abs(option.netPrice - targetNetPrice);
    if (diff < closestDiff) {
      closestDiff = diff;
      closestOption = option;
    }
  }

  return closestOption;
}

// NEW: Main quote generation with solver logic
async function generateQuoteFromRateSheet(
  parsedSheet: ParsedRateSheet,
  params: LoanParameters
): Promise<LenderQuote | null> {
  if (!parsedSheet.parseSuccess || parsedSheet.rates.length === 0) {
    return null;
  }

  console.log(`\n[PRICING] ========== Processing ${parsedSheet.lenderName} ==========`);

  // Calculate total adjustments from REAL grids
  const { total: totalAdjustments, breakdown } = calculateTotalAdjustments(
    params,
    parsedSheet.adjustments
  );

  console.log(`[PRICING] Total LLPA Adjustments: ${totalAdjustments.toFixed(3)}`);
  console.log(`[PRICING] Breakdown:`, breakdown);

  const termYears = getTermYears(params.loanTerm);
  const scenarios: PricingScenario[] = [];

  // Scenario 1: PAR (Net Price ≈ 100.0)
  const parOption = findRateForTargetPrice(parsedSheet.rates, TARGET_PAR, totalAdjustments, params);
  if (parOption) {
    const monthlyPayment = calculateMonthlyPayment(params.loanAmount, parOption.rate, termYears);
    const baseFees = 1500;
    const totalFees = parOption.isCredit ? Math.max(0, baseFees - parOption.pointsDollar) : baseFees + parOption.pointsDollar;
    const apr = calculateApr(params.loanAmount, parOption.rate, termYears, totalFees);

    scenarios.push({
      rate: Math.round(parOption.rate * 1000) / 1000,
      apr: Math.round(apr * 1000) / 1000,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      pointsPercent: parOption.pointsPercent,
      pointsDollar: parOption.pointsDollar,
      isCredit: parOption.isCredit,
      scenarioLabel: parOption.isCredit ? "Par Rate (Small Credit)" : "Par Rate (No Points)",
      netPrice: Math.round(parOption.netPrice * 1000) / 1000,
      adjustmentBreakdown: breakdown,
    });

    console.log(`[PRICING] PAR: Rate ${parOption.rate}%, Base ${parOption.basePrice.toFixed(3)}, Net ${parOption.netPrice.toFixed(3)}, ${parOption.isCredit ? 'Credit' : 'Points'} ${parOption.pointsPercent.toFixed(3)}%`);
  }

  // Scenario 2: 1.5% Buydown (Net Price ≈ 98.5)
  const buydownOption = findRateForTargetPrice(parsedSheet.rates, TARGET_BUYDOWN_1_5, totalAdjustments, params);
  if (buydownOption && buydownOption.rate !== parOption?.rate) {
    const monthlyPayment = calculateMonthlyPayment(params.loanAmount, buydownOption.rate, termYears);
    const baseFees = 1500;
    const totalFees = baseFees + buydownOption.pointsDollar;
    const apr = calculateApr(params.loanAmount, buydownOption.rate, termYears, totalFees);

    scenarios.push({
      rate: Math.round(buydownOption.rate * 1000) / 1000,
      apr: Math.round(apr * 1000) / 1000,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      pointsPercent: buydownOption.pointsPercent,
      pointsDollar: buydownOption.pointsDollar,
      isCredit: buydownOption.isCredit,
      scenarioLabel: "Pay Points (Lower Rate)",
      netPrice: Math.round(buydownOption.netPrice * 1000) / 1000,
      adjustmentBreakdown: breakdown,
    });

    console.log(`[PRICING] BUYDOWN: Rate ${buydownOption.rate}%, Base ${buydownOption.basePrice.toFixed(3)}, Net ${buydownOption.netPrice.toFixed(3)}, Points ${buydownOption.pointsPercent.toFixed(3)}%`);
  }

  // Scenario 3: 0.5% Credit (Net Price ≈ 100.5)
  const creditOption = findRateForTargetPrice(parsedSheet.rates, TARGET_CREDIT_0_5, totalAdjustments, params);
  if (creditOption && creditOption.rate !== parOption?.rate) {
    const monthlyPayment = calculateMonthlyPayment(params.loanAmount, creditOption.rate, termYears);
    const baseFees = 1500;
    const totalFees = Math.max(0, baseFees - creditOption.pointsDollar);
    const apr = calculateApr(params.loanAmount, creditOption.rate, termYears, totalFees);

    scenarios.push({
      rate: Math.round(creditOption.rate * 1000) / 1000,
      apr: Math.round(apr * 1000) / 1000,
      monthlyPayment: Math.round(monthlyPayment * 100) / 100,
      pointsPercent: creditOption.pointsPercent,
      pointsDollar: creditOption.pointsDollar,
      isCredit: creditOption.isCredit,
      scenarioLabel: "Receive Lender Credit",
      netPrice: Math.round(creditOption.netPrice * 1000) / 1000,
      adjustmentBreakdown: breakdown,
    });

    console.log(`[PRICING] CREDIT: Rate ${creditOption.rate}%, Base ${creditOption.basePrice.toFixed(3)}, Net ${creditOption.netPrice.toFixed(3)}, Credit ${creditOption.pointsPercent.toFixed(3)}%`);
  }

  if (scenarios.length === 0) {
    console.log(`[PRICING] No scenarios could be generated for ${parsedSheet.lenderName}`);
    return null;
  }

  console.log(`[PRICING] Generated ${scenarios.length} scenarios for ${parsedSheet.lenderName}`);

  return {
    lenderName: parsedSheet.lenderName,
    scenarios,
    basePrice: parOption?.basePrice || 100,
    adjustedPrice: parOption?.netPrice || 100,
    totalAdjustments,
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
