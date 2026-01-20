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
  }
  
  // Parse GNMA LLPA sheet for FHA/VA adjustments
  const gnmaLlpaSheet = workbook.Sheets['GNMA LLPA'];
  if (gnmaLlpaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(gnmaLlpaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend GNMA LLPA has ${jsonData.length} rows`);
    
    // Look for FICO/LTV grids similar to conventional
    // GNMA typically has simpler adjustment structure
    const gnmaFicoLtv = parseAdjustmentGrid(
      jsonData,
      7,      // startRow
      7,      // headerRow
      9,      // dataStartRow
      17,     // dataEndRow
      colToIndex('A'),  // labelCol
      colToIndex('C'),  // dataStartCol
      colToIndex('K'),  // dataEndCol
      'GNMA FICO/LTV',
      'fico_ltv',
      'all'
    );
    if (gnmaFicoLtv) grids.push(gnmaFicoLtv);
  }
  
  return grids;
}

// NEW: Parse Rocket LLPA grids
function parseRocketLLPAs(workbook: XLSX.WorkBook): AdjustmentGrid[] {
  const grids: AdjustmentGrid[] = [];
  
  // Look for sheets containing LLPAs
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.includes('LLPA') || sheetName.includes('Govy')) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      console.log(`[PARSER] Rocket ${sheetName} has ${jsonData.length} rows`);
      
      // Scan for LLPA grids using dynamic header recognition
      const detectedGrids = findAndParseGrids(jsonData, sheetName, 'rocket');
      grids.push(...detectedGrids);
    }
  }
  
  // Also check the WS DU & LP Pricing sheet for LLPAs section
  const wsSheet = workbook.Sheets['WS DU & LP Pricing'];
  if (wsSheet) {
    const jsonData = XLSX.utils.sheet_to_json(wsSheet, { header: 1 }) as any[][];
    // Scan for adjustment sections below the rate tables
    const detectedGrids = findAndParseGrids(jsonData, 'WS DU & LP LLPA', 'rocket');
    grids.push(...detectedGrids);
  }
  
  return grids;
}

// NEW: Dynamic Header Recognition - scans sheet for LLPA grids
function findAndParseGrids(jsonData: any[][], sheetName: string, lender: string): AdjustmentGrid[] {
  const grids: AdjustmentGrid[] = [];
  
  // Keywords to look for
  const ficoKeywords = ['FICO', 'Credit Score', 'Score'];
  const ltvKeywords = ['LTV', 'Loan-to-Value', '%'];
  const propertyKeywords = ['Condo', 'Investment', 'Second Home', 'Manufactured', '2-4 Unit'];
  const stateKeywords = ['State', 'FL', 'TX', 'CA', 'NY'];
  
  for (let rowIdx = 0; rowIdx < Math.min(jsonData.length, 200); rowIdx++) {
    const row = jsonData[rowIdx];
    if (!row) continue;
    
    // Check if this row contains LLPA grid headers
    for (let colIdx = 0; colIdx < Math.min(row.length, 20); colIdx++) {
      const cellValue = String(row[colIdx] || '').toLowerCase();
      
      // Look for FICO/LTV grid start
      if (ficoKeywords.some(kw => cellValue.includes(kw.toLowerCase()))) {
        // Found potential FICO row, scan right for LTV buckets
        const ltvBuckets: string[] = [];
        for (let scanCol = colIdx + 1; scanCol < Math.min(row.length, colIdx + 15); scanCol++) {
          const headerCell = String(row[scanCol] || '');
          if (headerCell.includes('%') || headerCell.includes('LTV') || 
              headerCell.includes('<') || headerCell.includes('>') ||
              /\d+\.\d+-\d+\.\d+/.test(headerCell)) {
            ltvBuckets.push(headerCell);
          }
        }
        
        if (ltvBuckets.length >= 3) {
          // Found a grid header row, now extract data rows
          const ficoBuckets: string[] = [];
          const gridData: (number | null)[][] = [];
          
          for (let dataRow = rowIdx + 1; dataRow < Math.min(jsonData.length, rowIdx + 20); dataRow++) {
            const dRow = jsonData[dataRow];
            if (!dRow) continue;
            
            const label = String(dRow[colIdx] || '').trim();
            // Check if this looks like a FICO range
            if (/\d{3}/.test(label) || />=?\d+/.test(label) || /<=?\d+/.test(label)) {
              ficoBuckets.push(label);
              const rowData: (number | null)[] = [];
              for (let i = 0; i < ltvBuckets.length; i++) {
                const cell = dRow[colIdx + 1 + i];
                if (cell === undefined || cell === null || String(cell).toUpperCase() === 'N/A') {
                  rowData.push(null);
                } else if (typeof cell === 'number') {
                  rowData.push(cell);
                } else {
                  const parsed = parseFloat(String(cell));
                  rowData.push(isNaN(parsed) ? null : parsed);
                }
              }
              gridData.push(rowData);
            } else if (ficoBuckets.length > 0 && !label) {
              // Empty row after data, grid complete
              break;
            }
          }
          
          if (ficoBuckets.length >= 3 && gridData.length >= 3) {
            const grid: AdjustmentGrid = {
              name: `${sheetName} FICO/LTV Grid`,
              type: 'fico_ltv',
              loanPurpose: 'all',
              axes: { y: ficoBuckets, x: ltvBuckets },
              data: gridData,
            };
            grids.push(grid);
            console.log(`[PARSER] Found grid in ${sheetName}: ${ficoBuckets.length} FICO x ${ltvBuckets.length} LTV`);
          }
        }
      }
      
      // Look for property type adjustments
      if (propertyKeywords.some(kw => cellValue.includes(kw.toLowerCase()))) {
        // This might be a property adjustment section
        // Simpler processing - single row adjustments
      }
    }
  }
  
  return grids;
}

// NEW: Parse Windsor/PRMG sheets dynamically (no fixed cell mapping)
function parseGenericLLPAs(workbook: XLSX.WorkBook): AdjustmentGrid[] {
  const grids: AdjustmentGrid[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    if (sheetName.toLowerCase().includes('llpa') || 
        sheetName.toLowerCase().includes('adjustment')) {
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
      console.log(`[PARSER] Generic ${sheetName} has ${jsonData.length} rows`);
      
      const detectedGrids = findAndParseGrids(jsonData, sheetName, 'generic');
      grids.push(...detectedGrids);
    }
  }
  
  return grids;
}

function parseRocketSheet(workbook: XLSX.WorkBook): ParsedRate[] {
  const rates: ParsedRate[] = [];
  
  const conventionalSheet = workbook.Sheets['WS DU & LP Pricing'];
  if (conventionalSheet) {
    const jsonData = XLSX.utils.sheet_to_json(conventionalSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] Rocket WS DU & LP Pricing has ${jsonData.length} rows`);
    
    const conventionalRanges: CellRange[] = [
      { startRow: 4, endRow: 38, rateCol: colToIndex('C'), price15Col: colToIndex('D'), price30Col: colToIndex('E'), price45Col: colToIndex('F'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 8, endRow: 32, rateCol: colToIndex('H'), price15Col: colToIndex('I'), price30Col: colToIndex('J'), price45Col: colToIndex('K'), loanTerm: '25yr', loanType: 'conventional' },
      { startRow: 4, endRow: 38, rateCol: colToIndex('L'), price15Col: colToIndex('M'), price30Col: colToIndex('N'), price45Col: colToIndex('O'), loanTerm: '20yr', loanType: 'conventional' },
      { startRow: 4, endRow: 38, rateCol: colToIndex('Q'), price15Col: colToIndex('R'), price30Col: colToIndex('S'), price45Col: colToIndex('T'), loanTerm: '15yr', loanType: 'conventional' },
      { startRow: 40, endRow: 72, rateCol: colToIndex('B'), price15Col: colToIndex('C'), price30Col: colToIndex('D'), price45Col: colToIndex('E'), loanTerm: '10yr', loanType: 'conventional' },
    ];
    
    for (const range of conventionalRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  const fhaSheet = workbook.Sheets['FHA Full Doc Pricing'];
  if (fhaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(fhaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] Rocket FHA Full Doc Pricing has ${jsonData.length} rows`);
    
    const fhaRanges: CellRange[] = [
      { startRow: 6, endRow: 38, rateCol: colToIndex('C'), price15Col: colToIndex('D'), price30Col: colToIndex('E'), price45Col: colToIndex('F'), loanTerm: '30yr', loanType: 'fha' },
      { startRow: 6, endRow: 35, rateCol: colToIndex('H'), price15Col: colToIndex('I'), price30Col: colToIndex('J'), price45Col: colToIndex('K'), loanTerm: '25yr', loanType: 'fha' },
      { startRow: 6, endRow: 38, rateCol: colToIndex('M'), price15Col: colToIndex('N'), price30Col: colToIndex('O'), price45Col: colToIndex('P'), loanTerm: '20yr', loanType: 'fha' },
      { startRow: 6, endRow: 38, rateCol: colToIndex('R'), price15Col: colToIndex('S'), price30Col: colToIndex('T'), price45Col: colToIndex('U'), loanTerm: '15yr', loanType: 'fha' },
    ];
    
    for (const range of fhaRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  const vaSheet = workbook.Sheets['VA Full Doc Pricing'];
  if (vaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(vaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] Rocket VA Full Doc Pricing has ${jsonData.length} rows`);
    
    const vaRanges: CellRange[] = [
      { startRow: 6, endRow: 38, rateCol: colToIndex('C'), price15Col: colToIndex('D'), price30Col: colToIndex('E'), price45Col: colToIndex('F'), loanTerm: '30yr', loanType: 'va' },
      { startRow: 6, endRow: 35, rateCol: colToIndex('H'), price15Col: colToIndex('I'), price30Col: colToIndex('J'), price45Col: colToIndex('K'), loanTerm: '25yr', loanType: 'va' },
      { startRow: 6, endRow: 38, rateCol: colToIndex('M'), price15Col: colToIndex('N'), price30Col: colToIndex('O'), price45Col: colToIndex('P'), loanTerm: '20yr', loanType: 'va' },
      { startRow: 6, endRow: 38, rateCol: colToIndex('R'), price15Col: colToIndex('S'), price30Col: colToIndex('T'), price45Col: colToIndex('U'), loanTerm: '15yr', loanType: 'va' },
    ];
    
    for (const range of vaRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  return rates;
}

function parseELendSheet(workbook: XLSX.WorkBook): ParsedRate[] {
  const rates: ParsedRate[] = [];
  
  // Parse FHA and VA from GNMA tab per E Lend guide
  const gnmaSheet = workbook.Sheets['GNMA'];
  if (gnmaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(gnmaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend GNMA has ${jsonData.length} rows`);
    
    const fhaRanges: CellRange[] = [
      { startRow: 7, endRow: 33, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'fha' },
      { startRow: 7, endRow: 33, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '25yr', loanType: 'fha' },
      { startRow: 35, endRow: 61, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'fha' },
      { startRow: 35, endRow: 61, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '10yr', loanType: 'fha' },
    ];
    
    const vaRanges: CellRange[] = [
      { startRow: 119, endRow: 145, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'va' },
      { startRow: 119, endRow: 145, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '25yr', loanType: 'va' },
      { startRow: 119, endRow: 145, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'va' },
      { startRow: 147, endRow: 173, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'va' },
      { startRow: 147, endRow: 173, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '10yr', loanType: 'va' },
    ];
    
    for (const range of fhaRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
    for (const range of vaRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  // Parse Conventional from FHLMC-FNMA tab
  const conventionalSheet = workbook.Sheets['FHLMC-FNMA'];
  if (conventionalSheet) {
    const jsonData = XLSX.utils.sheet_to_json(conventionalSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend FHLMC-FNMA has ${jsonData.length} rows`);
    
    const freddieMacRanges: CellRange[] = [
      { startRow: 7, endRow: 32, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 7, endRow: 32, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'conventional' },
      { startRow: 35, endRow: 60, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '15yr', loanType: 'conventional' },
    ];
    
    const fannieMaeRanges: CellRange[] = [
      { startRow: 63, endRow: 88, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 63, endRow: 88, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'conventional' },
      { startRow: 91, endRow: 116, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'conventional' },
    ];
    
    console.log(`[PARSER] Parsing Freddie Mac conventional grids`);
    for (const range of freddieMacRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
    console.log(`[PARSER] Parsing Fannie Mae conventional grids`);
    for (const range of fannieMaeRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  return rates;
}

function parseGenericSheet(workbook: XLSX.WorkBook): ParsedRate[] {
  const rates: ParsedRate[] = [];
  
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
    
    let currentLoanTerm = "30yr";
    let currentLoanType = "conventional";
    
    if (/gnma/i.test(sheetName)) currentLoanType = "fha";
    if (/fhlmc|fnma|freddie|fannie/i.test(sheetName)) currentLoanType = "conventional";
    if (/fha/i.test(sheetName)) currentLoanType = "fha";
    if (/\bva\b/i.test(sheetName)) currentLoanType = "va";
    
    for (let rowIdx = 0; rowIdx < jsonData.length; rowIdx++) {
      const row = jsonData[rowIdx];
      if (!row || row.length === 0) continue;
      
      const rateCell = row[0];
      if (typeof rateCell === 'number' && rateCell >= 3 && rateCell <= 12) {
        const price15 = typeof row[1] === 'number' ? row[1] : parseFloat(String(row[1]));
        const price30 = typeof row[2] === 'number' ? row[2] : parseFloat(String(row[2]));
        const price45 = typeof row[3] === 'number' ? row[3] : parseFloat(String(row[3]));
        
        if (!isNaN(price15) && price15 > 90 && price15 < 110) {
          rates.push({
            rate: rateCell,
            price15Day: price15,
            price30Day: !isNaN(price30) && price30 > 90 ? price30 : price15,
            price45Day: !isNaN(price45) && price45 > 90 ? price45 : price15,
            loanTerm: currentLoanTerm,
            loanType: currentLoanType,
          });
        }
      }
    }
  }
  
  return rates;
}

function detectLenderType(workbook: XLSX.WorkBook): 'rocket' | 'elend' | 'windsor' | 'prmg' | 'generic' {
  const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
  
  if (sheetNames.includes('ws du & lp pricing') && sheetNames.includes('ws rate sheet summary')) {
    console.log('[PARSER] Detected Rocket rate sheet structure');
    return 'rocket';
  }
  
  if (sheetNames.includes('gnma') && sheetNames.includes('fhlmc-fnma')) {
    console.log('[PARSER] Detected E Lend rate sheet structure');
    return 'elend';
  }
  
  if (sheetNames.some(s => s.includes('jumbo') && s.includes('llpa'))) {
    console.log('[PARSER] Detected Windsor rate sheet structure');
    return 'windsor';
  }
  
  if (sheetNames.some(s => s.includes('agency') || s.includes('non-qm'))) {
    console.log('[PARSER] Detected PRMG rate sheet structure');
    return 'prmg';
  }
  
  console.log('[PARSER] Using generic parser for unknown structure');
  return 'generic';
}

export async function parseExcelRateSheet(fileData: string, lenderName: string): Promise<ParsedRateSheet> {
  try {
    const base64Data = fileData.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    console.log(`[PARSER] Parsing Excel for ${lenderName}, sheets: ${workbook.SheetNames.join(', ')}`);
    
    const lenderType = detectLenderType(workbook);
    let rates: ParsedRate[];
    let adjustments: AdjustmentGrid[] = [];
    
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
      case 'prmg':
        rates = parseGenericSheet(workbook);
        adjustments = parseGenericLLPAs(workbook);
        break;
      default:
        rates = parseGenericSheet(workbook);
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
