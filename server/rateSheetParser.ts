import * as XLSX from 'xlsx';

export interface ParsedRate {
  rate: number;
  price15Day: number;
  price30Day: number;
  price45Day: number;
  loanTerm: string;
  loanType: string;
}

// NEW: Adjustment Grid interface to store LLPA matrices
export interface AdjustmentGrid {
  name: string;             // e.g., "FICO vs LTV" or "State Adjustments"
  type: 'fico_ltv' | 'state' | 'property' | 'loan_amount' | 'loan_purpose' | 'other';
  loanPurpose?: 'purchase' | 'rt_refi' | 'co_refi' | 'all';  // Which loan purpose this grid applies to
  axes: {
    y: string[];            // Row headers (e.g., FICO ranges [">=780", "760-779"])
    x: string[];            // Col headers (e.g., LTV ranges ["<=30.00%", "30.01-60.00%"])
  };
  data: (number | null)[][];  // The actual grid values (null = N/A)
}

// UPDATED: ParsedRateSheet now stores adjustment grids
export interface ParsedRateSheet {
  lenderName: string;
  rates: ParsedRate[];
  adjustments: AdjustmentGrid[];  // NEW: Store the grids here
  parseSuccess: boolean;
  parseError?: string;
}

interface CellRange {
  startRow: number;
  endRow: number;
  rateCol: number;
  price15Col: number;
  price30Col: number;
  price45Col: number;
  loanTerm: string;
  loanType: string;
}

function colToIndex(col: string): number {
  let result = 0;
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 64);
  }
  return result - 1;
}

function parseRatesFromRange(
  jsonData: any[][],
  range: CellRange,
  rates: ParsedRate[]
): void {
  for (let rowIdx = range.startRow; rowIdx <= range.endRow && rowIdx < jsonData.length; rowIdx++) {
    const row = jsonData[rowIdx];
    if (!row) continue;

    const rateCell = row[range.rateCol];
    const rateValue = typeof rateCell === 'number' ? rateCell : parseFloat(String(rateCell || ''));

    if (isNaN(rateValue) || rateValue < 3 || rateValue > 12) continue;

    const price15 = typeof row[range.price15Col] === 'number'
      ? row[range.price15Col]
      : parseFloat(String(row[range.price15Col] || ''));
    const price30 = typeof row[range.price30Col] === 'number'
      ? row[range.price30Col]
      : parseFloat(String(row[range.price30Col] || ''));
    const price45 = typeof row[range.price45Col] === 'number'
      ? row[range.price45Col]
      : parseFloat(String(row[range.price45Col] || ''));

    if (!isNaN(price15) && price15 > 90 && price15 < 110) {
      rates.push({
        rate: rateValue,
        price15Day: price15,
        price30Day: !isNaN(price30) && price30 > 90 && price30 < 110 ? price30 : price15,
        price45Day: !isNaN(price45) && price45 > 90 && price45 < 110 ? price45 : price15,
        loanTerm: range.loanTerm,
        loanType: range.loanType,
      });
    }
  }
}

// NEW: Parse an LLPA grid from the sheet data
function parseAdjustmentGrid(
  jsonData: any[][],
  startRow: number,
  headerRow: number,
  dataStartRow: number,
  dataEndRow: number,
  labelCol: number,
  dataStartCol: number,
  dataEndCol: number,
  gridName: string,
  gridType: AdjustmentGrid['type'],
  loanPurpose: AdjustmentGrid['loanPurpose'] = 'all'
): AdjustmentGrid | null {
  try {
    // Extract column headers (LTV ranges)
    const headerRowData = jsonData[headerRow];
    if (!headerRowData) return null;

    const xHeaders: string[] = [];
    for (let col = dataStartCol; col <= dataEndCol; col++) {
      const cell = headerRowData[col];
      if (cell !== undefined && cell !== null) {
        xHeaders.push(String(cell).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/>/g, '>'));
      } else {
        xHeaders.push('');
      }
    }

    // Extract row headers (FICO ranges) and data
    const yHeaders: string[] = [];
    const data: (number | null)[][] = [];

    for (let rowIdx = dataStartRow; rowIdx <= dataEndRow && rowIdx < jsonData.length; rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row) continue;

      const labelCell = row[labelCol];
      if (labelCell === undefined || labelCell === null) continue;

      const label = String(labelCell).replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/>/g, '>').trim();
      if (!label) continue;

      yHeaders.push(label);

      const rowData: (number | null)[] = [];
      for (let col = dataStartCol; col <= dataEndCol; col++) {
        const cell = row[col];
        if (cell === undefined || cell === null || cell === '' || String(cell).toUpperCase() === 'N/A') {
          rowData.push(null);
        } else if (typeof cell === 'number') {
          rowData.push(cell);
        } else {
          const parsed = parseFloat(String(cell));
          rowData.push(isNaN(parsed) ? null : parsed);
        }
      }
      data.push(rowData);
    }

    if (yHeaders.length === 0 || xHeaders.length === 0) {
      return null;
    }

    console.log(`[PARSER] Parsed grid "${gridName}": ${yHeaders.length} rows x ${xHeaders.length} cols`);

    return {
      name: gridName,
      type: gridType,
      loanPurpose,
      axes: { y: yHeaders, x: xHeaders },
      data,
    };
  } catch (error) {
    console.error(`[PARSER] Failed to parse grid "${gridName}":`, error);
    return null;
  }
}

// NEW: Parse E-Lend FHLMC-FNMA LLPA sheet
function parseELendLLPAs(workbook: XLSX.WorkBook): AdjustmentGrid[] {
  const grids: AdjustmentGrid[] = [];

  // Parse FHLMC-FNMA LLPA sheet
  const llpaSheet = workbook.Sheets['FHLMC-FNMA LLPA'];
  if (llpaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(llpaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend FHLMC-FNMA LLPA has ${jsonData.length} rows`);

    // FHLMC Purchase FICO/LTV Grid (Row 8 headers, Row 10-18 data)
    // Headers in row 8 (index 7), cols C-K
    // Data rows 10-18 (index 9-17), label in col A, data in cols C-K
    const purchaseFicoLtv = parseAdjustmentGrid(
      jsonData,
      7,      // startRow
      7,      // headerRow (FICO/LTV headers)
      9,      // dataStartRow (>=780)
      17,     // dataEndRow (<=639)
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC Purchase FICO/LTV',
      'fico_ltv',
      'purchase'
    );
    if (purchaseFicoLtv) grids.push(purchaseFicoLtv);

    // FHLMC Purchase Loan Attribute LLPA (rows 20-27)
    const purchasePropertyGrid = parseAdjustmentGrid(
      jsonData,
      19,     // startRow
      7,      // headerRow (same LTV headers as FICO)
      19,     // dataStartRow (Condo*)
      27,     // dataEndRow (DTI >40%)
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC Purchase Property Adjustments',
      'property',
      'purchase'
    );
    if (purchasePropertyGrid) grids.push(purchasePropertyGrid);

    // FHLMC R/T Refi FICO/LTV Grid (Row 29 headers, Row 31-39 data)
    const rtRefiFicoLtv = parseAdjustmentGrid(
      jsonData,
      28,     // startRow
      28,     // headerRow
      30,     // dataStartRow
      38,     // dataEndRow
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC R/T Refi FICO/LTV',
      'fico_ltv',
      'rt_refi'
    );
    if (rtRefiFicoLtv) grids.push(rtRefiFicoLtv);

    // FHLMC R/T Loan Attribute LLPA (rows 41-48)
    const rtRefiPropertyGrid = parseAdjustmentGrid(
      jsonData,
      40,     // startRow
      28,     // headerRow (same LTV headers)
      40,     // dataStartRow
      47,     // dataEndRow
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC R/T Refi Property Adjustments',
      'property',
      'rt_refi'
    );
    if (rtRefiPropertyGrid) grids.push(rtRefiPropertyGrid);

    // FHLMC C/O Refi FICO/LTV Grid (Row 50 headers, Row 52-60 data)
    const coRefiFicoLtv = parseAdjustmentGrid(
      jsonData,
      49,     // startRow
      49,     // headerRow
      51,     // dataStartRow
      59,     // dataEndRow
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC C/O Refi FICO/LTV',
      'fico_ltv',
      'co_refi'
    );
    if (coRefiFicoLtv) grids.push(coRefiFicoLtv);

    // FHLMC C/O Loan Attribute LLPA (rows 62-69)
    const coRefiPropertyGrid = parseAdjustmentGrid(
      jsonData,
      61,     // startRow
      49,     // headerRow (same LTV headers)
      61,     // dataStartRow
      68,     // dataEndRow
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'FHLMC C/O Refi Property Adjustments',
      'property',
      'co_refi'
    );
    if (coRefiPropertyGrid) grids.push(coRefiPropertyGrid);

    console.log(`[PARSER] E Lend FHLMC-FNMA: Parsed ${grids.length} grids`);
  }

  return grids;
}

// Rocket parser - returns all rates from all sheets
function parseRocketSheet(workbook: XLSX.WorkBook): ParsedRate[] {
  const rates: ParsedRate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";

    if (/15\s*year/i.test(sheetName)) currentLoanTerm = "15yr";
    if (/20\s*year/i.test(sheetName)) currentLoanTerm = "20yr";
    if (/25\s*year/i.test(sheetName)) currentLoanTerm = "25yr";
    if (/30\s*year/i.test(sheetName)) currentLoanTerm = "30yr";

    if (/fha/i.test(sheetName)) currentLoanType = "fha";
    if (/\bva\b/i.test(sheetName)) currentLoanType = "va";
    if (/jumbo/i.test(sheetName)) currentLoanType = "jumbo";

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string' && /rate/i.test(cell)) {
          // Found a potential header row
          const headerRow = row;
          let rateCol = -1;
          let price15Col = -1;
          let price30Col = -1;
          let price45Col = -1;

          for (let k = 0; k < headerRow.length; k++) {
            const header = String(headerRow[k] || "").toLowerCase();
            if (header.includes("rate") && !header.includes("day")) rateCol = k;
            if (header.includes("15") && header.includes("day")) price15Col = k;
            if (header.includes("30") && header.includes("day")) price30Col = k;
            if (header.includes("45") && header.includes("day")) price45Col = k;
          }

          if (rateCol >= 0 && price15Col >= 0) {
            parseRatesFromRange(jsonData, {
              startRow: i + 1,
              endRow: Math.min(i + 50, jsonData.length - 1),
              rateCol,
              price15Col,
              price30Col: price30Col >= 0 ? price30Col : price15Col,
              price45Col: price45Col >= 0 ? price45Col : price15Col,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            }, rates);
            break;
          }
        }
      }
    }
  }

  return rates;
}

function parseRocketLLPAs(workbook: XLSX.WorkBook): AdjustmentGrid[] {
  return [];
}

// E-Lend parser
function parseELendSheet(workbook: XLSX.WorkBook): ParsedRate[] {
  const rates: ParsedRate[] = [];

  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes('LLPA')) continue;

    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";

    if (/15\s*yr/i.test(sheetName) || /15\s*year/i.test(sheetName)) currentLoanTerm = "15yr";
    if (/20\s*yr/i.test(sheetName) || /20\s*year/i.test(sheetName)) currentLoanTerm = "20yr";
    if (/30\s*yr/i.test(sheetName) || /30\s*year/i.test(sheetName)) currentLoanTerm = "30yr";

    if (/fha/i.test(sheetName)) currentLoanType = "fha";
    if (/\bva\b/i.test(sheetName)) currentLoanType = "va";
    if (/jumbo/i.test(sheetName)) currentLoanType = "jumbo";

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string' && /rate/i.test(cell)) {
          const headerRow = row;
          let rateCol = -1;
          let price15Col = -1;
          let price30Col = -1;

          for (let k = 0; k < headerRow.length; k++) {
            const header = String(headerRow[k] || "").toLowerCase();
            if (header.includes("rate") && !header.includes("day")) rateCol = k;
            if (header.includes("15") && (header.includes("day") || header.includes("lock"))) price15Col = k;
            if (header.includes("30") && (header.includes("day") || header.includes("lock"))) price30Col = k;
          }

          if (rateCol >= 0 && (price15Col >= 0 || price30Col >= 0)) {
            parseRatesFromRange(jsonData, {
              startRow: i + 1,
              endRow: Math.min(i + 50, jsonData.length - 1),
              rateCol,
              price15Col: price15Col >= 0 ? price15Col : price30Col,
              price30Col: price30Col >= 0 ? price30Col : price15Col,
              price45Col: price30Col >= 0 ? price30Col : price15Col,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            }, rates);
            break;
          }
        }
      }
    }
  }

  return rates;
}

// Generic parser - fallback for unknown lenders
function parseGenericSheet(workbook: XLSX.WorkBook, lenderType: string): ParsedRate[] {
  const rates: ParsedRate[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";

    if (/15/i.test(sheetName)) currentLoanTerm = "15yr";
    if (/20/i.test(sheetName)) currentLoanTerm = "20yr";
    if (/25/i.test(sheetName)) currentLoanTerm = "25yr";
    if (/30/i.test(sheetName)) currentLoanTerm = "30yr";

    if (/fha/i.test(sheetName)) currentLoanType = "fha";
    if (/\bva\b/i.test(sheetName)) currentLoanType = "va";
    if (/jumbo/i.test(sheetName)) currentLoanType = "jumbo";

    for (let i = 0; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row) continue;

      for (let j = 0; j < row.length; j++) {
        const cell = row[j];
        if (cell && typeof cell === 'string' && /rate/i.test(cell)) {
          const headerRow = row;
          let rateCol = -1;
          let price15Col = -1;
          let price30Col = -1;
          let price45Col = -1;

          for (let k = 0; k < headerRow.length; k++) {
            const header = String(headerRow[k] || "").toLowerCase();
            if (header.includes("rate") && !header.includes("day")) rateCol = k;
            if (header.includes("15") && header.includes("day")) price15Col = k;
            if (header.includes("30") && header.includes("day")) price30Col = k;
            if (header.includes("45") && header.includes("day")) price45Col = k;
          }

          if (rateCol >= 0 && price15Col >= 0) {
            parseRatesFromRange(jsonData, {
              startRow: i + 1,
              endRow: Math.min(i + 50, jsonData.length - 1),
              rateCol,
              price15Col,
              price30Col: price30Col >= 0 ? price30Col : price15Col,
              price45Col: price45Col >= 0 ? price45Col : price15Col,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            }, rates);
            break;
          }
        }
      }
    }
  }

  return rates;
}

// Generic LLPA parser
function parseGenericLLPAs(workbook: XLSX.WorkBook): AdjustmentGrid[] {
  return [];
}

export async function parseExcelRateSheet(fileData: string, lenderName: string): Promise<ParsedRateSheet> {
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });

    let rates: ParsedRate[] = [];
    let adjustments: AdjustmentGrid[] = [];

    const lowerLenderName = lenderName.toLowerCase();
    let lenderType = 'generic';

    if (lowerLenderName.includes('rocket')) lenderType = 'rocket';
    else if (lowerLenderName.includes('elend') || lowerLenderName.includes('e lend') || lowerLenderName.includes('e-lend')) lenderType = 'elend';
    else if (lowerLenderName.includes('windsor')) lenderType = 'windsor';
    else if (lowerLenderName.includes('prmg') || lowerLenderName.includes('paramount')) lenderType = 'prmg';

    console.log(`[PARSER] Detected lender type: ${lenderType} for ${lenderName}`);

    // PRMG-specific parsing
    if (lenderType === 'prmg') {
      console.log("[PARSER] Using PRMG-specific parsing logic");

      // 1. Scan for rate tables
      for (const sheetName of workbook.SheetNames) {
        // Skip adjustment sheets
        if (sheetName.includes('ADJ') || sheetName.includes('Adj')) {
          console.log(`[PRMG] Skipping adjustment sheet: ${sheetName}`);
          continue;
        }

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        console.log(`[PRMG] Processing sheet: ${sheetName} (${rows.length} rows)`);

        // Determine loan type from sheet name
        let loanType = 'conventional';
        if (/govt|fha|va/i.test(sheetName)) loanType = 'government';
        if (/fha/i.test(sheetName)) loanType = 'fha';
        if (/va/i.test(sheetName)) loanType = 'va';
        if (/jumbo/i.test(sheetName)) loanType = 'jumbo';

        // Scan for header row with numeric day columns
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;

          let rateCol = -1;
          let price15Col = -1;
          let price30Col = -1;
          let price45Col = -1;

          // Look for "Rate" text header OR numeric columns (15.0, 30.0, 45.0)
          for (let j = 0; j < row.length; j++) {
            const cell = row[j];
            const cellStr = String(cell || "").trim().toLowerCase();

            // Rate column
            if (cellStr === 'rate' || cellStr === 'rates') {
              rateCol = j;
            }

            // PRMG uses numeric headers: 15.0, 30.0, 45.0
            if (typeof cell === 'number') {
              if (cell === 15 || cell === 15.0) price15Col = j;
              if (cell === 30 || cell === 30.0) price30Col = j;
              if (cell === 45 || cell === 45.0) price45Col = j;
            }

            // Also check text versions
            if (cellStr === '15' || cellStr === '15.0' || cellStr === '15 day' || cellStr === '15day') price15Col = j;
            if (cellStr === '30' || cellStr === '30.0' || cellStr === '30 day' || cellStr === '30day') price30Col = j;
            if (cellStr === '45' || cellStr === '45.0' || cellStr === '45 day' || cellStr === '45day') price45Col = j;
          }

          // Found valid header
          if (rateCol >= 0 && (price15Col >= 0 || price30Col >= 0)) {
            console.log(`[PRMG] Found rate table at row ${i}, sheet: ${sheetName}`);
            console.log(`[PRMG]   Rate col: ${rateCol}, 15-day col: ${price15Col}, 30-day col: ${price30Col}, 45-day col: ${price45Col}`);

            // Parse data rows below header
            for (let dataRow = i + 1; dataRow < Math.min(i + 100, rows.length); dataRow++) {
              const dataRowCells = rows[dataRow];
              if (!dataRowCells) continue;

              let rawRate = dataRowCells[rateCol];

              // CRITICAL FIX #1: Convert decimal rates (0.07125 -> 7.125)
              if (typeof rawRate === 'number' && rawRate < 1) {
                rawRate = rawRate * 100;
              } else if (typeof rawRate === 'string') {
                rawRate = parseFloat(rawRate);
                if (rawRate < 1 && rawRate > 0) {
                  rawRate = rawRate * 100;
                }
              }

              const rateValue = typeof rawRate === 'number' ? rawRate : parseFloat(String(rawRate || ''));

              if (isNaN(rateValue) || rateValue < 3 || rateValue > 12) continue;

              // Get prices
              let rawPrice15 = dataRowCells[price15Col >= 0 ? price15Col : price30Col];
              let rawPrice30 = dataRowCells[price30Col >= 0 ? price30Col : price15Col];
              let rawPrice45 = dataRowCells[price45Col >= 0 ? price45Col : price30Col];

              // CRITICAL FIX #2: Invert PRMG pricing (negative values are REBATES)
              // PRMG lists prices as negative when they're lender credits
              // Example: -4.077 means 104.077 (lender pays borrower)
              const convertPrmgPrice = (rawPrice: any): number => {
                let price = typeof rawPrice === 'number' ? rawPrice : parseFloat(String(rawPrice || ''));
                if (isNaN(price)) return NaN;

                // PRMG uses negative for rebate, positive for cost
                // We need to convert to standard pricing where 100 = par
                // -4.077 -> 100 + 4.077 = 104.077
                // +2.5 -> 100 - 2.5 = 97.5
                if (price < 0) {
                  return 100 + Math.abs(price);
                } else if (price > 0 && price < 50) {
                  // This is a cost to borrower
                  return 100 - price;
                }
                return price;
              };

              const finalPrice15 = convertPrmgPrice(rawPrice15);
              const finalPrice30 = convertPrmgPrice(rawPrice30);
              const finalPrice45 = convertPrmgPrice(rawPrice45);

              // Validate converted prices are in reasonable range
              if (!isNaN(finalPrice15) && finalPrice15 > 90 && finalPrice15 < 110) {
                rates.push({
                  rate: rateValue,
                  price15Day: finalPrice15,
                  price30Day: !isNaN(finalPrice30) && finalPrice30 > 90 && finalPrice30 < 110 ? finalPrice30 : finalPrice15,
                  price45Day: !isNaN(finalPrice45) && finalPrice45 > 90 && finalPrice45 < 110 ? finalPrice45 : finalPrice30,
                  loanTerm: "30yr", // Could parse from sheet structure
                  loanType: loanType
                });
              }
            }
          }
        }

        // 3. Scan for Adjustment Grids (FICO / LTV) - Only on ADJ sheets
      }

      // Parse adjustment grids from ADJ sheets
      for (const sheetName of workbook.SheetNames) {
        if (!sheetName.includes('ADJ')) continue;

        const sheet = workbook.Sheets[sheetName];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        console.log(`[PRMG] Processing Adjustments sheet: ${sheetName}`);

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row) continue;
          const firstCell = String(row[0] || "").trim().toLowerCase();

          if (firstCell.includes("fico") || firstCell.includes("credit score") || firstCell.includes("credit")) {
            // Found an adjustment grid header
            const xHeaders: string[] = []; // LTV buckets
            const ltvMap: number[] = [];

            // Parse Column Headers (LTV Buckets)
            for (let k = 1; k < row.length; k++) {
              if (row[k] && String(row[k]).includes("%")) {
                xHeaders.push(String(row[k]));
                ltvMap.push(k);
              }
            }

            if (ltvMap.length > 0) {
              const yHeaders: string[] = [];
              const gridData: (number | null)[][] = [];

              // Parse Rows (FICO Buckets)
              for (let j = i + 1; j < i + 15; j++) {
                const adjRow = rows[j];
                if (!adjRow || !adjRow[0]) break;

                const rowLabel = String(adjRow[0]);
                if (!/\d/.test(rowLabel)) break;

                yHeaders.push(rowLabel);
                const rowData: number[] = [];

                ltvMap.forEach(colIdx => {
                  let val = parseFloat(adjRow[colIdx]);
                  if (isNaN(val)) val = 0;
                  rowData.push(val);
                });
                gridData.push(rowData);
              }

              if (yHeaders.length > 0) {
                adjustments.push({
                  name: `PRMG Adj - ${sheetName} - Row ${i}`,
                  type: 'fico_ltv',
                  loanPurpose: 'all',
                  axes: { y: yHeaders, x: xHeaders },
                  data: gridData
                });
                console.log(`[PRMG] Parsed Adjustment Grid: ${sheetName} Row ${i}`);
              }
            }
          }

          // CRITICAL FIX #3: Parse state adjustments with semicolon handling
          if (firstCell.includes("state") || /group \d/.test(firstCell)) {
            // Look for state group definitions like: "* Group 3; ,AK,AL,AR,FL..."
            for (let j = 0; j < row.length; j++) {
              const cell = String(row[j] || "");

              // Split by both comma AND semicolon
              const states = cell.split(/[,;]+/)
                .map(s => s.trim())
                .filter(s => s.length === 2 && /^[A-Z]{2}$/.test(s));

              if (states.length > 0) {
                // Find the adjustment value (usually in next column or row)
                let adjValue = 0;

                // Check next cell in row for numeric value
                if (j + 1 < row.length) {
                  const nextCell = parseFloat(row[j + 1]);
                  if (!isNaN(nextCell)) adjValue = nextCell;
                }

                // Check same column in next row
                if (adjValue === 0 && i + 1 < rows.length) {
                  const nextRow = rows[i + 1];
                  if (nextRow && nextRow[j]) {
                    const val = parseFloat(nextRow[j]);
                    if (!isNaN(val)) adjValue = val;
                  }
                }

                if (adjValue !== 0) {
                  adjustments.push({
                    name: `PRMG State Adjustment - ${sheetName}`,
                    type: 'state',
                    loanPurpose: 'all',
                    axes: {
                      y: states,
                      x: ['Adjustment']
                    },
                    data: states.map(() => [adjValue])
                  });
                  console.log(`[PRMG] Parsed State Adjustment: ${states.join(',')} = ${adjValue}`);
                }
              }
            }
          }
        }
      }
      // Return early since we did manual parsing
      const rateSummary = new Map<string, number>();
      for (const rate of rates) {
        const key = `${rate.loanTerm} ${rate.loanType}`;
        rateSummary.set(key, (rateSummary.get(key) || 0) + 1);
      }
      console.log(`[PARSER] ${lenderName}: Found ${rates.length} valid rates (PRMG Logic)`);
      console.log(`[PARSER] ${lenderName}: Found ${adjustments.length} adjustment grids (PRMG Logic)`);

      return {
        lenderName,
        rates,
        adjustments,
        parseSuccess: rates.length > 0,
        parseError: rates.length === 0 ? "No valid rates found in Excel file" : undefined,
      };
    }

    switch (lenderType) {
      case 'rocket':
        rates = parseRocketSheet(workbook);
        adjustments = parseRocketLLPAs(workbook);
        break;
      case 'elend':
        rates = parseELendSheet(workbook);
        adjustments = parseELendLLPAs(workbook);
        break;
      case 'windsor':
        // Pass lender name to generic parser for checking PRMG math
        rates = parseGenericSheet(workbook, lenderType);
        adjustments = parseGenericLLPAs(workbook);
        break;
      default:
        rates = parseGenericSheet(workbook, lenderType);
        adjustments = parseGenericLLPAs(workbook);
    }

    const rateSummary = new Map<string, number>();
    for (const rate of rates) {
      const key = `${rate.loanTerm} ${rate.loanType}`;
      rateSummary.set(key, (rateSummary.get(key) || 0) + 1);
    }
    console.log(`[PARSER] ${lenderName}: Found ${rates.length} valid rates`);
    console.log(`[PARSER] Rate summary:`, Object.fromEntries(rateSummary));
    console.log(`[PARSER] ${lenderName}: Found ${adjustments.length} adjustment grids`);

    return {
      lenderName,
      rates,
      adjustments,
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in Excel file" : undefined,
    };
  } catch (error) {
    console.error(`[PARSER] ${lenderName}: Excel parse error:`, error);
    return {
      lenderName,
      rates: [],
      adjustments: [],
      parseSuccess: false,
      parseError: `Excel parse error: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function parsePdfRateSheet(fileData: string, lenderName: string): Promise<ParsedRateSheet> {
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    const pdfParse = await import('pdf-parse') as any;
    const pdf = pdfParse.default || pdfParse;
    const pdfData = await pdf(buffer);
    const text = pdfData.text;

    const rates: ParsedRate[] = [];
    const lines = text.split('\n');

    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";

    for (const line of lines) {
      if (/30\s*year/i.test(line)) currentLoanTerm = "30yr";
      if (/25\s*year/i.test(line)) currentLoanTerm = "25yr";
      if (/20\s*year/i.test(line)) currentLoanTerm = "20yr";
      if (/15\s*year/i.test(line)) currentLoanTerm = "15yr";

      if (/conventional/i.test(line)) currentLoanType = "conventional";
      if (/fha/i.test(line)) currentLoanType = "fha";
      if (/\bva\b/i.test(line)) currentLoanType = "va";

      const numbers = line.match(/\d+\.\d{2,3}/g);
      if (numbers && numbers.length >= 2) {
        const potentialRate = parseFloat(numbers[0]);
        const potentialPrice = parseFloat(numbers[1]);

        if (potentialRate >= 3 && potentialRate <= 12 &&
          potentialPrice >= 90 && potentialPrice <= 110) {

          const price15 = potentialPrice;
          const price30 = numbers[2] ? parseFloat(numbers[2]) : potentialPrice;
          const price45 = numbers[3] ? parseFloat(numbers[3]) : potentialPrice;

          const existingRate = rates.find(r =>
            r.rate === potentialRate &&
            r.loanTerm === currentLoanTerm &&
            r.loanType === currentLoanType
          );

          if (!existingRate) {
            rates.push({
              rate: potentialRate,
              price15Day: price15 >= 90 && price15 <= 110 ? price15 : 100,
              price30Day: price30 >= 90 && price30 <= 110 ? price30 : price15,
              price45Day: price45 >= 90 && price45 <= 110 ? price45 : price15,
              loanTerm: currentLoanTerm,
              loanType: currentLoanType,
            });
          }
        }
      }
    }

    return {
      lenderName,
      rates,
      adjustments: [],  // PDFs don't have structured LLPA grids
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in PDF. Please upload Excel version." : undefined,
    };
  } catch (error) {
    return {
      lenderName,
      rates: [],
      adjustments: [],
      parseSuccess: false,
      parseError: `PDF parse error: ${error instanceof Error ? error.message : 'Unknown error'}. Please use Excel format.`,
    };
  }
}

export async function parseRateSheet(fileData: string, fileName: string, lenderName: string): Promise<ParsedRateSheet> {
  const lowerFileName = fileName.toLowerCase();

  if (lowerFileName.endsWith('.xlsx') || lowerFileName.endsWith('.xls')) {
    return parseExcelRateSheet(fileData, lenderName);
  } else if (lowerFileName.endsWith('.pdf')) {
    return parsePdfRateSheet(fileData, lenderName);
  } else if (lowerFileName.endsWith('.csv')) {
    return parseExcelRateSheet(fileData, lenderName);
  }

  return {
    lenderName,
    rates: [],
    adjustments: [],
    parseSuccess: false,
    parseError: `Unsupported file format: ${fileName}`,
  };
}