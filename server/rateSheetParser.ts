import * as XLSX from 'xlsx';

export interface ParsedRate {
  rate: number;
  price15Day: number;
  price30Day: number;
  price45Day: number;
  loanTerm: string;
  loanType: string;
}

export interface ParsedRateSheet {
  lenderName: string;
  rates: ParsedRate[];
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
  
  const gnmaSheet = workbook.Sheets['GNMA'];
  if (gnmaSheet) {
    const jsonData = XLSX.utils.sheet_to_json(gnmaSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend GNMA has ${jsonData.length} rows`);
    
    const gnmaRanges: CellRange[] = [
      { startRow: 7, endRow: 33, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'fha' },
      { startRow: 7, endRow: 33, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '30yr', loanType: 'fha' },
      { startRow: 7, endRow: 33, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '25yr', loanType: 'fha' },
      { startRow: 35, endRow: 61, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'fha' },
      { startRow: 35, endRow: 61, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '10yr', loanType: 'fha' },
      { startRow: 119, endRow: 145, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'va' },
      { startRow: 119, endRow: 145, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '25yr', loanType: 'va' },
      { startRow: 119, endRow: 145, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'va' },
      { startRow: 147, endRow: 173, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'va' },
      { startRow: 147, endRow: 173, rateCol: colToIndex('K'), price15Col: colToIndex('L'), price30Col: colToIndex('M'), price45Col: colToIndex('N'), loanTerm: '10yr', loanType: 'va' },
    ];
    
    for (const range of gnmaRanges) {
      parseRatesFromRange(jsonData, range, rates);
    }
  }
  
  const conventionalSheet = workbook.Sheets['FHLMC-FNMA'];
  if (conventionalSheet) {
    const jsonData = XLSX.utils.sheet_to_json(conventionalSheet, { header: 1 }) as any[][];
    console.log(`[PARSER] E Lend FHLMC-FNMA has ${jsonData.length} rows`);
    
    const conventionalRanges: CellRange[] = [
      { startRow: 7, endRow: 32, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 7, endRow: 32, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 7, endRow: 32, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'conventional' },
      { startRow: 35, endRow: 60, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '15yr', loanType: 'conventional' },
      { startRow: 63, endRow: 88, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 63, endRow: 88, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '30yr', loanType: 'conventional' },
      { startRow: 63, endRow: 88, rateCol: colToIndex('U'), price15Col: colToIndex('V'), price30Col: colToIndex('W'), price45Col: colToIndex('X'), loanTerm: '20yr', loanType: 'conventional' },
      { startRow: 91, endRow: 116, rateCol: colToIndex('A'), price15Col: colToIndex('B'), price30Col: colToIndex('C'), price45Col: colToIndex('D'), loanTerm: '15yr', loanType: 'conventional' },
      { startRow: 91, endRow: 116, rateCol: colToIndex('F'), price15Col: colToIndex('G'), price30Col: colToIndex('H'), price45Col: colToIndex('I'), loanTerm: '15yr', loanType: 'conventional' },
    ];
    
    for (const range of conventionalRanges) {
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

function detectLenderType(workbook: XLSX.WorkBook): 'rocket' | 'elend' | 'generic' {
  const sheetNames = workbook.SheetNames.map(s => s.toLowerCase());
  
  if (sheetNames.includes('ws du & lp pricing') && sheetNames.includes('ws rate sheet summary')) {
    console.log('[PARSER] Detected Rocket rate sheet structure');
    return 'rocket';
  }
  
  if (sheetNames.includes('gnma') && sheetNames.includes('fhlmc-fnma')) {
    console.log('[PARSER] Detected E Lend rate sheet structure');
    return 'elend';
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
    
    switch (lenderType) {
      case 'rocket':
        rates = parseRocketSheet(workbook);
        break;
      case 'elend':
        rates = parseELendSheet(workbook);
        break;
      default:
        rates = parseGenericSheet(workbook);
    }
    
    const rateSummary = new Map<string, number>();
    for (const rate of rates) {
      const key = `${rate.loanTerm} ${rate.loanType}`;
      rateSummary.set(key, (rateSummary.get(key) || 0) + 1);
    }
    console.log(`[PARSER] ${lenderName}: Found ${rates.length} valid rates`);
    console.log(`[PARSER] Rate summary:`, Object.fromEntries(rateSummary));
    
    return {
      lenderName,
      rates,
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in Excel file" : undefined,
    };
  } catch (error) {
    console.error(`[PARSER] ${lenderName}: Excel parse error:`, error);
    return {
      lenderName,
      rates: [],
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
      parseSuccess: rates.length > 0,
      parseError: rates.length === 0 ? "No valid rates found in PDF. Please upload Excel version." : undefined,
    };
  } catch (error) {
    return {
      lenderName,
      rates: [],
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
    parseSuccess: false,
    parseError: `Unsupported file format: ${fileName}`,
  };
}
